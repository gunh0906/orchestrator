# 데이터 수집 시스템 - 남은 작업 지시서

## 완료된 작업 (2026-03-04)
- [x] DB 스키마 설계 (schema_data_collection.sql)
- [x] 마이그레이션 스크립트 실행 완료 (22 statements, 테이블+인덱스+파티션)
- [x] API 핸들러 함수 (web/api/data_collection_handlers.py, 1133줄, 17함수)
- [x] server.py 라우팅 연결 (GET 10개, POST 7개, PUT 1개)
- [x] db_maintenance.py에 machining_telemetry 파티션 관리 추가
- [x] admin_signals UI (web/static/admin_signals.html + .js)
- [x] 불필요한 FastAPI API 파일 삭제

## 남은 작업

### Phase 1: 서버 통합 테스트 ✅ (2026-03-05 완료)
- 서버 import OK, API 전체 테스트 통과 (work-orders, cam-sheet, telemetry, signal-templates)
- admin/signals 페이지 200 OK

### Phase 2: admin_signals 백엔드 연결 ✅ (2026-03-05 완료)
- /admin/signals 라우트 + UI 수정 완료

### Phase 3: LSV2 데이터 수집 루프 ✅ (2026-03-05 완료)
- server_main.py의 _on_runtime_ready에 machining_telemetry INSERT 추가
- 작업번호 60초 캐시 조회
- PLC signals에서 spindle_load, axis_load 등 추출

### Phase 4: machining_auto 앱 연동 ← 다음 세션 여기서 시작

#### 4-1. API 클라이언트 모듈 생성 (machining_auto/common/monitor_api.py)
```python
# 서버 URL은 settings에서 가져오기 (기본 http://localhost:8866)
# requests 사용 (이미 dependency에 있을 가능성 높음, 없으면 urllib)
class MonitorAPI:
    def __init__(self, base_url, username, password):
        self.session = requests.Session()
        self.login(username, password)

    def create_work_order(self, machine_id, work_order_no) -> dict
    def complete_work_order(self, machine_id) -> dict
    def save_cam_sheet(self, data) -> dict
    def update_transfer_status(self, machine_id, status, file_name) -> dict
```

#### 4-2. 파일 전송 연동 (machine_transfer_page.py)
- `_on_f4_transfer()` (line 1583): 전송 시작 시 `update_transfer_status(machine_id, "transferring", filename)` 호출
- `_on_transfer_done()` (line 2454): 전송 완료 시 `update_transfer_status(machine_id, "completed", filename)` 호출
- 전송 실패 시 `update_transfer_status(machine_id, "failed", filename)`

#### 4-3. 작업번호 연동 (cam_sheet_auto/ 또는 app_shell.py)
- 폴더 지정 시 work_order_no 추출 → `create_work_order(machine_id, work_order_no)`
- 관련 파일: cam_sheet_auto/cam_core.py, cam_sheet_auto/app_paths.py

#### 4-4. 캠시트 저장 연동 (cam_sheet_auto/cam_sheet_app.py 또는 ui.py)
- CamSheetApp (line 153 in ui.py)에서 저장 시 `save_cam_sheet(data)` 호출
- 데이터: work_order_no, machine_id, material, operation_type, pitch, target_vc, target_fz, target_surface_roughness

#### 서버 URL 설정
- machining_auto에 아직 서버 URL 설정이 없음
- common/dialogs/settings_dialog.py에 "모니터 서버 URL" 설정 추가 필요
- 기본값: http://localhost:8866

#### 오케스트레이터 워커 구성 (3개)
- T1 (Codex): monitor_api.py 생성 + settings에 서버 URL 추가
- T2 (Codex): machine_transfer_page.py에 전송 상태 API 호출 추가
- T3 (Codex): cam_sheet에 작업번호/캠시트 API 호출 추가

### Phase 5: 대시보드 표시
1. 파일 전송 상태 표시 (설비 카드에 전송중/완료 뱃지)
2. 현재 작업번호 표시
3. 텔레메트리 요약 (스핀들부하 등) 대시보드 위젯

## 파일 맵
```
machining_monitor_server/
├── schema_data_collection.sql      # DB 스키마 정의
├── migrate_data_collection.py      # 마이그레이션 (실행 완료)
├── db_maintenance.py               # 파티션 관리 (수정 완료)
├── db_connection.py                # DatabasePool (기존)
├── web/
│   ├── server.py                   # 라우팅 (수정 완료)
│   ├── api/
│   │   ├── __init__.py
│   │   └── data_collection_handlers.py  # 17개 핸들러
│   └── static/
│       ├── admin_signals.html      # 관리자 UI
│       └── admin_signals.js        # 관리자 JS
```

You are executing task AGENT-T2 (Role: Backend-Parser).

## Goal: pythonocc-core(OCC)를 사용하여 IGES 파일 파싱 모듈 구현. parse_iges(filepath) 함수: IGES 읽기 -> TopoDS_Shape 반환. extract_faces(shape) 함수: 모든 Face를 추출하여 리스트 반환. classify_faces(faces) 함수: BRepBndLib로 바운딩박스 계산, 가장 큰 외곽 면(outer boundary) 식별 후 내부 면(internal)과 분리하여 반환. 각 면의 normal, area, type(pocket/hole/slot/wall) 정보 포함.

### Scope
Files to work on:
- iges_parser.py

### Instructions
1. Read each file in scope completely
2. Understand the codebase context around these files
3. Execute the goal described above
4. Verify syntax after editing (python -c or node -c)
5. Print a summary of changes at the end

### Constraints
- ONLY modify files listed in scope
- Verify syntax after editing

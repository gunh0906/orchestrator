You are executing task AGENT-T9 (Owner: Codex-ImportUI, Repo: machining_monitor_server).

## Goal: Add "Import from JSON" button and enhanced machine admin UI

### Context
- Dashboard at `web/static/index.html` has admin section with machine registration
- `web/static/app.js` handles machine admin logic (renderMachineAdmin, loadMachineAdmin, save/delete)
- Backend will have new endpoint: POST `/api/machines/import-json` (being added by another worker)
- Machine profiles may now include IP address

### Required Changes

#### 1. `machining_monitor_server/web/static/index.html`
- In the `admin-view-machines` section (around line 436-460):
  - Add a new button: `<button id="btn-machines-import-json" class="btn" type="button">JSON 불러오기</button>`
  - Place it next to the existing "설비목록 갱신" button in the `group-admin-head` div
  - Add IP address field to the machine-admin-form:
    `<label>IP 주소 <input id="machine-ip-input" type="text" placeholder="예: 218.151.133.198" /></label>`
  - Add IP column to the machines-table header: `<th>IP</th>`

#### 2. `machining_monitor_server/web/static/app.js`
- In `renderMachineAdmin()`:
  - Include `ip` field in row mapping
  - Show IP in table cells
  - Populate `machine-ip-input` on row select
- In `bindEvents()`:
  - Add click handler for `btn-machines-import-json`:
    ```js
    on('btn-machines-import-json', 'click', async () => {
      if (!state.permissions.admin) return;
      if (!window.confirm('machine_connections.json에서 설비 목록을 가져올까요?')) return;
      const body = await api('/api/machines/import-json', { method: 'POST', body: '{}' });
      window.alert(`${body.imported_count || 0}개 설비를 가져왔습니다.`);
      renderMachineAdmin(body.machines || {});
      await loadOverview();
    });
    ```
  - Update save handler to include IP:
    - Read `machine-ip-input` value
    - Send `ip` in the POST body to `/api/machines/upsert`

### Constraints
- ONLY modify files in machining_monitor_server/web/static/
- Keep changes minimal, match existing code style
- Ensure Korean text for UI labels
- Print a short summary at the end

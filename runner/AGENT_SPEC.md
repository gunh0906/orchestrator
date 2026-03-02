# Desktop App + Web Refactoring Specification

## Core Direction
1. App and Web roles are clearly separated
2. App = operational control (server/equipment ON/OFF, status, logs) - simplified
3. Web = dashboard/admin/analysis with advanced UI
4. No duplicate features between app and web

## App Feature Definition

### Tab Structure
- Operations Tab: server control + equipment individual ON/OFF + per-equipment log button
- Monitor Tab: existing monitor details (graph/timeline/detailed status) separated out
- Admin Tab: maintain per policy, do not increase Operations tab complexity

### Operations Tab UI Requirements
- Remove combo boxes (no user-operated combo boxes in operations tab)
- Keep slide-type ON/OFF buttons (server, individual equipment toggles)
- Equipment card required items: equipment name / online-offline status / slide toggle / log button
- Full screen layout: 8 cards per row
- Online/offline detection unified: connection_state + recent sample freshness
- No false "ON" display for offline equipment

### Header (Logo Row) Features
- Keep logo area
- Add function buttons: Home, Settings, Admin, Server global status, Notifications, User menu
- Server status badge with live feedback (STARTING/STOPPING/ERROR/ON/OFF)
- Header controls linked to operations tab behavior

### Server Control Behavior
- State machine: OFF -> STARTING -> ON -> STOPPING -> OFF/ERROR
- Progress display (progress bar / step text)
- Prevent duplicate clicks during action
- Guarantee web/collector cleanup on app exit

### Log Behavior
- Per-equipment log opens in separate window
- Large logs: load recent N lines + refresh support, no UI freeze

## Web Feature Definition
- Implement based on provided HTML design (header, KPI cards, machine cards, timeline, footer)
- Match colors/fonts/spacing/component structure as closely as possible
- Maintain responsive behavior (mobile/desktop)
- Data binding connects to existing web API
- Web = admin/view/analysis focused, minimize overlap with app control features

## Code/File Cleanup
1. Entry points: desktop entry and web entry stay separated, wrappers as thin wrappers
2. server_control_gui: disable by default or isolate as auxiliary tool
3. Main operational flow: single app path
4. Settings validation: host/port/runtime_db/connections_json/interval validation strengthened
5. Failure messages standardized

## QSS Policy
- Maintain current concept
- Allowed fixes: text clipping, alignment breaks, status color mismatch, initial render issues
- Forbidden: full redesign

## Implementation Order
1. App tab structure separation (Operations/Monitor)
2. Operations tab combo box removal + slide toggle retention
3. Equipment card 8-column layout stabilization
4. Status detection logic unification (online/offline)
5. Server state machine + progress UI connection
6. Header function buttons/status connection
7. Per-equipment log new window stabilization
8. Web rebuild based on provided HTML
9. Code cleanup and duplicate removal
10. Regression test

## Validation Required
- python -m py_compile on core modules
- Scenario test: app start -> server ON -> equipment individual ON/OFF -> log new window -> monitor tab switch -> server OFF -> app exit -> process cleanup verification

## Result Report Format
1. Changed file list
2. App changes (operations tab / monitor tab / header)
3. Web changes (reflection rate vs provided HTML)
4. Test results (PASS/FAIL)
5. Remaining issues and follow-up suggestions

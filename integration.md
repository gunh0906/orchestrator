# Integration Checklist (Multi-repo)

## Rules
- Record one integration section per ORCH id.
- Include PR/commit links per repo and explicit merge decision.

---

## [ORCH-0002]
- Coordination model:
  - PM: Codex-PM
  - UI/Relay: Claude (receives remote commands and relays to PM)
  - Worker lanes: T1(Codex-A), T4(Codex-B), T3(Codex-C)
- PR links:
  - machining_auto:
  - machining_core:
  - machining_monitor_server:
  - ml:
- Interface changes (API/Schema/Contract):
  - `connection_manager` lifecycle contract tightened for reconnect/disconnect behavior.
  - Runtime DB stores machine profile (`controller_type`, `connection_type`) consistently.
  - Snapshot/direct mode behavior split in monitor server diagnostics UI.
- End-to-end test steps:
  1. Connect/disconnect switching test across at least 3 machines repeatedly.
  2. Verify runtime panel and detail window render/controls in 2K and 4K.
  3. Validate snapshot baseline/compare persistence and direct-address plotting separation.
  4. Confirm runtime logging accumulates per machine and survives reconnect.
- E2E result:
- Release note (3 lines):
  1. Stabilized machine connection lifecycle under rapid switching.
  2. Unified monitor UI behavior and reduced duplicated controls.
  3. Improved runtime/snapshot diagnostics reliability across mixed controllers.
- Merge decision: GO / NO-GO

## [ORCH-0003]
- Coordination model:
  - PM: Codex-PM
  - UI/Relay: Claude
  - Worker lanes: T1(Codex-A), T3(Codex-B), T4(Codex-C)
- PR links:
  - orchestrator:
- Interface changes (API/Schema/Contract):
  - Dashboard now supports planner config load/save per ORCH.
  - Worker model includes optional `role` field and `claude-manual` engine selection.
  - Status includes process usage metrics for graph rendering.
- End-to-end test steps:
  1. Load ORCH config and modify workers/roles, then save and reload.
  2. Start ORCH run and verify worker states/logs update.
  3. Confirm CPU/MEM charts update under auto-refresh.
  4. Validate log panel readability and no black overlay.
- E2E result:
- Release note (3 lines):
  1. Planner-driven worker orchestration added to dashboard.
  2. Usage visualization integrated (CPU/MEM + trend).
  3. UI readability and operations flow improved for daily use.
- Merge decision: GO / NO-GO

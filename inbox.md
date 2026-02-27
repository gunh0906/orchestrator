# Remote Inbox

## Rules
- New requests are added with a REQ id.
- `status`: `NEW` / `TRIAGED` / `CLOSED`
- Only PM updates `TRIAGED`/`CLOSED`.

---

## [REQ-0001] status: NEW
- From:
- Timestamp:
- Goal:
- Context:
- Affected repos: (machining_auto / machining_core / machining_monitor_server / ml)
- UI change: YES/NO
- Must not:
- Done when:
- Priority: P0/P1/P2

## [REQ-0002] status: TRIAGED
- From: User
- Timestamp: 2026-02-26
- Goal: Orchestrator-first work split for current blocking issues before direct patching.
- Context:
  - `connection_manager` has 4 active stability issues.
  - Monitor server UI/QSS parity with machining_auto is broken (combo arrow, top bar state/button semantics).
  - Runtime logging must work for all machines with controller-aware behavior (TNC640, iTNC530, Fanuc coexistence).
  - Snapshot/direct-address flow is unstable and mixes with auto mode.
- Affected repos: machining_auto / machining_monitor_server
- UI change: YES
- Must not:
  - No PLC write operations.
  - Do not break existing machining_auto machine monitor behavior.
- Done when:
  - ORCH task set is created with per-repo scope, acceptance criteria, and sequence.
  - Team can execute from `master_tasks.md` without ambiguity.
- Priority: P0

## [REQ-0003] status: TRIAGED
- From: User
- Timestamp: 2026-02-26
- Goal: Upgrade orchestrator dashboard and execute via distributed parallel lanes.
- Context:
  - Dashboard must include Claude lane configuration and role assignment.
  - Log panel should use non-black design.
  - Add per-worker utilization graphs.
  - Allow adding/removing workers and assigning roles directly in UI.
  - Improve usability and trigger parallel run from updated planner.
- Affected repos: orchestrator
- UI change: YES
- Must not:
  - Do not break existing run/stop API compatibility.
  - Keep UTF-8 file encoding.
- Done when:
  - Dashboard supports config load/save + worker planner + utilization visualization.
  - ORCH-0003 task cards and prompts are generated and executable.
- Priority: P0

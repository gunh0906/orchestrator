You are executing task AGENT-T7 (Owner: Codex-CoolantVerify, Repo: machining_monitor_server + machining_auto).

## Goal: Verify and fix the full coolant pipeline for all controller types

### Background
- iTNC530 coolant uses **PLC MARKER** addresses (M8=OUT_OIL, M17=OUT_AIR, M18=IN_OIL)
- TNC640 coolant uses **PLC OUTPUT** addresses (288=OUT_OIL, 235=IN_OIL, 236=OUT_AIR, 237=IN_AIR)
- Fanuc coolant is being added separately

### Known Issues Fixed (verify these are correct)
1. `heidenhain_runtime_info.py` line ~1960: Should collect MARKER{8,17,18} for iTNC530 (NOT OUTPUT)
2. `control_profiles.py`: iTNC530 native targets should include `"MARKER": {8, 17, 18}`
3. `server_main.py` `_resolve_coolant()`: Should read MARKER for 530, OUTPUT for 640
4. `rotate_monitor_panel.py` `_extract_coolant_state()`: Same MARKER vs OUTPUT split
5. `app_shell.py` `_runtime_extract_coolant_state()`: Same MARKER vs OUTPUT split

### Tasks
1. READ each of the 5 files above and verify the coolant address mapping is correct:
   - iTNC530: MARKER[8]=OUT_OIL, MARKER[17]=OUT_AIR, MARKER[18]=IN_OIL
   - TNC640: OUTPUT[288]=OUT_OIL, OUTPUT[235]=IN_OIL, OUTPUT[236]=OUT_AIR, OUTPUT[237]=IN_AIR
2. Verify the `data_collection_handlers.py` includes coolant_state in SELECT and has the sub-query fallback for latest non-null coolant_state
3. Verify `app_shell.py` `_build_payload_from_api_response()` uses coolant_state text first, falls back to coolant_on 0/1
4. If ANY file still has the wrong mapping (e.g. reading OUTPUT instead of MARKER for 530 coolant), FIX IT
5. Report findings

### Constraints
- FIX any remaining issues found
- After editing, verify syntax with python -c for each modified file
- Print a detailed verification report at the end

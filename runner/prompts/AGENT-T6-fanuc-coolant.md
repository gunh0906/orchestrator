You are executing task AGENT-T6 (Owner: Codex-FanucCoolant, Repo: machining_monitor_server).

## Goal: Add Fanuc coolant detection via FOCAS2 PMC

### Context
- Fanuc 31i-M at IP 218.151.133.33 (machine name "5X Gundrill")
- FOCAS2 connector is in `machining_monitor_server/focas_connector.py`
- The FocasConnector class already has `read_pmc_bytes(adr_type, start, count)` method
- The `collect_all()` method in FocasConnector returns a dataclass with telemetry fields
- `server_main.py` handles Fanuc machines via `_fanuc_collect_and_record()` method

### Fanuc Coolant PMC Addresses (common for Fanuc 31i)
- PMC address **F0012 bit 6** or **Y-type address** for M8 coolant
- Alternatively, check macro variable **#4120** area or **G-type signals**
- Common approach: Read PMC G-type or Y-type outputs for coolant relay

### Required Changes

#### 1. `machining_monitor_server/focas_connector.py`
- Add a `get_coolant_state()` method to FocasConnector
- Try multiple approaches in priority order:
  1. PMC Y-type (Y output signals) - read bytes around Y0~Y3 range
  2. PMC R-type (internal relay) - common coolant relay addresses
  3. Macro variable approach as last resort
- Return dict: `{"coolant_on": 0|1|None, "coolant_state": "ON"|"OFF"|"", "source": "pmc_Y"|"pmc_R"|"macro"}`

#### 2. `machining_monitor_server/focas_connector.py` collect_all()
- Call `get_coolant_state()` and populate the telemetry dataclass fields

#### 3. `machining_monitor_server/server_main.py`
- In `_fanuc_collect_and_record()`, extract coolant_on and coolant_state from Fanuc telemetry
- Write to DB using the same coolant_on/coolant_state columns

### Important Notes
- The IODBPMCRNG structure has 8-byte header: type_a(short), type_d(short), datano_s(ushort), datano_e(ushort)
- buf_len for read_pmc_bytes = 8 + count
- adr_type: 0=G, 1=F, 2=Y, 3=X, 4=A, 5=R, 6=T, 7=K, 8=C, 9=D
- EW_OK = 0
- Read the existing `read_pmc_bytes` and `get_feed_override` methods to understand the pattern

### Constraints
- ONLY modify `focas_connector.py` and `server_main.py`
- Keep changes minimal
- After editing, verify syntax: `python -c "import ast; ast.parse(open('focas_connector.py',encoding='utf-8').read())"`
- Print a short summary at the end

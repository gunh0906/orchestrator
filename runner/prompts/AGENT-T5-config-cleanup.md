You are executing task AGENT-T5 (Owner: Claude-ConfigCleanup, Role: Infra-Config, Repo: machining_monitor_server).

## Goal: Remove dead code from config/db/path/log modules

### Context
- config_store.py: JSON configuration loader/saver
- db_connection.py: PostgreSQL connection pooling
- path_policy.py: Data directory path constants
- log_housekeeping.py: Log rotation utilities

### Steps
1. Read each file completely
2. For each file, search the repo for usages of its exported functions/constants
3. Find unused functions, constants, imports
4. Remove confirmed dead code
5. Verify syntax on each modified file

### Constraints
- ONLY modify the 4 files listed in scope_paths
- Do NOT remove functions used by server_main.py, web/server.py, or runtime/controller.py
- Print summary at the end

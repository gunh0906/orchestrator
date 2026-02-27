You are executing task {{TASK_ID}}.

Owner: {{OWNER}}
Repo: {{REPO}}
Scope paths (do not edit outside):
{{SCOPE_PATHS}}

Goal:
{{GOAL}}

Done when:
{{DONE_WHEN}}

Execution constraints:
- Do not redesign features; this lane is validation/reporting.
- Run targeted checks for: worker visibility, connection/tool-preset reliability, coolant mapping, dark UI layout, login/auth flow.
- Capture exact commands used and summarize key outputs (pass/fail with reason).
- Update `D:\Development\orchestrator\results.md` section `[{{TASK_ID}}]`.
- Keep edits UTF-8.

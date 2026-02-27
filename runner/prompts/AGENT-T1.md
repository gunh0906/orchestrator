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
- App entry should provide "connect all machines?" flow and start all machine connections when confirmed.
- App must expose server ON/OFF/Restart controls directly.
- Keep architecture aligned with single collector principle (avoid duplicate machine polling paths).
- Workspace may already be dirty from other lanes; do not pause for unrelated pre-existing changes.
- Only edit within scope paths and leave unrelated modified files untouched.
- Keep edits UTF-8.
- Update `D:\\Development\\orchestrator\\results.md` section `[{{TASK_ID}}]` with changed files, commands, and residual risks.

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
- Restore realtime graph visibility/behavior in the app flow.
- Rename realtime-focused green section label to `Scope`.
- Remove or collapse user-marked unnecessary display region(s) without breaking data context.
- Workspace may already be dirty from other lanes; do not pause for unrelated pre-existing changes.
- Only edit within scope paths and leave unrelated modified files untouched.
- Keep edits UTF-8.
- Update `D:\\Development\\orchestrator\\results.md` section `[{{TASK_ID}}]`.

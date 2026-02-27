# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROLE_BY_METHOD: dict[str, str] = {
    "connection": "Core/Connection",
    "ui": "UI/Design",
    "runtime": "Backend/Runtime",
    "diagnostics": "Diagnostics/Search",
    "search": "Diagnostics/Search",
    "auth": "Auth/Login",
    "validate": "Validation/QA",
    "integration": "Integration",
    "custom": "Custom",
}


KEYWORDS_BY_TAG: dict[str, list[str]] = {
    "connection": [
        "connect",
        "disconnect",
        "connection",
        "lsv2",
        "inspect",
        "tool table",
        "preset",
        "접속",
        "연결",
        "해제",
        "툴테이블",
        "프리셋",
    ],
    "ui": [
        "ui",
        "layout",
        "qss",
        "style",
        "dashboard",
        "overlap",
        "align",
        "디자인",
        "배치",
        "정렬",
        "화면",
        "가독성",
    ],
    "runtime": [
        "runtime",
        "db",
        "sqlite",
        "history",
        "session",
        "offline",
        "online",
        "가동률",
        "로그",
        "세션",
        "오프라인",
    ],
    "search": [
        "scan",
        "search",
        "snapshot",
        "value",
        "address",
        "trend",
        "그래프",
        "탐색",
        "검색",
        "스냅샷",
        "주소",
        "값",
    ],
    "auth": [
        "auth",
        "login",
        "password",
        "account",
        "user",
        "인증",
        "로그인",
        "비밀번호",
        "계정",
    ],
    "validate": [
        "test",
        "verify",
        "validation",
        "pass/fail",
        "검증",
        "테스트",
        "확인",
        "결과",
    ],
    "integration": [
        "integration",
        "import",
        "orchestrator",
        "runner",
        "pm",
        "통합",
        "오케스트레이터",
        "러너",
    ],
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _dump_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalize(text: str) -> str:
    return (text or "").strip().lower()


def _role_tags(role: str) -> set[str]:
    out: set[str] = set()
    r = _normalize(role)
    for tag, words in KEYWORDS_BY_TAG.items():
        if any(w in r for w in words[:5]):
            out.add(tag)
    return out


def _method_tags(method: str) -> set[str]:
    m = _normalize(method)
    if not m:
        return set()
    if m in ROLE_BY_METHOD:
        return {m if m != "diagnostics" else "search"}
    return set()


def _text_tags(text: str) -> set[str]:
    q = _normalize(text)
    if not q:
        return set()

    # Explicit method syntax: "method:ui,auth"
    explicit: set[str] = set()
    for chunk in q.replace(";", ",").split(","):
        chunk = chunk.strip()
        if not chunk.startswith("method:"):
            continue
        method = chunk.split(":", 1)[1].strip()
        if method:
            explicit |= _method_tags(method)

    out: set[str] = set(explicit)
    for tag, words in KEYWORDS_BY_TAG.items():
        if any(w in q for w in words):
            out.add(tag)
    return out


def _is_parallel_request(text: str) -> bool:
    q = _normalize(text)
    if not q:
        return False
    hints = [
        "all",
        "전체",
        "모두",
        "parallel",
        "병렬",
        "분배",
        "동시",
        "작업 분배",
    ]
    return any(h in q for h in hints)


def _is_claude_review_request(text: str) -> bool:
    q = _normalize(text)
    if not q:
        return False
    hints = [
        "claude",
        "sub agent",
        "ux",
        "design",
        "consistency",
        "structural",
        "counterexample",
        "review",
        "final",
        "rework",
        "rerun",
        "qa",
        "검토",
        "점검",
        "재작업",
        "재실행",
    ]
    return any(h in q for h in hints)


def _target_count(intent: set[str], request: str, min_workers: int, max_workers: int, total_workers: int) -> int:
    cap = max(1, min(max_workers, total_workers))
    floor = max(1, min(min_workers, cap))
    if _is_parallel_request(request):
        return cap
    if not intent:
        return max(floor, min(2, cap))
    if len(intent) >= 5:
        return min(cap, max(floor, 6))
    if len(intent) >= 3:
        return min(cap, max(floor, 4))
    return min(cap, max(floor, 2))


def _score_worker(worker: dict[str, Any], intent: set[str]) -> int:
    score = 0
    engine = _normalize(str(worker.get("engine", "")))
    role = str(worker.get("role", ""))
    method = str(worker.get("work_method", ""))
    goal = str(worker.get("goal", ""))
    owner = _normalize(str(worker.get("owner", "")))

    method_tags = _method_tags(method)
    role_goal_tags = _role_tags(role) | _text_tags(goal)
    tags = method_tags | role_goal_tags
    score += len(method_tags & intent) * 18
    score += len(role_goal_tags & intent) * 10

    if engine in {"codex", "claude-cli"}:
        score += 3

    if "ui" in intent and engine == "claude-cli":
        score += 8
    if "ui" in intent and "claude" in owner:
        score += 2
    if "validate" in intent and ("validate" in tags or "qa" in _normalize(role)):
        score += 5

    return score


def _assign_role_from_method(worker: dict[str, Any]) -> None:
    if bool(worker.get("fixed_role", False)):
        return
    method = _normalize(str(worker.get("work_method", "")))
    if not method:
        return
    mapped = ROLE_BY_METHOD.get(method)
    if not mapped:
        return
    worker["role"] = mapped


def _eligible_indices(workers: list[dict[str, Any]]) -> list[int]:
    idxs: list[int] = []
    for i, w in enumerate(workers):
        if not isinstance(w, dict):
            continue
        engine = _normalize(str(w.get("engine", "")))
        if engine in {"manual", "claude-manual"}:
            continue
        idxs.append(i)
    return idxs


def _select_workers(
    workers: list[dict[str, Any]],
    request: str,
    min_workers: int,
    max_workers: int,
) -> list[int]:
    intent = _text_tags(request)
    eligible = _eligible_indices(workers)
    if not eligible:
        return []

    # Empty request keeps current enabled set when possible.
    if not _normalize(request):
        current = [i for i in eligible if bool(workers[i].get("enabled", True))]
        if current:
            return current[: max_workers]

    target = _target_count(intent, request, min_workers, max_workers, len(eligible))
    ranked = sorted(eligible, key=lambda i: _score_worker(workers[i], intent), reverse=True)
    selected = ranked[:target]

    # Ensure fixed-role Claude review lane stays reusable when PM asks for review/rework.
    if _is_claude_review_request(request):
        fixed_review_workers = [
            i
            for i in eligible
            if bool(workers[i].get("fixed_role", False))
        ]
        for i in fixed_review_workers:
            if i not in selected:
                selected.append(i)

    if len(selected) < min_workers:
        for i in ranked:
            if i in selected:
                continue
            selected.append(i)
            if len(selected) >= min_workers:
                break
    return selected


def main() -> int:
    ap = argparse.ArgumentParser(description="PM auto delegation: pick worker subset by request intent")
    ap.add_argument("--tasks-file", required=True)
    ap.add_argument("--request", default="")
    ap.add_argument("--min-workers", type=int, default=1)
    ap.add_argument("--max-workers", type=int, default=10)
    ap.add_argument("--auto-role", action="store_true", default=True)
    args = ap.parse_args()

    tasks_file = Path(args.tasks_file).resolve()
    if not tasks_file.exists():
        print(f"[PM] tasks file not found: {tasks_file}")
        return 2

    cfg = _read_json(tasks_file)
    workers_raw = cfg.get("workers", [])
    if not isinstance(workers_raw, list) or not workers_raw:
        print("[PM] no workers configured")
        return 0

    workers: list[dict[str, Any]] = [w for w in workers_raw if isinstance(w, dict)]
    if args.auto_role:
        for w in workers:
            _assign_role_from_method(w)

    min_workers = max(1, int(args.min_workers))
    max_workers = max(1, min(10, int(args.max_workers)))
    if min_workers > max_workers:
        min_workers = max_workers

    request = str(args.request or "")
    selected = _select_workers(
        workers=workers,
        request=request,
        min_workers=min_workers,
        max_workers=max_workers,
    )
    selected_set = set(selected)

    applied_ids: list[str] = []
    for i, w in enumerate(workers):
        enabled = i in selected_set
        w["enabled"] = enabled
        if enabled:
            applied_ids.append(str(w.get("task_id", f"T{i + 1}")))

    defaults = cfg.setdefault("defaults", {})
    if isinstance(defaults, dict):
        defaults["pm_last_request"] = request
        defaults["pm_last_selected"] = applied_ids
        defaults["pm_last_selected_count"] = len(applied_ids)

    cfg["workers"] = workers
    _dump_json(tasks_file, cfg)

    print(f"[PM] request={request.strip() or '(empty)'}")
    print(f"[PM] selected={len(applied_ids)} -> {', '.join(applied_ids) if applied_ids else '(none)'}")
    print(f"[PM] tasks updated: {tasks_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

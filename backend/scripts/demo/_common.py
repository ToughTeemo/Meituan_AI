from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
for path in (BACKEND_ROOT, SCRIPTS_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from fastapi.testclient import TestClient

from app.core.database import create_db_and_tables
from app.main import create_app

DEFAULT_DEMO_PROMPT = (
    "Shanghai weekend family half-day trip, keep the plan stable for demo playback."
)


def bootstrap_demo_env() -> None:
    os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
    os.environ.setdefault("PLANNING_PROVIDER", "rule_based")


def create_demo_client() -> TestClient:
    bootstrap_demo_env()
    create_db_and_tables()
    return TestClient(create_app())


def create_demo_plan(
    session_id: str,
    prompt: str = DEFAULT_DEMO_PROMPT,
    user_id: str = "demo_user",
    city: str = "Shanghai",
) -> dict[str, Any]:
    request = {
        "prompt": prompt,
        "city": city,
        "session_id": session_id,
        "user_id": user_id,
    }
    with create_demo_client() as client:
        response = client.post("/api/plans", json=request)
        ensure_status(response.status_code, 201, response.text, "POST /api/plans")
        return response.json()


def execution_check(plan_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.post(f"/api/plans/{plan_id}/execution/check")
        ensure_status(
            response.status_code,
            200,
            response.text,
            f"POST /api/plans/{plan_id}/execution/check",
        )
        return response.json()


def latest_execution(plan_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.get(f"/api/plans/{plan_id}/execution/latest")
        ensure_status(
            response.status_code,
            200,
            response.text,
            f"GET /api/plans/{plan_id}/execution/latest",
        )
        return response.json()


def latest_proposal(plan_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.get(f"/api/plans/{plan_id}/replan/latest")
        ensure_status(
            response.status_code,
            200,
            response.text,
            f"GET /api/plans/{plan_id}/replan/latest",
        )
        return response.json()


def proposal_list(plan_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.get(f"/api/plans/{plan_id}/replans")
        ensure_status(
            response.status_code,
            200,
            response.text,
            f"GET /api/plans/{plan_id}/replans",
        )
        return response.json()


def apply_proposal(plan_id: str, proposal_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.post(f"/api/plans/{plan_id}/replan/{proposal_id}/apply")
        ensure_status(
            response.status_code,
            200,
            response.text,
            f"POST /api/plans/{plan_id}/replan/{proposal_id}/apply",
        )
        return response.json()


def get_plan(plan_id: str) -> dict[str, Any]:
    with create_demo_client() as client:
        response = client.get(f"/api/plans/{plan_id}")
        ensure_status(response.status_code, 200, response.text, f"GET /api/plans/{plan_id}")
        return response.json()


def ensure_status(status_code: int, expected: int, body: str, action: str) -> None:
    if status_code != expected:
        raise RuntimeError(f"{action} failed: {status_code} {body}")


def first_proposal(payload: dict[str, Any]) -> dict[str, Any]:
    proposals = payload.get("proposals")
    if isinstance(proposals, list) and proposals and isinstance(proposals[0], dict):
        return proposals[0]
    return {}


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


def is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


@contextmanager
def demo_mode_enabled() -> Any:
    original = os.environ.get("DEMO_MODE")
    os.environ["DEMO_MODE"] = "true"
    try:
        yield
    finally:
        if original is None:
            os.environ.pop("DEMO_MODE", None)
        else:
            os.environ["DEMO_MODE"] = original


def print_json(label: str, payload: Any) -> None:
    print(label)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def scripts_root() -> Path:
    return SCRIPTS_ROOT

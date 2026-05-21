import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_create_plan_and_get_plan(client: TestClient) -> None:
    create_response = client.post(
        "/api/plans",
        json={"prompt": "今天下午带孩子出去玩", "session_id": "session_test_1"},
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["plan_id"].startswith("plan_")
    assert created["session_id"] == "session_test_1"
    assert len(created["cards"]) > 0

    get_response = client.get(f"/api/plans/{created['plan_id']}")

    assert get_response.status_code == 200
    assert get_response.json()["plan_id"] == created["plan_id"]
    assert get_response.json()["session_id"] == "session_test_1"


def test_create_plan_generates_anonymous_session_when_missing(client: TestClient) -> None:
    response = client.post("/api/plans", json={"prompt": "周末上海半日游"})

    assert response.status_code == 201
    body = response.json()
    assert body["session_id"].startswith("anon_")
    assert body["user_id"] is None
    assert body["city"] == "上海"


def test_list_plans_by_session(client: TestClient) -> None:
    session_id = "session_list_1"
    first = client.post(
        "/api/plans",
        json={"prompt": "周六上海逛展", "session_id": session_id},
    ).json()
    second = client.post(
        "/api/plans",
        json={"prompt": "周日上海亲子", "session_id": session_id},
    ).json()
    client.post(
        "/api/plans",
        json={"prompt": "其他 session", "session_id": "session_list_other"},
    )

    response = client.get("/api/plans", params={"session_id": session_id})

    assert response.status_code == 200
    bodies = response.json()
    ids = {item["plan_id"] for item in bodies}
    assert ids == {first["plan_id"], second["plan_id"]}
    assert {item["session_id"] for item in bodies} == {session_id}


def test_create_plan_writes_initial_version_snapshot(client: TestClient) -> None:
    create_response = client.post(
        "/api/plans",
        json={"prompt": "周末上海半日游", "session_id": "version_session_1"},
    )
    plan = create_response.json()

    response = client.get(f"/api/plans/{plan['plan_id']}/versions")

    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["plan_id"] == plan["plan_id"]
    assert versions[0]["session_id"] == "version_session_1"
    assert versions[0]["version"] == 1
    assert versions[0]["event_type"] == "created"
    assert len(versions[0]["cards"]) == len(plan["cards"])


def test_replan_writes_version_history(client: TestClient) -> None:
    create_response = client.post(
        "/api/plans",
        json={"prompt": "少排队亲子路线", "session_id": "version_session_2"},
    )
    plan_id = create_response.json()["plan_id"]

    scan_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["queue"]},
    )
    risk = scan_response.json()["risks"][0]

    replan_response = client.post(
        f"/api/plans/{plan_id}/risks/{risk['risk_id']}/replan",
        json={"strategy": "balanced"},
    )

    assert replan_response.status_code == 200

    versions_response = client.get(f"/api/plans/{plan_id}/versions")

    assert versions_response.status_code == 200
    versions = versions_response.json()
    assert [item["event_type"] for item in versions] == ["created", "updated", "updated"]
    assert [item["version"] for item in versions] == [1, 1, 2]
    assert versions[-1]["status"] == "EXECUTING"
    assert versions[-1]["active_risk"] is None


def test_compare_plan_versions_reports_card_diff(client: TestClient) -> None:
    create_response = client.post(
        "/api/plans",
        json={"prompt": "version compare route", "session_id": "version_session_3"},
    )
    plan_id = create_response.json()["plan_id"]
    created_version = client.get(f"/api/plans/{plan_id}/versions").json()[0]

    scan_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["queue"]},
    )
    risk = scan_response.json()["risks"][0]
    client.post(
        f"/api/plans/{plan_id}/risks/{risk['risk_id']}/replan",
        json={"strategy": "balanced"},
    )
    versions = client.get(f"/api/plans/{plan_id}/versions").json()
    replanned_version = versions[-1]

    response = client.get(
        f"/api/plans/{plan_id}/versions/compare",
        params={
            "base_version_id": created_version["version_id"],
            "target_version_id": replanned_version["version_id"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["plan_id"] == plan_id
    assert body["base_version"] == 1
    assert body["target_version"] == 2
    assert body["added_card_ids"]
    assert body["removed_card_ids"]


def test_restore_plan_version_creates_restored_snapshot(client: TestClient) -> None:
    create_response = client.post(
        "/api/plans",
        json={"prompt": "version restore route", "session_id": "version_session_4"},
    )
    plan_id = create_response.json()["plan_id"]
    created_version = client.get(f"/api/plans/{plan_id}/versions").json()[0]

    scan_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["queue"]},
    )
    risk = scan_response.json()["risks"][0]
    client.post(
        f"/api/plans/{plan_id}/risks/{risk['risk_id']}/replan",
        json={"strategy": "balanced"},
    )

    response = client.post(
        f"/api/plans/{plan_id}/versions/{created_version['version_id']}/restore"
    )

    assert response.status_code == 200
    restored = response.json()
    assert restored["version"] == 3
    assert restored["session_id"] == "version_session_4"
    assert len(restored["cards"]) == len(created_version["cards"])

    versions = client.get(f"/api/plans/{plan_id}/versions").json()
    assert [item["event_type"] for item in versions] == [
        "created",
        "updated",
        "updated",
        "restored",
    ]
    assert versions[-1]["version"] == 3


def test_create_plan_returns_shanghai_mvp_route(client: TestClient) -> None:
    response = client.post(
        "/api/plans",
        json={"prompt": "周末在上海市区玩半天，预算 500，地铁方便，别太累"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["constraints"]["departure"] == "人民广场"
    assert "上海" in body["summary"]["title"]

    place_cards = [card for card in body["cards"] if card["type"] in {"activity", "dining"}]
    assert len(place_cards) >= 2

    first_poi = place_cards[0]["poi"]
    assert first_poi["district"]
    assert first_poi["address"]
    assert first_poi["latitude"] is not None
    assert first_poi["longitude"] is not None
    assert first_poi["recommendation_reason"]


def test_scan_and_replan_queue_risk(client: TestClient) -> None:
    create_response = client.post("/api/plans", json={"prompt": "少排队亲子路线"})
    plan_id = create_response.json()["plan_id"]

    scan_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["queue"]},
    )

    assert scan_response.status_code == 200
    risk = scan_response.json()["risks"][0]
    assert risk["type"] == "queue"

    replan_response = client.post(
        f"/api/plans/{plan_id}/risks/{risk['risk_id']}/replan",
        json={"strategy": "balanced"},
    )

    assert replan_response.status_code == 200
    replanned = replan_response.json()
    assert replanned["version"] == 2
    assert len(replanned["inserted_card_ids"]) > 0


def test_scan_can_detect_weather_and_fatigue_risks(client: TestClient) -> None:
    create_response = client.post("/api/plans", json={"prompt": "亲子轻松路线"})
    plan_id = create_response.json()["plan_id"]

    weather_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["weather"]},
    )

    assert weather_response.status_code == 200
    assert weather_response.json()["risks"][0]["type"] == "weather"

    fatigue_response = client.post(
        f"/api/plans/{plan_id}/risks/scan",
        json={"risk_types": ["fatigue"]},
    )

    assert fatigue_response.status_code == 200
    assert fatigue_response.json()["risks"][0]["type"] == "fatigue"


def test_submit_requirement_can_detect_fatigue(client: TestClient) -> None:
    create_response = client.post("/api/plans", json={"prompt": "亲子轻松路线"})
    plan_id = create_response.json()["plan_id"]

    response = client.post(
        f"/api/plans/{plan_id}/requirements",
        json={"text": "孩子有点累了", "source": "user_input"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requires_replan"] is True
    assert body["risk"]["type"] == "fatigue"

    plan_response = client.get(f"/api/plans/{plan_id}")
    assert plan_response.status_code == 200
    assert plan_response.json()["active_risk"]["type"] == "fatigue"

    replan_response = client.post(
        f"/api/plans/{plan_id}/risks/{body['risk']['risk_id']}/replan",
        json={"strategy": "lighter"},
    )

    assert replan_response.status_code == 200
    replanned = replan_response.json()
    assert replanned["status"] == "EXECUTING"
    assert replanned["version"] == 2
    assert "card_easy_park" in replanned["inserted_card_ids"]


def test_submit_requirement_can_replan_weather_risk(client: TestClient) -> None:
    create_response = client.post("/api/plans", json={"prompt": "亲子轻松路线"})
    plan_id = create_response.json()["plan_id"]

    response = client.post(
        f"/api/plans/{plan_id}/requirements",
        json={"text": "突然下雨了，想换成室内活动", "source": "user_input"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["requires_replan"] is True
    assert body["risk"]["type"] == "weather"

    replan_response = client.post(
        f"/api/plans/{plan_id}/risks/{body['risk']['risk_id']}/replan",
        json={"strategy": "balanced"},
    )

    assert replan_response.status_code == 200
    replanned = replan_response.json()
    assert replanned["status"] == "EXECUTING"
    assert "card_rain_indoor" in replanned["inserted_card_ids"]


def test_confirm_plan_and_run_action(client: TestClient) -> None:
    create_response = client.post("/api/plans", json={"prompt": "亲子轻松路线"})
    plan_id = create_response.json()["plan_id"]

    confirm_response = client.post(
        f"/api/plans/{plan_id}/confirm",
        json={"confirmed_by": "demo_user"},
    )

    assert confirm_response.status_code == 200
    confirmed = confirm_response.json()
    assert confirmed["status"] == "CONFIRMED"
    assert len(confirmed["next_actions"]) == 5

    action_response = client.post(
        f"/api/plans/{plan_id}/actions",
        json={"action_type": "reserve_restaurant", "card_id": "card_dinner"},
    )

    assert action_response.status_code == 200
    action = action_response.json()
    assert action["status"] == "success"
    assert action["action_type"] == "reserve_restaurant"

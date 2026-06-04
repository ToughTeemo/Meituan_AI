from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.plan_context_builder import PlanContextBuilder


def dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def main() -> None:
    prompt = "周末带孩子在上海玩半天，预算不要太高，优先室内"
    constraints = {
        "goal": prompt,
        "time_start": "13:30",
        "time_end": "18:30",
        "adults": 2,
        "children": 1,
        "children_age": 6,
        "budget": 400,
        "departure": "人民广场",
        "transport_mode": "地铁",
        "pace": "轻松",
        "preference_tags": ["亲子", "室内优先", "预算友好"],
    }

    context = PlanContextBuilder().build(prompt, constraints=constraints, limit=8)
    metadata = context["metadata"]

    print(f"planning_mode: {context['request']['planning_mode']}")
    print("\nweather:")
    print(dump(context["weather"]))
    print(f"\ncandidate_count: {metadata['candidate_count']}")

    print("\nFirst 3 candidates:")
    for candidate in context["candidates"][:3]:
        poi = candidate["poi"]
        print(f"\n--- {poi.get('poi_id')} / {poi.get('name')} ---")
        print(
            dump(
                {
                    "poi": {
                        "poi_id": poi.get("poi_id"),
                        "name": poi.get("name"),
                        "category": poi.get("category"),
                        "source": poi.get("source"),
                        "confidence": poi.get("confidence"),
                        "fallback_reason": poi.get("fallback_reason"),
                    },
                    "hours": candidate["hours"],
                    "price": candidate["price"],
                    "queue": candidate["queue"],
                    "booking": candidate["booking"],
                    "actions": candidate["actions"],
                }
            )
        )

    print("\nunknown_counts:")
    print(dump(metadata["unknown_counts"]))

    print("\nsource_summary:")
    print(dump(metadata["source_summary"]))


if __name__ == "__main__":
    main()

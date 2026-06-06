from __future__ import annotations

import json
import sys
from tempfile import TemporaryDirectory
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas.plan import Constraints
from app.services.mock_dataset_loader import MockDatasetLoader
from app.services.provider_catalog import ProviderCatalog


def dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def main() -> None:
    catalog = ProviderCatalog()
    pois = catalog.list_pois()
    print(f"POI count: {len(pois)}")

    print("\nFirst 3 POIs:")
    print(dump(pois[:3]))

    constraints = Constraints(
        goal="周末带孩子在上海玩半天，预算 500，地铁方便，少排队",
        time_start="13:30",
        time_end="20:00",
        adults=2,
        children=1,
        children_age=5,
        budget=500,
        departure="人民广场",
        transport_mode="地铁",
        pace="轻松",
        preference_tags=["亲子", "少排队", "地铁方便"],
    )
    candidates = catalog.search_pois(constraints, limit=3)
    print("\nTop 3 search candidates:")
    print(dump(candidates))

    print("\nProvider context for each POI:")
    for poi in pois:
        poi_id = poi["poi_id"]
        print(f"\n--- {poi_id} / {poi['name']} ---")
        print(dump(catalog.get_context_for_poi(poi_id)))

    print("\nMissing mock fallback probe:")
    missing_context = catalog.get_context_for_poi("__missing_poi__")
    if missing_context["queue"].get("source") != "unknown":
        raise RuntimeError("Expected missing queue mock to use unknown fallback.")
    print(dump(missing_context))

    with TemporaryDirectory() as tmp_dir:
        empty_loader = MockDatasetLoader(mock_dir=Path(tmp_dir))
        empty_catalog = ProviderCatalog(mock_loader=empty_loader)
        empty_poi = empty_catalog.list_pois()[0]
        empty_context = empty_catalog.get_context_for_poi(empty_poi["poi_id"])
        if empty_loader.list_records("hours"):
            raise RuntimeError("Expected missing mock files to load as empty datasets.")
        if empty_context["queue"].get("source") != "unknown":
            raise RuntimeError("Expected missing queue mock file to use unknown fallback.")

    print("\nMissing mock files probe: ok")


if __name__ == "__main__":
    main()

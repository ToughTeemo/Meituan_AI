from datetime import UTC, datetime
from uuid import uuid4

from app.core.config import settings
from app.core.errors import PlanNotFoundError, PlanVersionNotFoundError
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import (
    Card,
    CreatePlanRequest,
    PlanResponse,
    PlanSummary,
    PlanVersionCompareResponse,
    PlanVersionResponse,
)
from app.services.mock_data import create_mock_plan, new_log
from app.services.planner_service import ShanghaiMvpPlannerService
from app.services.poi_service import AmapPoiService, ShanghaiSeedPoiService
from app.services.route_service import AmapRouteService, EstimatedShanghaiRouteService
from app.services.weather_service import OpenMeteoWeatherService, SeedWeatherService


class PlanningService:
    def __init__(self, plan_repository: PlanRepository) -> None:
        self.plan_repository = plan_repository

    def create_plan(self, request: CreatePlanRequest) -> PlanResponse:
        if settings.planning_provider == "mock":
            plan = create_mock_plan(request.prompt)
            plan.session_id = self._session_id(request.session_id)
            plan.user_id = self._clean_optional_id(request.user_id)
            plan.city = request.city
            return self.plan_repository.create(plan)

        weather_service = (
            OpenMeteoWeatherService()
            if settings.weather_provider == "open_meteo"
            else SeedWeatherService()
        )
        print("Weather Service:", type(weather_service).__name__)
        seed_poi_service = ShanghaiSeedPoiService()
        poi_service = (
            AmapPoiService(settings.amap_api_key or "", fallback=seed_poi_service)
            if settings.poi_provider == "amap"
            else seed_poi_service
        )
        estimated_route_service = EstimatedShanghaiRouteService()
        route_service = (
            AmapRouteService(settings.amap_api_key or "", fallback=estimated_route_service)
            if settings.route_provider == "amap"
            else estimated_route_service
        )
        print("Route Service:", type(route_service).__name__)
        planner = ShanghaiMvpPlannerService(
            poi_service=poi_service,
            weather_service=weather_service,
            route_service=route_service,
        )
        plan = planner.create_plan(
            request.prompt,
            session_id=self._session_id(request.session_id),
            user_id=self._clean_optional_id(request.user_id),
            city=request.city,
        )
        return self.plan_repository.create(plan)

    def get_plan(self, plan_id: str) -> PlanResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()
        return plan

    def list_plans_for_session(self, session_id: str) -> list[PlanResponse]:
        return self.plan_repository.list_by_session(session_id)

    def list_plan_versions(self, plan_id: str) -> list[PlanVersionResponse]:
        if self.plan_repository.get(plan_id) is None:
            raise PlanNotFoundError()
        return self.plan_repository.list_versions(plan_id)

    def restore_plan_version(self, plan_id: str, version_id: str) -> PlanResponse:
        current = self.plan_repository.get(plan_id)
        if current is None:
            raise PlanNotFoundError()
        target = self.plan_repository.get_version(plan_id, version_id)
        if target is None:
            raise PlanVersionNotFoundError()

        now = datetime.now(UTC)
        restored = PlanResponse(
            plan_id=current.plan_id,
            session_id=current.session_id,
            user_id=current.user_id,
            city=current.city,
            source=current.source,
            status=target.status,
            version=current.version + 1,
            constraints=target.constraints,
            timeline=target.timeline,
            cards=target.cards,
            active_risk=target.active_risk,
            agent_logs=[
                *target.agent_logs,
                new_log(f"Restored plan from version snapshot {version_id}."),
            ],
            summary=PlanSummary(
                title="上海周末城市玩耍路线",
                subtitle="Restored from a previous plan version.",
            ),
            created_at=current.created_at,
            updated_at=now,
        )
        return self.plan_repository.save(restored, event_type="restored")

    def compare_plan_versions(
        self,
        plan_id: str,
        base_version_id: str,
        target_version_id: str,
    ) -> PlanVersionCompareResponse:
        if self.plan_repository.get(plan_id) is None:
            raise PlanNotFoundError()
        base = self.plan_repository.get_version(plan_id, base_version_id)
        target = self.plan_repository.get_version(plan_id, target_version_id)
        if base is None or target is None:
            raise PlanVersionNotFoundError()

        base_cards = {card.card_id: card for card in base.cards}
        target_cards = {card.card_id: card for card in target.cards}
        base_ids = set(base_cards)
        target_ids = set(target_cards)
        shared_ids = base_ids & target_ids

        changed = [
            card_id
            for card_id in sorted(shared_ids)
            if self._card_signature(base_cards[card_id])
            != self._card_signature(target_cards[card_id])
        ]
        unchanged = sorted(shared_ids - set(changed))

        return PlanVersionCompareResponse(
            plan_id=plan_id,
            base_version_id=base_version_id,
            target_version_id=target_version_id,
            base_version=base.version,
            target_version=target.version,
            base_status=base.status,
            target_status=target.status,
            added_card_ids=sorted(target_ids - base_ids),
            removed_card_ids=sorted(base_ids - target_ids),
            changed_card_ids=changed,
            unchanged_card_ids=unchanged,
        )

    def _session_id(self, value: str | None) -> str:
        cleaned = self._clean_optional_id(value)
        return cleaned or f"anon_{uuid4().hex[:16]}"

    def _clean_optional_id(self, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    def _card_signature(self, card: Card) -> dict:
        return card.model_dump(mode="json")

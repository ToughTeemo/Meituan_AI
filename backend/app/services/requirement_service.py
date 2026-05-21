from datetime import UTC, datetime
from uuid import uuid4

from app.core.errors import PlanNotFoundError
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import RiskSignal
from app.schemas.requirement import RequirementRequest, RequirementResponse
from app.services.mock_data import new_log


class RequirementService:
    def __init__(self, plan_repository: PlanRepository) -> None:
        self.plan_repository = plan_repository

    def submit_requirement(
        self,
        plan_id: str,
        request: RequirementRequest,
    ) -> RequirementResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()

        text = request.text.strip()
        risk = self._risk_from_text(text, [card.card_id for card in plan.cards])
        if risk:
            log = new_log(f"收到新情况：{risk.title}。建议调整当前方案。")
            plan.status = "RISK_DETECTED"
            plan.active_risk = risk
            plan.cards = [
                card.model_copy(update={"status": "risk"})
                if card.card_id in risk.affected_card_ids
                else card.model_copy(update={"status": "active"})
                if card.status == "risk"
                else card
                for card in plan.cards
            ]
            plan.agent_logs = [*plan.agent_logs, log]
            plan.updated_at = datetime.now(UTC)
            self.plan_repository.save(plan)
            return RequirementResponse(
                plan_id=plan_id,
                requires_replan=True,
                risk=risk,
                agent_logs=[log],
                message=risk.description,
            )

        message = self._message_from_text(text)
        log = new_log(message)
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)
        return RequirementResponse(
            plan_id=plan_id,
            requires_replan=False,
            risk=None,
            agent_logs=[log],
            message=message,
        )

    def _risk_from_text(self, text: str, card_ids: list[str]) -> RiskSignal | None:
        affected = self._activity_card_ids(card_ids)
        if "累" in text:
            return RiskSignal(
                risk_id=f"risk_fatigue_{uuid4().hex[:8]}",
                type="fatigue",
                severity="medium",
                title="孩子有点累了",
                description="建议加入低等待室内休息点，让后半程更轻松。",
                affected_card_ids=affected,
            )
        if "下雨" in text or "室内" in text or "雨" in text:
            return RiskSignal(
                risk_id=f"risk_weather_{uuid4().hex[:8]}",
                type="weather",
                severity="medium",
                title="天气或室内偏好变化",
                description="建议减少户外停留，切换到更稳妥的室内地点。",
                affected_card_ids=affected,
            )
        if "排队" in text or "人多" in text:
            return RiskSignal(
                risk_id=f"risk_queue_{uuid4().hex[:8]}",
                type="queue",
                severity="medium",
                title="排队或人流变化",
                description="建议避开等待较长地点，替换为低等待活动。",
                affected_card_ids=affected,
            )
        return None

    def _activity_card_ids(self, card_ids: list[str]) -> list[str]:
        return [card_id for card_id in card_ids if "park" in card_id] or card_ids[:1]

    def _message_from_text(self, text: str) -> str:
        if "预算" in text or "省" in text or "便宜" in text:
            return "收到：预算希望再省一点。后续会优先推荐更高性价比的选择。"
        if "餐厅" in text or "没位" in text:
            return "收到：餐厅相关变化。后续会优先查找附近可预约餐厅。"
        return f"收到：{text}。我会按这个偏好继续微调安排。"

from datetime import UTC, datetime

from app.core.errors import PlanNotFoundError, RiskNotFoundError
from app.repositories.plan_repository import PlanRepository
from app.schemas.risk import (
    IgnoreRiskResponse,
    ReplanRequest,
    ReplanResponse,
    RiskScanRequest,
    RiskScanResponse,
)
from app.services.mock_data import new_log, replanned_cards, risk_for_type


class RiskService:
    def __init__(self, plan_repository: PlanRepository) -> None:
        self.plan_repository = plan_repository

    def scan_risks(self, plan_id: str, request: RiskScanRequest) -> RiskScanResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()

        risk = next(
            (
                next_risk
                for risk_type in request.risk_types
                if (next_risk := risk_for_type(plan.cards, risk_type)) is not None
            ),
            None,
        )
        if risk is None:
            return RiskScanResponse(plan_id=plan_id, status="EXECUTING", risks=[], agent_logs=[])

        updated_cards = [
            card.model_copy(update={"status": "risk"})
            if card.card_id in risk.affected_card_ids
            else card.model_copy(update={"status": "active"})
            if card.status == "risk"
            else card
            for card in plan.cards
        ]
        log = new_log(self._agent_message_for_scan(risk.type))
        plan.status = "RISK_DETECTED"
        plan.active_risk = risk
        plan.cards = updated_cards
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)

        return RiskScanResponse(
            plan_id=plan_id,
            status="RISK_DETECTED",
            risks=[risk],
            agent_logs=[log],
        )

    def _agent_message_for_scan(self, risk_type: str) -> str:
        if risk_type == "weather":
            return "发现天气变化，建议切换到室内亲子备选。"
        if risk_type == "fatigue":
            return "发现孩子可能有点累了，建议加入低等待休息点。"
        return "发现儿童乐园排队变长，可能影响后续安排。"

    def replan(self, plan_id: str, risk_id: str, request: ReplanRequest) -> ReplanResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()
        if plan.active_risk is None or plan.active_risk.risk_id != risk_id:
            raise RiskNotFoundError()
        risk_type = plan.active_risk.type
        cards, inserted, removed = replanned_cards(plan.cards, risk_type)
        agent_message = self._agent_message_for_replan(risk_type)
        log = new_log(agent_message)
        plan.status = "EXECUTING"
        plan.version += 1
        plan.cards = cards
        plan.active_risk = None
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)

        return ReplanResponse(
            plan_id=plan_id,
            status="EXECUTING",
            version=plan.version,
            cards=cards,
            inserted_card_ids=inserted,
            removed_card_ids=removed,
            agent_message=agent_message,
            agent_logs=[log],
        )

    def _agent_message_for_replan(self, risk_type: str) -> str:
        if risk_type == "weather":
            return "已切换到室内亲子备选，并保留晚餐与 20:00 前返程。"
        if risk_type == "fatigue":
            return "已放慢活动节奏，并加入低等待休息点，让后半程更轻松。"
        return "已缩短高排队活动，并插入低等待替代方案。晚餐与返程保持稳定。"

    def ignore_risk(self, plan_id: str, risk_id: str) -> IgnoreRiskResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()
        if plan.active_risk is None or plan.active_risk.risk_id != risk_id:
            raise RiskNotFoundError()

        affected = set(plan.active_risk.affected_card_ids)
        cards = [
            card.model_copy(update={"status": "active"})
            if card.card_id in affected and card.status == "risk"
            else card
            for card in plan.cards
        ]
        log = new_log("已暂不调整，继续按当前安排推进。")
        plan.status = "EXECUTING"
        plan.active_risk = None
        plan.cards = cards
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)

        return IgnoreRiskResponse(plan_id=plan_id, status="EXECUTING", agent_logs=[log])

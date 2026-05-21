from datetime import UTC, datetime
from uuid import uuid4

from app.core.errors import PlanNotFoundError
from app.repositories.plan_repository import PlanRepository
from app.schemas.action import (
    ConfirmPlanRequest,
    ConfirmPlanResponse,
    NextAction,
    PlanActionRequest,
    PlanActionResponse,
)
from app.services.mock_data import new_log

NEXT_ACTIONS = [
    NextAction(action_id="reserve_activity", label="预约亲子乐园"),
    NextAction(action_id="reserve_restaurant", label="预约晚餐"),
    NextAction(action_id="generate_route", label="生成路线"),
    NextAction(action_id="share_plan", label="发送给同行人"),
    NextAction(action_id="set_reminder", label="设置提醒"),
]

ACTION_MESSAGES = {
    "reserve_activity": "已开始尝试预约亲子活动，当前为演示结果。",
    "reserve_restaurant": "已开始尝试预约餐厅，当前为演示结果。",
    "generate_route": "已生成适合当前路线的出行指引。",
    "share_plan": "已生成分享链接，可发送给同行人确认。",
    "set_reminder": "已设置出发和返程提醒。",
}


class ActionService:
    def __init__(self, plan_repository: PlanRepository) -> None:
        self.plan_repository = plan_repository

    def confirm_plan(
        self,
        plan_id: str,
        request: ConfirmPlanRequest,
    ) -> ConfirmPlanResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()

        log = new_log(f"{request.confirmed_by} 已确认方案，可以继续执行下一步动作。")
        plan.status = "CONFIRMED"  # type: ignore[assignment]
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)
        return ConfirmPlanResponse(
            plan_id=plan_id,
            status="CONFIRMED",
            next_actions=NEXT_ACTIONS,
            agent_logs=[log],
        )

    def run_action(self, plan_id: str, request: PlanActionRequest) -> PlanActionResponse:
        plan = self.plan_repository.get(plan_id)
        if plan is None:
            raise PlanNotFoundError()

        message = ACTION_MESSAGES[request.action_type]
        log = new_log(message)
        plan.agent_logs = [*plan.agent_logs, log]
        plan.updated_at = datetime.now(UTC)
        self.plan_repository.save(plan)
        return PlanActionResponse(
            action_id=f"act_{uuid4().hex[:8]}",
            action_type=request.action_type,
            status="success",
            message=message,
            agent_logs=[log],
        )

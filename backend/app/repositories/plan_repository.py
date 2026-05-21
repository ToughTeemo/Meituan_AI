import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Session, select

from app.models.plan import PlanRecord, PlanVersionRecord
from app.schemas.plan import (
    AgentLogEntry,
    Card,
    Constraints,
    PlanResponse,
    PlanSummary,
    PlanVersionResponse,
    RiskSignal,
    TimelineConfig,
)


class PlanRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, plan: PlanResponse) -> PlanResponse:
        record = self._to_record(plan)
        self.session.add(record)
        self.session.add(self._to_version_record(plan, event_type="created"))
        self.session.commit()
        self.session.refresh(record)
        return self._to_response(record)

    def get(self, plan_id: str) -> PlanResponse | None:
        record = self.session.get(PlanRecord, plan_id)
        if record is None:
            return None
        return self._to_response(record)

    def list_by_session(self, session_id: str) -> list[PlanResponse]:
        statement = (
            select(PlanRecord)
            .where(PlanRecord.session_id == session_id)
            .order_by(PlanRecord.updated_at.desc())
        )
        records = self.session.exec(statement).all()
        return [self._to_response(record) for record in records]

    def list_versions(self, plan_id: str) -> list[PlanVersionResponse]:
        statement = (
            select(PlanVersionRecord)
            .where(PlanVersionRecord.plan_id == plan_id)
            .order_by(PlanVersionRecord.created_at.asc())
        )
        records = self.session.exec(statement).all()
        return [self._version_to_response(record) for record in records]

    def get_version(self, plan_id: str, version_id: str) -> PlanVersionResponse | None:
        statement = select(PlanVersionRecord).where(
            PlanVersionRecord.plan_id == plan_id,
            PlanVersionRecord.version_id == version_id,
        )
        record = self.session.exec(statement).first()
        if record is None:
            return None
        return self._version_to_response(record)

    def save(self, plan: PlanResponse, event_type: str = "updated") -> PlanResponse:
        record = self.session.get(PlanRecord, plan.plan_id)
        if record is None:
            record = self._to_record(plan)
            self.session.add(record)
            event_type = "created"
        else:
            next_record = self._to_record(plan)
            record.session_id = next_record.session_id
            record.user_id = next_record.user_id
            record.city = next_record.city
            record.source = next_record.source
            record.status = next_record.status
            record.version = next_record.version
            record.constraints_json = next_record.constraints_json
            record.timeline_json = next_record.timeline_json
            record.cards_json = next_record.cards_json
            record.active_risk_json = next_record.active_risk_json
            record.agent_logs_json = next_record.agent_logs_json
            record.updated_at = datetime.now(UTC)

        self.session.add(self._to_version_record(plan, event_type=event_type))

        self.session.commit()
        self.session.refresh(record)
        return self._to_response(record)

    def _to_record(self, plan: PlanResponse) -> PlanRecord:
        return PlanRecord(
            plan_id=plan.plan_id,
            session_id=plan.session_id,
            user_id=plan.user_id,
            city=plan.city,
            source=plan.source,
            status=plan.status,
            version=plan.version,
            constraints_json=self._dump(plan.constraints),
            timeline_json=self._dump(plan.timeline),
            cards_json=self._dump_list(plan.cards),
            active_risk_json=self._dump(plan.active_risk) if plan.active_risk else None,
            agent_logs_json=self._dump_list(plan.agent_logs),
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )

    def _to_version_record(self, plan: PlanResponse, event_type: str) -> PlanVersionRecord:
        return PlanVersionRecord(
            version_id=f"pv_{uuid4().hex[:12]}",
            plan_id=plan.plan_id,
            session_id=plan.session_id,
            user_id=plan.user_id,
            city=plan.city,
            source=plan.source,
            version=plan.version,
            event_type=event_type,
            status=plan.status,
            constraints_json=self._dump(plan.constraints),
            timeline_json=self._dump(plan.timeline),
            cards_json=self._dump_list(plan.cards),
            active_risk_json=self._dump(plan.active_risk) if plan.active_risk else None,
            agent_logs_json=self._dump_list(plan.agent_logs),
            created_at=plan.updated_at,
        )

    def _to_response(self, record: PlanRecord) -> PlanResponse:
        return PlanResponse(
            plan_id=record.plan_id,
            session_id=record.session_id,
            user_id=record.user_id,
            city=record.city,
            source=record.source,
            status=record.status,  # type: ignore[arg-type]
            version=record.version,
            constraints=Constraints.model_validate_json(record.constraints_json),
            timeline=TimelineConfig.model_validate_json(record.timeline_json),
            cards=[Card.model_validate(item) for item in json.loads(record.cards_json)],
            active_risk=(
                RiskSignal.model_validate_json(record.active_risk_json)
                if record.active_risk_json
                else None
            ),
            agent_logs=[
                AgentLogEntry.model_validate(item) for item in json.loads(record.agent_logs_json)
            ],
            summary=PlanSummary(
                title="上海周末城市玩耍路线",
                subtitle="真实上海地点、路线时间、天气偏好和预算约束已纳入规划",
            ),
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    def _version_to_response(self, record: PlanVersionRecord) -> PlanVersionResponse:
        return PlanVersionResponse(
            version_id=record.version_id,
            plan_id=record.plan_id,
            session_id=record.session_id,
            user_id=record.user_id,
            city=record.city,
            source=record.source,
            version=record.version,
            event_type=record.event_type,
            status=record.status,  # type: ignore[arg-type]
            constraints=Constraints.model_validate_json(record.constraints_json),
            timeline=TimelineConfig.model_validate_json(record.timeline_json),
            cards=[Card.model_validate(item) for item in json.loads(record.cards_json)],
            active_risk=(
                RiskSignal.model_validate_json(record.active_risk_json)
                if record.active_risk_json
                else None
            ),
            agent_logs=[
                AgentLogEntry.model_validate(item) for item in json.loads(record.agent_logs_json)
            ],
            created_at=record.created_at,
        )

    def _dump(self, value: object) -> str:
        if hasattr(value, "model_dump_json"):
            return value.model_dump_json()
        return json.dumps(value, ensure_ascii=False)

    def _dump_list(self, values: list[object]) -> str:
        serialized = [
            value.model_dump(mode="json") if hasattr(value, "model_dump") else value
            for value in values
        ]
        return json.dumps(
            serialized,
            ensure_ascii=False,
        )

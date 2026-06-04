import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Session, select

from app.models.plan import (
    ExecutionSnapshotRecord,
    PlanRecord,
    PlanVersionRecord,
    ReplanProposalSnapshot,
)
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

    def save_execution_snapshot(
        self,
        plan_id: str,
        version: int,
        pipeline_result: dict,
    ) -> dict:
        record = ExecutionSnapshotRecord(
            id=f"es_{uuid4().hex[:12]}",
            plan_id=plan_id,
            version=version,
            status=str(pipeline_result.get("status") or "UNKNOWN"),
            summary_json=self._dump(pipeline_result.get("summary", "")),
            execution_context_json=self._dump(pipeline_result.get("execution_context", {})),
            risk_flags_json=self._dump(pipeline_result.get("risk_flags", [])),
            actions_json=self._dump(pipeline_result.get("actions", [])),
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return self._execution_snapshot_to_dict(record)

    def get_latest_execution_snapshot(self, plan_id: str) -> dict | None:
        statement = (
            select(ExecutionSnapshotRecord)
            .where(ExecutionSnapshotRecord.plan_id == plan_id)
            .order_by(ExecutionSnapshotRecord.created_at.desc())
        )
        record = self.session.exec(statement).first()
        if record is None:
            return None
        return self._execution_snapshot_to_dict(record)

    def list_execution_snapshots(self, plan_id: str) -> list[dict]:
        statement = (
            select(ExecutionSnapshotRecord)
            .where(ExecutionSnapshotRecord.plan_id == plan_id)
            .order_by(ExecutionSnapshotRecord.created_at.asc())
        )
        records = self.session.exec(statement).all()
        return [self._execution_snapshot_to_dict(record) for record in records]

    def save_replan_proposal(
        self,
        plan_id: str,
        execution_snapshot_id: str,
        proposal: dict,
    ) -> dict:
        risk_type = self._replan_risk_type(proposal)
        record = ReplanProposalSnapshot(
            id=f"rp_{uuid4().hex[:12]}",
            plan_id=plan_id,
            execution_snapshot_id=execution_snapshot_id,
            strategy=self._text(proposal.get("strategy"), "CONTINUE"),
            risk_type=risk_type,
            proposal_json=self._dump(proposal),
            accepted=False,
            accepted_at=None,
        )
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return self._replan_proposal_to_dict(record)

    def get_replan_proposal(self, proposal_id: str) -> dict | None:
        record = self.session.get(ReplanProposalSnapshot, proposal_id)
        if record is None:
            return None
        return self._replan_proposal_to_dict(record)

    def get_latest_replan_proposal(self, plan_id: str) -> dict | None:
        statement = (
            select(ReplanProposalSnapshot)
            .where(ReplanProposalSnapshot.plan_id == plan_id)
            .order_by(ReplanProposalSnapshot.created_at.desc())
        )
        record = self.session.exec(statement).first()
        if record is None:
            return None
        return self._replan_proposal_to_dict(record)

    def list_replan_proposals(self, plan_id: str) -> list[dict]:
        statement = (
            select(ReplanProposalSnapshot)
            .where(ReplanProposalSnapshot.plan_id == plan_id)
            .order_by(ReplanProposalSnapshot.created_at.asc())
        )
        records = self.session.exec(statement).all()
        return [self._replan_proposal_to_dict(record) for record in records]

    def accept_replan_proposal(self, proposal_id: str) -> dict | None:
        record = self.session.get(ReplanProposalSnapshot, proposal_id)
        if record is None:
            return None
        record.accepted = True
        record.accepted_at = datetime.now(UTC)
        self.session.add(record)
        self.session.commit()
        self.session.refresh(record)
        return self._replan_proposal_to_dict(record)

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
            record.summary_json = next_record.summary_json
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
            summary_json=self._dump(plan.summary),
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
            summary_json=self._dump(plan.summary),
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
            summary=self._summary_from_json(record.summary_json),
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

    def _execution_snapshot_to_dict(self, record: ExecutionSnapshotRecord) -> dict:
        return {
            "id": record.id,
            "plan_id": record.plan_id,
            "version": record.version,
            "status": record.status,
            "summary": json.loads(record.summary_json),
            "execution_context": json.loads(record.execution_context_json),
            "risk_flags": json.loads(record.risk_flags_json),
            "actions": json.loads(record.actions_json),
            "created_at": record.created_at.isoformat(),
        }

    def _replan_proposal_to_dict(self, record: ReplanProposalSnapshot) -> dict:
        accepted_at = record.accepted_at.isoformat() if record.accepted_at else None
        return {
            "id": record.id,
            "plan_id": record.plan_id,
            "execution_snapshot_id": record.execution_snapshot_id,
            "strategy": record.strategy,
            "risk_type": record.risk_type,
            "proposal_json": record.proposal_json,
            "proposal": json.loads(record.proposal_json),
            "accepted": record.accepted,
            "accepted_at": accepted_at,
            "created_at": record.created_at.isoformat(),
        }

    def _replan_risk_type(self, proposal: dict) -> str:
        if not self._bool(proposal.get("replanned")):
            return "NONE"

        strategy = self._text(proposal.get("strategy"), "CONTINUE")
        if strategy == "INDOOR_FALLBACK":
            return "WEATHER_RISK"
        if strategy == "ALTERNATIVE_POI":
            reason = self._text(proposal.get("reason"), "")
            if any(word in reason for word in ["预订", "预约", "购票", "booking"]):
                return "BOOKING_RISK"
            return "CLOSED_RISK"
        if strategy == "CONTINUE":
            return "DATA_UNKNOWN"
        return "NONE"

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

    def _text(self, value: object, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _bool(self, value: object) -> bool:
        return bool(value)

    def _summary_from_json(self, value: str | None) -> PlanSummary:
        if value:
            return PlanSummary.model_validate_json(value)
        return PlanSummary(
            title="上海周末城市玩耍路线",
            subtitle="真实上海地点、路线时间、天气偏好和预算约束已纳入规划",
        )

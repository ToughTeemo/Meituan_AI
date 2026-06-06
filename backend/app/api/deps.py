from collections.abc import Generator

from sqlmodel import Session

from app.core.database import engine
from app.repositories.plan_repository import PlanRepository
from app.services.action_service import ActionService
from app.services.planning_service import PlanningService
from app.services.requirement_service import RequirementService
from app.services.risk_service import RiskService


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def get_plan_repository(session: Session) -> PlanRepository:
    return PlanRepository(session)


def get_planning_service() -> Generator[PlanningService, None, None]:
    with Session(engine) as session:
        yield PlanningService(PlanRepository(session))


def get_risk_service() -> Generator[RiskService, None, None]:
    with Session(engine) as session:
        yield RiskService(PlanRepository(session))


def get_requirement_service() -> Generator[RequirementService, None, None]:
    with Session(engine) as session:
        yield RequirementService(PlanRepository(session))


def get_action_service() -> Generator[ActionService, None, None]:
    with Session(engine) as session:
        yield ActionService(PlanRepository(session))

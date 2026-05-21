from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from app.core.config import settings

engine_kwargs: dict = {}

if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

if settings.database_url == "sqlite:///:memory:":
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(settings.database_url, **engine_kwargs)


def create_db_and_tables() -> None:
    # Import models before metadata creation so SQLModel sees all table definitions.
    from app.models.plan import PlanRecord  # noqa: F401

    SQLModel.metadata.create_all(engine)

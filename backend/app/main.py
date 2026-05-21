from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.core.errors import register_exception_handlers
from app.core.middleware import register_middlewares


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    if settings.database_auto_create:
        create_db_and_tables()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Life Agent API",
        version=settings.app_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    register_middlewares(app)
    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()

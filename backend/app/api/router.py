from fastapi import APIRouter

from app.api.routes import actions, health, plans, requirements, risks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(plans.router)
api_router.include_router(risks.router)
api_router.include_router(requirements.router)
api_router.include_router(actions.router)

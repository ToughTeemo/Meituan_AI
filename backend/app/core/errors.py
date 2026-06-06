from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    code = "INTERNAL_ERROR"
    message = "Service is temporarily unavailable."
    status_code = 500

    def __init__(self, message: str | None = None, details: dict | None = None) -> None:
        self.message = message or self.message
        self.details = details or {}


class PlanNotFoundError(AppError):
    code = "PLAN_NOT_FOUND"
    message = "Plan does not exist or has expired."
    status_code = 404


class RiskNotFoundError(AppError):
    code = "RISK_NOT_FOUND"
    message = "Risk does not exist or is no longer active."
    status_code = 404


class PlanVersionNotFoundError(AppError):
    code = "PLAN_VERSION_NOT_FOUND"
    message = "Plan version does not exist."
    status_code = 404


class ReplanNotAvailableError(AppError):
    code = "REPLAN_NOT_AVAILABLE"
    message = "This risk cannot be replanned right now."
    status_code = 409


def error_payload(error: AppError) -> dict:
    return {
        "error": {
            "code": error.code,
            "message": error.message,
            "details": error.details,
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_payload(exc))

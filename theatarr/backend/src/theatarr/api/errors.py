"""Error handling utilities for Theatarr API."""

from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class AppException(HTTPException):
    """Base application exception with error code."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message


class NotFoundError(AppException):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: str | None = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with ID '{identifier}' not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=message,
        )


class ConflictError(AppException):
    """Resource conflict error."""

    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code="CONFLICT",
            message=message,
        )


class ValidationError_(AppException):
    """Validation error."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message=message,
        )
        self.field = field


class ServiceUnavailableError(AppException):
    """External service unavailable error."""

    def __init__(self, service: str, reason: str | None = None):
        message = f"Service '{service}' is unavailable"
        if reason:
            message = f"{message}: {reason}"
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="SERVICE_UNAVAILABLE",
            message=message,
        )


class SessionNotRunningError(AppException):
    """Session is not in running state error."""

    def __init__(self, session_id: str, current_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="SESSION_NOT_RUNNING",
            message=f"Session '{session_id}' is not running (current status: {current_status})",
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handler for application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
            },
        },
    )


async def validation_exception_handler(
    request: Request, exc: ValidationError
) -> JSONResponse:
    """Handler for Pydantic validation errors."""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append(
            {
                "code": "VALIDATION_ERROR",
                "message": error["msg"],
                "field": field,
            }
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "errors": errors,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler for unexpected exceptions."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
        },
    )

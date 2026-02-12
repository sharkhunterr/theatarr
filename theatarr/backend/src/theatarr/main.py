"""FastAPI application entry point for Theatarr."""

import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from theatarr import __version__
from theatarr.adapters.registry import discover_adapters
from theatarr.api import auth, config, display, logs, movies, portal, services, sessions, sequences, templates, trailers, users, vote, wallmount
from theatarr.api.errors import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    validation_exception_handler,
)
from theatarr.api.ws import ws_manager
from theatarr.config import settings
from theatarr.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    from theatarr.services.scheduler import get_scheduler

    # Startup
    from theatarr.api.logs import setup_log_capture
    setup_log_capture()
    # Also log to console for dev
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(console)

    discover_adapters()
    await init_db()

    scheduler = get_scheduler()
    await scheduler.start()

    yield

    # Shutdown
    await scheduler.stop()
    await close_db()


app = FastAPI(
    title="Theatarr",
    description="""
# Theatarr - Home Cinema Orchestration System

Orchestrate lighting, audio, and media for the ultimate movie experience.

## Features

- **Session Management**: Create and control cinema sessions with multiple sequences
- **Sequence Orchestration**: Design complex action sequences with lighting, audio, and media
- **Service Integration**: Connect Philips Hue, Home Assistant, Plex, Jellyfin, and more
- **Wallmount Display**: Public display page with movie info, countdown, and dynamic theming
- **Vote System**: Token-based voting for movie selection
- **Trailer Management**: Auto-download trailers with quality and storage rules
- **Configuration**: Export/import settings with encrypted secrets

## Authentication

Most endpoints require JWT authentication. Obtain a token via `/api/v1/auth/login`.

Include the token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## WebSocket

Real-time updates are available via WebSocket at `/api/v1/ws`.

Query parameters:
- `token`: JWT token for authenticated clients
- `wallmount`: Set to `true` for wallmount display connections
- `vote_token`: Token for anonymous vote session participants
    """,
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else "/api/v1/openapi.json",
    openapi_tags=[
        {"name": "auth", "description": "Authentication and authorization"},
        {"name": "users", "description": "User management (admin)"},
        {"name": "portal", "description": "User portal for sessions and votes"},
        {"name": "sessions", "description": "Cinema session management"},
        {"name": "sequences", "description": "Sequence and action orchestration"},
        {"name": "services", "description": "External service configuration"},
        {"name": "templates", "description": "Wallmount display templates"},
        {"name": "wallmount", "description": "Public wallmount display"},
        {"name": "vote", "description": "Movie voting system"},
        {"name": "trailers", "description": "Trailer library management"},
        {"name": "configuration", "description": "Settings and config import/export"},
        {"name": "logs", "description": "Session history and activity logs"},
        {"name": "movies", "description": "Movie library browsing"},
    ],
    contact={
        "name": "Theatarr",
        "url": "https://github.com/theatarr/theatarr",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(ValidationError, validation_exception_handler)
if not settings.debug:
    app.add_exception_handler(Exception, generic_exception_handler)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(portal.router, prefix="/api/v1")
app.include_router(services.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(sequences.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(wallmount.router, prefix="/api/v1")
app.include_router(vote.router, prefix="/api/v1")
app.include_router(trailers.router, prefix="/api/v1")
app.include_router(config.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(movies.router, prefix="/api/v1")
app.include_router(display.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": __version__,
    }


@app.get("/api/v1/info", tags=["Info"])
async def get_info() -> dict:
    """Get API information."""
    return {
        "name": "Theatarr",
        "version": __version__,
        "description": "Home Cinema Orchestration System",
        "features": {
            "sessions": True,
            "sequences": True,
            "services": True,
            "wallmount": True,
            "voting": True,
            "trailers": True,
        },
    }


@app.websocket("/api/v1/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    wallmount: bool = Query(default=False),
    vote_token: str | None = Query(default=None),
) -> None:
    """WebSocket endpoint for real-time communication."""
    try:
        client = await ws_manager.connect(
            websocket,
            token=token,
            wallmount=wallmount,
            vote_token=vote_token,
        )

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await ws_manager.handle_message(websocket, message)
            except json.JSONDecodeError:
                await ws_manager.send_to_client(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "INVALID_MESSAGE",
                            "message": "Invalid JSON format",
                        },
                    },
                )

    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(websocket)

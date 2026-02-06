"""Sessions API router for Theatarr."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm.attributes import flag_modified

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.action import Action
from theatarr.models.session import Session, SessionStatus
from theatarr.models.sequence import DurationType, Sequence
from theatarr.schemas.session import (
    SessionControlAction,
    SessionControlRequest,
    SessionControlResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
    SessionState,
    SessionUpdate,
    SequenceSummary,
)
from theatarr.services.engine import (
    EngineError,
    SessionNotFoundError,
    SessionNotRunnableError,
    get_engine,
)
from theatarr.services.scheduler import get_scheduler

router = APIRouter(prefix="/sessions", tags=["Sessions"])


def _session_to_response(session: Session) -> SessionResponse:
    """Convert Session model to response schema."""
    return SessionResponse(
        id=session.id,
        name=session.name,
        description=session.description,
        movie_id=session.movie_id,
        movie_title=session.movie_title,
        movie_poster_url=session.movie_poster_url,
        movie_source_id=session.movie_source_id,
        movie_source=session.movie_source,
        color_palette=session.color_palette,
        status=SessionStatus(session.status),
        scheduled_at=session.scheduled_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
        current_sequence_index=session.current_sequence_index,
        current_sequence_elapsed_ms=session.current_sequence_elapsed_ms,
        auto_resume_enabled=session.auto_resume_enabled,
        total_sequences=session.total_sequences,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _sequence_to_summary(sequence: Sequence) -> SequenceSummary:
    """Convert Sequence model to summary schema."""
    return SequenceSummary(
        id=sequence.id,
        name=sequence.name,
        order_index=sequence.order_index,
        duration_type=sequence.duration_type.value,
        duration_ms=sequence.duration_ms,
        transition_ms=sequence.transition_ms,
    )


@router.get(
    "",
    response_model=SessionListResponse,
    summary="List Sessions",
)
async def list_sessions(
    db: DbSession,
    user: AdminUser,
    status_filter: SessionStatus | None = None,
    skip: int = 0,
    limit: int = 20,
) -> SessionListResponse:
    """List all sessions with optional status filter."""
    query = select(Session)

    if status_filter:
        query = query.where(Session.status == status_filter)

    query = query.order_by(Session.updated_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Get total count
    count_query = select(func.count(Session.id))
    if status_filter:
        count_query = count_query.where(Session.status == status_filter)
    total = await db.execute(count_query)

    return SessionListResponse(
        items=[_session_to_response(s) for s in sessions],
        total=total.scalar() or 0,
    )


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Session",
)
async def create_session(
    db: DbSession,
    user: AdminUser,
    data: SessionCreate,
) -> SessionResponse:
    """Create a new session."""
    session = Session(
        name=data.name,
        description=data.description,
        movie_id=data.movie_id,
        movie_title=data.movie_title,
        movie_poster_url=data.movie_poster_url,
        movie_source_id=data.movie_source_id,
        movie_source=data.movie_source,
        color_palette=data.color_palette,
        scheduled_at=data.scheduled_at,
        auto_resume_enabled=data.auto_resume_enabled,
        workflow=data.workflow,
        status=SessionStatus.SCHEDULED if data.scheduled_at else SessionStatus.DRAFT,
    )
    db.add(session)
    await db.flush()  # Get session.id without committing

    # Create sequences if provided
    for order_index, seq_data in enumerate(data.sequences):
        sequence = Sequence(
            session_id=session.id,
            name=seq_data.name,
            description=seq_data.description,
            order_index=order_index,
            duration_type=DurationType(seq_data.duration_type),
            duration_ms=seq_data.duration_ms,
            duration_fallback_ms=seq_data.duration_fallback_ms,
            transition_ms=seq_data.transition_ms,
        )
        db.add(sequence)
        await db.flush()  # Get sequence.id

        # Create actions for this sequence
        for action_order, action_data in enumerate(seq_data.actions):
            action = Action(
                sequence_id=sequence.id,
                action_type=action_data.action_type,
                command=action_data.command,
                parameters=action_data.parameters,
                delay_ms=action_data.delay_ms,
                on_failure=action_data.on_failure,
                order_index=action_order,
                service_id=action_data.service_id,
            )
            db.add(action)

    await db.commit()
    await db.refresh(session)

    return _session_to_response(session)


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
    summary="Get Session",
)
async def get_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionDetailResponse:
    """Get a session by ID with sequences."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    sequences = [_sequence_to_summary(s) for s in session.sequences]
    current_seq = None
    if session.current_sequence:
        current_seq = _sequence_to_summary(session.current_sequence)

    return SessionDetailResponse(
        id=session.id,
        name=session.name,
        description=session.description,
        movie_id=session.movie_id,
        movie_title=session.movie_title,
        movie_poster_url=session.movie_poster_url,
        movie_source_id=session.movie_source_id,
        movie_source=session.movie_source,
        color_palette=session.color_palette,
        status=SessionStatus(session.status),
        scheduled_at=session.scheduled_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
        current_sequence_index=session.current_sequence_index,
        current_sequence_elapsed_ms=session.current_sequence_elapsed_ms,
        auto_resume_enabled=session.auto_resume_enabled,
        total_sequences=session.total_sequences,
        created_at=session.created_at,
        updated_at=session.updated_at,
        sequences=sequences,
        current_sequence=current_seq,
        workflow=session.workflow,
    )


@router.patch(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Update Session",
)
async def update_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: SessionUpdate,
) -> SessionResponse:
    """Update a session."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    # Can only update draft or scheduled sessions
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update session in status: {session.status}",
        )

    # Update basic fields (exclude sequences)
    update_data = data.model_dump(exclude_unset=True, exclude={"sequences"})
    for field, value in update_data.items():
        setattr(session, field, value)

    # Flag JSON fields as modified for SQLAlchemy to detect changes
    if "workflow" in update_data:
        flag_modified(session, "workflow")
    if "color_palette" in update_data:
        flag_modified(session, "color_palette")

    # Handle sequences update
    if data.sequences is not None:
        # Delete existing sequences (cascade will delete actions)
        for seq in session.sequences:
            await db.delete(seq)

        # Create new sequences
        for order_index, seq_data in enumerate(data.sequences):
            sequence = Sequence(
                session_id=session.id,
                name=seq_data.name,
                description=seq_data.description,
                order_index=order_index,
                duration_type=DurationType(seq_data.duration_type),
                duration_ms=seq_data.duration_ms,
                duration_fallback_ms=seq_data.duration_fallback_ms,
                transition_ms=seq_data.transition_ms,
            )
            db.add(sequence)
            await db.flush()  # Get sequence.id

            # Create actions for this sequence
            for action_order, action_data in enumerate(seq_data.actions):
                action = Action(
                    sequence_id=sequence.id,
                    action_type=action_data.action_type,
                    command=action_data.command,
                    parameters=action_data.parameters,
                    delay_ms=action_data.delay_ms,
                    on_failure=action_data.on_failure,
                    order_index=action_order,
                    service_id=action_data.service_id,
                )
                db.add(action)

    # Update status if scheduled_at changed
    if data.scheduled_at is not None:
        session.status = SessionStatus.SCHEDULED
    elif data.scheduled_at is None and session.scheduled_at is None:
        session.status = SessionStatus.DRAFT

    await db.commit()
    await db.refresh(session)

    return _session_to_response(session)


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Session",
)
async def delete_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> None:
    """Delete a session."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    # Cannot delete active sessions
    if session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an active session. Stop it first.",
        )

    await db.delete(session)
    await db.commit()


@router.post(
    "/{session_id}/control",
    response_model=SessionControlResponse,
    summary="Control Session",
)
async def control_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: SessionControlRequest,
) -> SessionControlResponse:
    """Control session execution (play, pause, stop, skip, restart)."""
    engine = get_engine(db)

    try:
        if data.action == SessionControlAction.PLAY:
            # Check if paused or not started
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
            if not session:
                raise NotFoundError("Session", session_id)

            if session.status == SessionStatus.PAUSED:
                session = await engine.resume_session(session_id)
            else:
                session = await engine.start_session(session_id)

        elif data.action == SessionControlAction.PAUSE:
            session = await engine.pause_session(session_id)

        elif data.action == SessionControlAction.STOP:
            session = await engine.stop_session(session_id)

        elif data.action == SessionControlAction.SKIP:
            session = await engine.skip_sequence(session_id)

        elif data.action == SessionControlAction.RESTART:
            # Stop and restart from beginning
            await engine.stop_session(session_id)
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                session.status = SessionStatus.DRAFT
                session.current_sequence_index = 0
                session.current_sequence_elapsed_ms = 0
                session.started_at = None
                session.completed_at = None
                await db.commit()
                session = await engine.start_session(session_id)

        # Get current state
        state_dict = await engine.get_session_state(session_id)
        state = SessionState(
            session_id=state_dict["session_id"],
            status=SessionStatus(state_dict["status"]),
            current_sequence_index=state_dict["current_sequence_index"],
            current_sequence_elapsed_ms=state_dict["current_sequence_elapsed_ms"],
            total_sequences=state_dict["total_sequences"],
        )

        return SessionControlResponse(
            success=True,
            action=data.action,
            session_id=session_id,
            new_state=state,
        )

    except SessionNotFoundError:
        raise NotFoundError("Session", session_id)
    except SessionNotRunnableError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except EngineError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/{session_id}/state",
    response_model=SessionState,
    summary="Get Session State",
)
async def get_session_state(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionState:
    """Get current execution state of a session."""
    engine = get_engine(db)

    try:
        state_dict = await engine.get_session_state(session_id)

        current_seq = None
        if "current_sequence" in state_dict:
            current_seq = SequenceSummary(
                id=state_dict["current_sequence"]["id"],
                name=state_dict["current_sequence"]["name"],
                order_index=0,  # Not in state_dict
                duration_type=state_dict["current_sequence"]["duration_type"],
                duration_ms=state_dict["current_sequence"]["duration_ms"],
                transition_ms=0,  # Not in state_dict
            )

        return SessionState(
            session_id=state_dict["session_id"],
            status=SessionStatus(state_dict["status"]),
            current_sequence_index=state_dict["current_sequence_index"],
            current_sequence_elapsed_ms=state_dict["current_sequence_elapsed_ms"],
            total_sequences=state_dict["total_sequences"],
            current_sequence=current_seq,
        )

    except SessionNotFoundError:
        raise NotFoundError("Session", session_id)


@router.post(
    "/extract-palette",
    summary="Extract Color Palette",
)
async def extract_palette(
    user: AdminUser,
    poster_url: str,
) -> dict:
    """Extract color palette from a movie poster URL."""
    from theatarr.services.palette import (
        extract_palette_from_url,
        PaletteExtractionError,
    )

    try:
        palette = await extract_palette_from_url(poster_url)
        return palette
    except PaletteExtractionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

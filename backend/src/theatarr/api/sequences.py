"""Sequences API router for Theatarr."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.action import Action
from theatarr.models.sequence import Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.schemas.sequence import (
    ActionCreate,
    ActionResponse,
    ActionUpdate,
    SequenceCreate,
    SequenceDetailResponse,
    SequenceDuplicateRequest,
    SequenceListResponse,
    SequenceReorderRequest,
    SequenceResponse,
    SequenceUpdate,
)

router = APIRouter(prefix="/sessions/{session_id}/sequences", tags=["Sequences"])


def _sequence_to_response(sequence: Sequence) -> SequenceResponse:
    """Convert Sequence model to response schema."""
    return SequenceResponse(
        id=sequence.id,
        session_id=sequence.session_id,
        name=sequence.name,
        description=sequence.description,
        order_index=sequence.order_index,
        duration_type=sequence.duration_type.value,
        duration_ms=sequence.duration_ms,
        duration_fallback_ms=sequence.duration_fallback_ms,
        transition_ms=sequence.transition_ms,
        node_editor_data=sequence.node_editor_data,
        total_actions=sequence.total_actions,
        created_at=sequence.created_at,
        updated_at=sequence.updated_at,
    )


def _action_to_response(action: Action) -> ActionResponse:
    """Convert Action model to response schema."""
    return ActionResponse(
        id=action.id,
        sequence_id=action.sequence_id,
        service_id=action.service_id,
        action_type=action.action_type.value,
        command=action.command,
        parameters=action.parameters,
        delay_ms=action.delay_ms,
        on_failure=action.on_failure.value,
        created_at=action.created_at,
        updated_at=action.updated_at,
    )


async def _get_session(db: DbSession, session_id: str) -> Session:
    """Get session by ID or raise 404."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Session", session_id)
    return session


async def _get_sequence(db: DbSession, session_id: str, sequence_id: str) -> Sequence:
    """Get sequence by ID or raise 404."""
    result = await db.execute(
        select(Sequence).where(
            Sequence.id == sequence_id,
            Sequence.session_id == session_id,
        )
    )
    sequence = result.scalar_one_or_none()
    if not sequence:
        raise NotFoundError("Sequence", sequence_id)
    return sequence


@router.get(
    "",
    response_model=SequenceListResponse,
    summary="List Sequences",
)
async def list_sequences(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SequenceListResponse:
    """List all sequences in a session."""
    await _get_session(db, session_id)

    result = await db.execute(
        select(Sequence)
        .where(Sequence.session_id == session_id)
        .order_by(Sequence.order_index)
    )
    sequences = result.scalars().all()

    return SequenceListResponse(
        items=[_sequence_to_response(s) for s in sequences],
        total=len(sequences),
    )


@router.post(
    "",
    response_model=SequenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Sequence",
)
async def create_sequence(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: SequenceCreate,
) -> SequenceResponse:
    """Create a new sequence in a session."""
    session = await _get_session(db, session_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add sequences to a running or completed session",
        )

    # Determine order index
    if data.order_index is not None:
        order_index = data.order_index
    else:
        # Get max order index and add 1
        result = await db.execute(
            select(func.max(Sequence.order_index))
            .where(Sequence.session_id == session_id)
        )
        max_index = result.scalar()
        order_index = (max_index or -1) + 1

    # Create sequence
    sequence = Sequence(
        session_id=session_id,
        name=data.name,
        description=data.description,
        order_index=order_index,
        duration_type=data.duration_type,
        duration_ms=data.duration_ms,
        duration_fallback_ms=data.duration_fallback_ms,
        transition_ms=data.transition_ms,
    )
    db.add(sequence)
    await db.flush()

    # Create actions
    for action_data in data.actions:
        action = Action(
            sequence_id=sequence.id,
            service_id=action_data.service_id,
            action_type=action_data.action_type,
            command=action_data.command,
            parameters=action_data.parameters,
            delay_ms=action_data.delay_ms,
            on_failure=action_data.on_failure,
        )
        db.add(action)

    await db.commit()
    await db.refresh(sequence)

    return _sequence_to_response(sequence)


@router.get(
    "/{sequence_id}",
    response_model=SequenceDetailResponse,
    summary="Get Sequence",
)
async def get_sequence(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
) -> SequenceDetailResponse:
    """Get a sequence by ID with its actions."""
    sequence = await _get_sequence(db, session_id, sequence_id)

    return SequenceDetailResponse(
        id=sequence.id,
        session_id=sequence.session_id,
        name=sequence.name,
        description=sequence.description,
        order_index=sequence.order_index,
        duration_type=sequence.duration_type.value,
        duration_ms=sequence.duration_ms,
        duration_fallback_ms=sequence.duration_fallback_ms,
        transition_ms=sequence.transition_ms,
        node_editor_data=sequence.node_editor_data,
        total_actions=sequence.total_actions,
        created_at=sequence.created_at,
        updated_at=sequence.updated_at,
        actions=[_action_to_response(a) for a in sequence.actions],
    )


@router.patch(
    "/{sequence_id}",
    response_model=SequenceResponse,
    summary="Update Sequence",
)
async def update_sequence(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
    data: SequenceUpdate,
) -> SequenceResponse:
    """Update a sequence."""
    session = await _get_session(db, session_id)
    sequence = await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update sequences in a running or completed session",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sequence, field, value)

    await db.commit()
    await db.refresh(sequence)

    return _sequence_to_response(sequence)


@router.delete(
    "/{sequence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Sequence",
)
async def delete_sequence(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
) -> None:
    """Delete a sequence."""
    session = await _get_session(db, session_id)
    sequence = await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete sequences from a running or completed session",
        )

    await db.delete(sequence)
    await db.commit()


@router.post(
    "/reorder",
    response_model=SequenceListResponse,
    summary="Reorder Sequences",
)
async def reorder_sequences(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: SequenceReorderRequest,
) -> SequenceListResponse:
    """Reorder sequences in a session."""
    session = await _get_session(db, session_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reorder sequences in a running or completed session",
        )

    # Update order indices
    for item in data.sequences:
        result = await db.execute(
            select(Sequence).where(
                Sequence.id == item.id,
                Sequence.session_id == session_id,
            )
        )
        sequence = result.scalar_one_or_none()
        if sequence:
            sequence.order_index = item.order_index

    await db.commit()

    # Return updated list
    result = await db.execute(
        select(Sequence)
        .where(Sequence.session_id == session_id)
        .order_by(Sequence.order_index)
    )
    sequences = result.scalars().all()

    return SequenceListResponse(
        items=[_sequence_to_response(s) for s in sequences],
        total=len(sequences),
    )


@router.post(
    "/{sequence_id}/duplicate",
    response_model=SequenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate Sequence",
)
async def duplicate_sequence(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
    data: SequenceDuplicateRequest,
) -> SequenceResponse:
    """Duplicate a sequence with its actions."""
    session = await _get_session(db, session_id)
    original = await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot duplicate sequences in a running or completed session",
        )

    # Get new order index
    result = await db.execute(
        select(func.max(Sequence.order_index))
        .where(Sequence.session_id == session_id)
    )
    max_index = result.scalar()
    new_order_index = (max_index or -1) + 1

    # Create duplicate
    new_name = data.new_name or f"{original.name} (Copy)"
    duplicate = Sequence(
        session_id=session_id,
        name=new_name,
        description=original.description,
        order_index=new_order_index,
        duration_type=original.duration_type,
        duration_ms=original.duration_ms,
        duration_fallback_ms=original.duration_fallback_ms,
        transition_ms=original.transition_ms,
        node_editor_data=original.node_editor_data,
    )
    db.add(duplicate)
    await db.flush()

    # Copy actions if requested
    if data.include_actions:
        for action in original.actions:
            new_action = Action(
                sequence_id=duplicate.id,
                service_id=action.service_id,
                action_type=action.action_type,
                command=action.command,
                parameters=action.parameters,
                delay_ms=action.delay_ms,
                on_failure=action.on_failure,
            )
            db.add(new_action)

    await db.commit()
    await db.refresh(duplicate)

    return _sequence_to_response(duplicate)


# ============================================================================
# Actions sub-routes
# ============================================================================


@router.post(
    "/{sequence_id}/actions",
    response_model=ActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Action",
)
async def create_action(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
    data: ActionCreate,
) -> ActionResponse:
    """Create a new action in a sequence."""
    session = await _get_session(db, session_id)
    sequence = await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add actions to a running or completed session",
        )

    action = Action(
        sequence_id=sequence.id,
        service_id=data.service_id,
        action_type=data.action_type,
        command=data.command,
        parameters=data.parameters,
        delay_ms=data.delay_ms,
        on_failure=data.on_failure,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    return _action_to_response(action)


@router.patch(
    "/{sequence_id}/actions/{action_id}",
    response_model=ActionResponse,
    summary="Update Action",
)
async def update_action(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
    action_id: str,
    data: ActionUpdate,
) -> ActionResponse:
    """Update an action."""
    session = await _get_session(db, session_id)
    await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update actions in a running or completed session",
        )

    result = await db.execute(
        select(Action).where(
            Action.id == action_id,
            Action.sequence_id == sequence_id,
        )
    )
    action = result.scalar_one_or_none()
    if not action:
        raise NotFoundError("Action", action_id)

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)

    await db.commit()
    await db.refresh(action)

    return _action_to_response(action)


@router.delete(
    "/{sequence_id}/actions/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Action",
)
async def delete_action(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    sequence_id: str,
    action_id: str,
) -> None:
    """Delete an action."""
    session = await _get_session(db, session_id)
    await _get_sequence(db, session_id, sequence_id)

    # Check session is editable
    if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete actions from a running or completed session",
        )

    result = await db.execute(
        select(Action).where(
            Action.id == action_id,
            Action.sequence_id == sequence_id,
        )
    )
    action = result.scalar_one_or_none()
    if not action:
        raise NotFoundError("Action", action_id)

    await db.delete(action)
    await db.commit()

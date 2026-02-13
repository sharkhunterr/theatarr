"""Sessions API router for Theatarr."""

import logging
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select, Integer, case
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.api.ws import ws_manager, Channel
from theatarr.database import DbSession
from theatarr.models.action import Action
from theatarr.models.movie import Movie
from theatarr.models.session import MovieSelectionMode, Session, SessionStatus
from theatarr.models.sequence import DurationType, Sequence
from theatarr.models.session_participant import SessionParticipant, InvitationStatus
from theatarr.models.vote import VoteSession, VoteSessionStatus
from theatarr.schemas.session import (
    ActionDetail,
    MovieSelectionMode as MovieSelectionModeSchema,
    MysteryConfig,
    SessionControlAction,
    SessionControlRequest,
    SessionControlResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
    SessionState,
    SessionTimelineResponse,
    SessionUpdate,
    SequenceSummary,
    SequenceWithActions,
    TemplateSummary,
    VoteSessionSummary,
)
from theatarr.services.engine import (
    EngineError,
    SessionNotFoundError,
    SessionNotRunnableError,
    get_engine,
)
from theatarr.services.movie_resolution import (
    MovieResolutionError,
    resolve_mystery_movie,
    resolve_vote_winner,
)
from theatarr.services.movie_sync import ensure_movie_synced

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# Characters for display codes (excluding ambiguous: 0/O, 1/I/L)
_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_display_code() -> str:
    """Generate a 6-character alphanumeric display code."""
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(6))


async def _unique_display_code(db) -> str:
    """Generate a unique display code not already used."""
    for _ in range(20):
        code = _generate_display_code()
        existing = await db.execute(
            select(Session.id).where(Session.display_code == code)
        )
        if not existing.scalar_one_or_none():
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique display code",
    )


def _parse_dt(value: str | datetime | None) -> datetime | None:
    """Parse an ISO date string to datetime, or return as-is if already datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _session_to_response(
    session: Session,
    linked_vote_session: VoteSession | None = None,
    participants_accepted: int = 0,
    participants_total: int = 0,
    actions_count: int = 0,
) -> SessionResponse:
    """Convert Session model to response schema."""
    # Parse mystery config if present
    mystery_config = None
    if session.mystery_config:
        mystery_config = MysteryConfig(**session.mystery_config)

    # Build vote session summary if provided
    vote_summary = None
    if linked_vote_session:
        vote_summary = _vote_session_to_summary(linked_vote_session)

    # Build template summary if present
    template_summary = None
    if session.template:
        template_type = session.template.template_type
        if hasattr(template_type, 'value'):
            template_type = template_type.value
        template_summary = TemplateSummary(
            id=session.template.id,
            name=session.template.name,
            template_type=template_type,
        )

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
        # Movie selection mode fields
        movie_selection_mode=MovieSelectionModeSchema(session.movie_selection_mode),
        movie_resolved=session.movie_resolved,
        movie_resolved_at=session.movie_resolved_at,
        linked_vote_session_id=session.linked_vote_session_id,
        vote_reveal_at=session.vote_reveal_at,
        mystery_reveal_at=session.mystery_reveal_at,
        mystery_config=mystery_config,
        # Template override
        template_id=session.template_id,
        template=template_summary,
        # Enrichment options
        enrichment_options=session.enrichment_options,
        # Display code
        display_code=session.display_code,
        # Enriched fields
        linked_vote_session=vote_summary,
        participants_accepted=participants_accepted,
        participants_total=participants_total,
        actions_count=actions_count,
    )


def _vote_session_to_summary(vs: VoteSession, include_vote_counts: bool = True) -> VoteSessionSummary:
    """Convert VoteSession model to summary schema."""
    movie_options = vs.movie_options

    # Enrich movie_options with vote counts if available
    if include_vote_counts and movie_options and vs.votes is not None:
        vote_counts = vs.get_vote_counts()
        movie_options = [
            {**opt, "vote_count": vote_counts.get(i, 0)}
            for i, opt in enumerate(movie_options)
        ]

    return VoteSessionSummary(
        id=vs.id,
        name=vs.name,
        description=vs.description,
        status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
        total_votes=vs.total_votes,
        is_open=vs.is_open,
        winning_movie_index=vs.winning_movie_index,
        movie_options=movie_options,
        max_votes_per_user=vs.max_votes_per_user,
        allow_multiple_votes=vs.allow_multiple_votes,
        require_token=vs.require_token,
        show_results_during_voting=vs.show_results_during_voting,
        anonymous_voting=vs.anonymous_voting,
        close_when_all_voted=vs.close_when_all_voted,
        opens_at=vs.opens_at,
        closes_at=vs.closes_at,
    )


def _sequence_to_summary(sequence: Sequence) -> SequenceSummary:
    """Convert Sequence model to summary schema."""
    action_types = list({
        a.action_type.value if hasattr(a.action_type, 'value') else a.action_type
        for a in sequence.actions
    })

    # Infer expected_duration_ms for manual sequences from pause_at_ms
    expected_duration_ms = None
    dur_type = sequence.duration_type.value if hasattr(sequence.duration_type, 'value') else sequence.duration_type
    if dur_type == "manual":
        for action in sequence.actions:
            params = action.parameters or {}
            pat = params.get("pause_at_ms")
            if pat is not None:
                pat_int = int(pat)
                if expected_duration_ms is None or pat_int > expected_duration_ms:
                    expected_duration_ms = pat_int
    elif dur_type == "fixed" and sequence.duration_ms:
        expected_duration_ms = sequence.duration_ms

    return SequenceSummary(
        id=sequence.id,
        name=sequence.name,
        order_index=sequence.order_index,
        duration_type=dur_type,
        duration_ms=sequence.duration_ms,
        duration_fallback_ms=sequence.duration_fallback_ms,
        transition_ms=sequence.transition_ms,
        actions_count=len(sequence.actions),
        action_types=action_types,
        expected_duration_ms=expected_duration_ms,
    )


def _count_actions_in_workflow(workflow: dict | None) -> int:
    """Count action nodes in a workflow."""
    if not workflow or not workflow.get("nodes"):
        return 0
    return sum(
        1 for node in workflow.get("nodes", [])
        if node.get("data", {}).get("nodeType") == "action"
    )


def _extract_ordered_actions_from_workflow(workflow: dict) -> list[dict]:
    """Extract action nodes from workflow in execution order (following edges).

    Returns a list of node data dicts, ordered by following edges from 'start'.
    """
    if not workflow or not workflow.get("nodes"):
        return []

    action_nodes = {
        n["id"]: n
        for n in workflow["nodes"]
        if n.get("data", {}).get("nodeType") == "action"
    }

    if not action_nodes:
        return []

    # Build edge map: source -> target
    edges_by_source: dict[str, str] = {}
    for e in workflow.get("edges", []):
        edges_by_source[e["source"]] = e["target"]

    # Follow edges from 'start' to collect ordered action nodes
    ordered = []
    current_id = "start"
    visited: set[str] = set()
    while current_id in edges_by_source and current_id not in visited:
        visited.add(current_id)
        target_id = edges_by_source[current_id]
        if target_id in action_nodes:
            ordered.append(action_nodes[target_id]["data"])
        current_id = target_id

    # Fallback: if edge-following didn't find anything, use all action nodes
    if not ordered:
        ordered = [n["data"] for n in action_nodes.values()]

    return ordered


async def _sync_sequences_from_workflow(
    db,
    session: Session,
    workflow: dict,
) -> None:
    """Auto-generate Sequence + Action records from workflow action nodes.

    Actions with the same block_index are grouped into a single Sequence
    and execute in parallel. Different block_indexes become separate
    Sequences that execute sequentially.
    """
    from collections import defaultdict

    action_datas = _extract_ordered_actions_from_workflow(workflow)

    if not action_datas:
        return

    # Delete existing sequences (cascade deletes actions)
    try:
        existing = list(session.sequences) if session.sequences else []
    except Exception:
        existing = []
    for seq in existing:
        await db.delete(seq)
    if existing:
        await db.flush()

    # Group actions by block_index (actions without block_index get auto-incremented)
    blocks: dict[int, list[dict]] = defaultdict(list)
    auto_block = 0
    for data in action_datas:
        bi = data.get("block_index")
        if bi is None:
            # No block_index = each action is its own block (backward compat)
            bi = auto_block
            auto_block += 1
        else:
            auto_block = max(auto_block, bi + 1)
        blocks[bi].append(data)

    # Create one Sequence per block
    for order_index, block_idx in enumerate(sorted(blocks.keys())):
        block_actions = blocks[block_idx]

        # Sequence name: derived from action types
        name = " + ".join(
            f'{a.get("actionType", "action")}:{a.get("command", "")}'
            for a in block_actions[:3]
        )
        if len(block_actions) > 3:
            name += f" +{len(block_actions) - 3}"

        # Duration: max of individual action durations (parallel = longest wins)
        duration_ms = max(
            (a.get("duration_ms") or a.get("parameters", {}).get("duration_ms") or 0)
            for a in block_actions
        )

        sequence = Sequence(
            session_id=session.id,
            name=name,
            order_index=order_index,
            duration_type=DurationType.FIXED if duration_ms > 0 else DurationType.MANUAL,
            duration_ms=duration_ms if duration_ms > 0 else None,
            duration_fallback_ms=0,
            transition_ms=0,
        )
        db.add(sequence)
        await db.flush()

        for data in block_actions:
            # Inject action_duration_ms into parameters so the display
            # page can auto-remove individual layers before the block ends
            params = dict(data.get("parameters", {}))
            action_dur = data.get("duration_ms") or params.get("duration_ms") or 0
            if action_dur > 0 and len(block_actions) > 1:
                params["action_duration_ms"] = action_dur

            action = Action(
                sequence_id=sequence.id,
                action_type=data.get("actionType", "display"),
                command=data.get("command", ""),
                parameters=params,
                delay_ms=data.get("delay_ms", 0),
                on_failure=data.get("on_failure", "warn"),
                service_id=data.get("service_id"),
            )
            db.add(action)


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

    # Enrich sessions with additional data
    enriched_items = []
    for session in sessions:
        # Get linked vote session if any (with votes for counting)
        linked_vote = None
        if session.linked_vote_session_id:
            vs_result = await db.execute(
                select(VoteSession)
                .where(VoteSession.id == session.linked_vote_session_id)
                .options(selectinload(VoteSession.votes))
            )
            linked_vote = vs_result.scalar_one_or_none()

        # Get participant counts
        participants_result = await db.execute(
            select(
                func.count(SessionParticipant.id).label("total"),
                func.sum(
                    case(
                        (SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value, 1),
                        else_=0
                    )
                ).label("accepted")
            ).where(SessionParticipant.session_id == session.id)
        )
        participant_row = participants_result.first()
        participants_total = participant_row.total if participant_row else 0
        participants_accepted = int(participant_row.accepted or 0) if participant_row else 0

        # Count actions in workflow
        actions_count = _count_actions_in_workflow(session.workflow)

        enriched_items.append(_session_to_response(
            session,
            linked_vote_session=linked_vote,
            participants_accepted=participants_accepted,
            participants_total=participants_total,
            actions_count=actions_count,
        ))

    return SessionListResponse(
        items=enriched_items,
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
    # Prepare mystery config if present
    mystery_config_dict = None
    if data.mystery_config:
        mystery_config_dict = data.mystery_config.model_dump()

    # Auto-sync movie from source if movie_source is provided but movie_id is not
    movie_id = data.movie_id
    if not movie_id and data.movie_source and data.movie_source_id:
        movie_id = await ensure_movie_synced(
            db=db,
            movie_source=data.movie_source,
            movie_source_id=data.movie_source_id,
            movie_poster_url=data.movie_poster_url,
        )

    # Generate unique display code
    display_code = await _unique_display_code(db)

    session = Session(
        name=data.name,
        description=data.description,
        movie_id=movie_id,
        movie_title=data.movie_title,
        movie_poster_url=data.movie_poster_url,
        movie_source_id=data.movie_source_id,
        movie_source=data.movie_source,
        color_palette=data.color_palette,
        scheduled_at=data.scheduled_at,
        auto_resume_enabled=data.auto_resume_enabled,
        workflow=data.workflow,
        status=SessionStatus.SCHEDULED if data.scheduled_at else SessionStatus.DRAFT,
        display_code=display_code,
        # Movie selection mode fields
        movie_selection_mode=data.movie_selection_mode.value,
        vote_reveal_at=data.vote_reveal_at,
        mystery_reveal_at=data.mystery_reveal_at,
        mystery_config=mystery_config_dict,
        # FIXED mode starts as resolved
        movie_resolved=data.movie_selection_mode == MovieSelectionModeSchema.FIXED and data.movie_title is not None,
        # Template override
        template_id=data.template_id,
        # Enrichment options (for deferred enrichment in vote/mystery modes)
        enrichment_options=data.enrichment_options,
    )
    db.add(session)
    await db.flush()  # Get session.id without committing

    # Handle VOTE mode: create inline vote session or link existing
    if data.movie_selection_mode == MovieSelectionModeSchema.VOTE:
        if data.linked_vote_session_id:
            # Link to existing vote session
            result = await db.execute(
                select(VoteSession).where(VoteSession.id == data.linked_vote_session_id)
            )
            vote_session = result.scalar_one_or_none()
            if vote_session:
                session.linked_vote_session_id = vote_session.id
                vote_session.linked_session_id = session.id
        elif data.vote_session_config:
            # Create inline vote session
            vote_config = data.vote_session_config
            # Use session name as vote name (unless explicitly provided)
            vote_name = vote_config.get("name") or data.name
            # Determine initial status
            open_immediately = vote_config.get("open_immediately", False)
            initial_status = VoteSessionStatus.OPEN if open_immediately else VoteSessionStatus.DRAFT

            vote_session = VoteSession(
                name=vote_name,
                description=vote_config.get("description"),
                status=initial_status,
                movie_options=vote_config.get("movie_options", []),
                max_votes_per_user=vote_config.get("max_votes_per_user", 1),
                allow_multiple_votes=vote_config.get("allow_multiple_votes", False),
                require_token=vote_config.get("require_token", True),
                show_results_during_voting=vote_config.get("show_results_during_voting", False),
                anonymous_voting=vote_config.get("anonymous_voting", True),
                close_when_all_voted=vote_config.get("close_when_all_voted", False),
                opens_at=_parse_dt(vote_config.get("opens_at")),
                closes_at=_parse_dt(vote_config.get("closes_at")),
                linked_session_id=session.id,
                created_by=user.id,
            )
            db.add(vote_session)
            await db.flush()
            session.linked_vote_session_id = vote_session.id

    # Create sequences: from explicit sequences or auto-generated from workflow
    if data.sequences:
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
            await db.flush()

            for action_order, action_data in enumerate(seq_data.actions):
                action = Action(
                    sequence_id=sequence.id,
                    action_type=action_data.action_type,
                    command=action_data.command,
                    parameters=action_data.parameters,
                    delay_ms=action_data.delay_ms,
                    on_failure=action_data.on_failure,
                    service_id=action_data.service_id,
                )
                db.add(action)
    elif data.workflow:
        # Auto-generate sequences from workflow action nodes
        await _sync_sequences_from_workflow(db, session, data.workflow)

    await db.commit()
    await db.refresh(session)

    return _session_to_response(session)


@router.get(
    "/{session_id}/timeline",
    response_model=SessionTimelineResponse,
    summary="Get Session Timeline Data",
)
async def get_session_timeline(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionTimelineResponse:
    """Get timeline data with full action details for Gantt view."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    # Build sequences with actions
    sequences = []
    for seq in session.sequences:
        summary = _sequence_to_summary(seq)
        actions = [
            ActionDetail(
                id=a.id,
                action_type=a.action_type.value if hasattr(a.action_type, 'value') else a.action_type,
                command=a.command,
                parameters=a.parameters or {},
                delay_ms=a.delay_ms,
                on_failure=a.on_failure.value if hasattr(a.on_failure, 'value') else a.on_failure,
                service_id=a.service_id,
            )
            for a in seq.actions
        ]
        sequences.append(SequenceWithActions(
            **summary.model_dump(),
            actions=actions,
        ))

    # Fetch movie runtime if linked
    movie_runtime_minutes = None
    if session.movie_id:
        movie_result = await db.execute(select(Movie).where(Movie.id == session.movie_id))
        movie = movie_result.scalar_one_or_none()
        if movie:
            movie_runtime_minutes = movie.runtime_minutes

    return SessionTimelineResponse(
        session_id=session.id,
        movie_runtime_minutes=movie_runtime_minutes,
        sequences=sequences,
    )


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

    # Get linked vote session summary if present
    linked_vote_session = None
    if session.linked_vote_session_id:
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(VoteSession)
            .options(selectinload(VoteSession.votes))
            .where(VoteSession.id == session.linked_vote_session_id)
        )
        vs = result.scalar_one_or_none()
        if vs:
            linked_vote_session = _vote_session_to_summary(vs)

    # Parse mystery config if present
    mystery_config = None
    if session.mystery_config:
        mystery_config = MysteryConfig(**session.mystery_config)

    # Build template summary if present
    template_summary = None
    if session.template:
        template_type = session.template.template_type
        if hasattr(template_type, 'value'):
            template_type = template_type.value
        template_summary = TemplateSummary(
            id=session.template.id,
            name=session.template.name,
            template_type=template_type,
        )

    # Fetch movie runtime if a movie is linked
    movie_runtime_minutes = None
    if session.movie_id:
        movie_result = await db.execute(select(Movie).where(Movie.id == session.movie_id))
        movie = movie_result.scalar_one_or_none()
        if movie:
            movie_runtime_minutes = movie.runtime_minutes

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
        # Movie selection mode fields
        movie_selection_mode=MovieSelectionModeSchema(session.movie_selection_mode),
        movie_resolved=session.movie_resolved,
        movie_resolved_at=session.movie_resolved_at,
        linked_vote_session_id=session.linked_vote_session_id,
        linked_vote_session=linked_vote_session,
        vote_reveal_at=session.vote_reveal_at,
        mystery_reveal_at=session.mystery_reveal_at,
        mystery_config=mystery_config,
        # Template override
        template_id=session.template_id,
        template=template_summary,
        # Enrichment options
        enrichment_options=session.enrichment_options,
        # Display code
        display_code=session.display_code,
        # Movie runtime for timeline proportioning
        movie_runtime_minutes=movie_runtime_minutes,
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

    # Auto-sync movie from source if movie_source is provided but movie_id is not
    if data.movie_source and data.movie_source_id and not data.movie_id:
        synced_movie_id = await ensure_movie_synced(
            db=db,
            movie_source=data.movie_source,
            movie_source_id=data.movie_source_id,
            movie_poster_url=data.movie_poster_url,
        )
        if synced_movie_id:
            session.movie_id = synced_movie_id

    # Extract non-model fields before the generic setattr loop
    update_data = data.model_dump(
        exclude_unset=True,
        exclude={"sequences", "vote_session_config"},
    )

    # Convert enum to string value for DB storage
    if "movie_selection_mode" in update_data and update_data["movie_selection_mode"] is not None:
        mode = update_data["movie_selection_mode"]
        update_data["movie_selection_mode"] = mode.value if hasattr(mode, "value") else mode

    # Convert MysteryConfig Pydantic model to dict for JSON column
    if "mystery_config" in update_data and update_data["mystery_config"] is not None:
        mc = update_data["mystery_config"]
        if hasattr(mc, "model_dump"):
            update_data["mystery_config"] = mc.model_dump()

    for field, value in update_data.items():
        setattr(session, field, value)

    # Flag JSON fields as modified for SQLAlchemy to detect changes
    if "workflow" in update_data:
        flag_modified(session, "workflow")
    if "color_palette" in update_data:
        flag_modified(session, "color_palette")
    if "enrichment_options" in update_data:
        flag_modified(session, "enrichment_options")
    if "mystery_config" in update_data:
        flag_modified(session, "mystery_config")

    # Handle VOTE mode: create/update inline vote session
    if data.vote_session_config is not None:
        vote_config = data.vote_session_config
        if session.linked_vote_session_id:
            # Update existing vote session
            vs_result = await db.execute(
                select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
            )
            vote_session = vs_result.scalar_one_or_none()
            if vote_session:
                if "name" in vote_config:
                    vote_session.name = vote_config["name"]
                if "description" in vote_config:
                    vote_session.description = vote_config["description"]
                if "movie_options" in vote_config:
                    vote_session.movie_options = vote_config["movie_options"]
                    flag_modified(vote_session, "movie_options")
                if "max_votes_per_user" in vote_config:
                    vote_session.max_votes_per_user = vote_config["max_votes_per_user"]
                if "allow_multiple_votes" in vote_config:
                    vote_session.allow_multiple_votes = vote_config["allow_multiple_votes"]
                if "require_token" in vote_config:
                    vote_session.require_token = vote_config["require_token"]
                if "show_results_during_voting" in vote_config:
                    vote_session.show_results_during_voting = vote_config["show_results_during_voting"]
                if "anonymous_voting" in vote_config:
                    vote_session.anonymous_voting = vote_config["anonymous_voting"]
                if "close_when_all_voted" in vote_config:
                    vote_session.close_when_all_voted = vote_config["close_when_all_voted"]
                if "opens_at" in vote_config:
                    vote_session.opens_at = _parse_dt(vote_config["opens_at"])
                if "closes_at" in vote_config:
                    vote_session.closes_at = _parse_dt(vote_config["closes_at"])
                if vote_config.get("open_immediately") and vote_session.status == VoteSessionStatus.DRAFT.value:
                    vote_session.status = VoteSessionStatus.OPEN
        else:
            # Create new inline vote session
            vote_name = vote_config.get("name") or session.name
            open_immediately = vote_config.get("open_immediately", False)
            initial_status = VoteSessionStatus.OPEN if open_immediately else VoteSessionStatus.DRAFT

            vote_session = VoteSession(
                name=vote_name,
                description=vote_config.get("description"),
                status=initial_status,
                movie_options=vote_config.get("movie_options", []),
                max_votes_per_user=vote_config.get("max_votes_per_user", 1),
                allow_multiple_votes=vote_config.get("allow_multiple_votes", False),
                require_token=vote_config.get("require_token", True),
                show_results_during_voting=vote_config.get("show_results_during_voting", False),
                anonymous_voting=vote_config.get("anonymous_voting", True),
                close_when_all_voted=vote_config.get("close_when_all_voted", False),
                opens_at=_parse_dt(vote_config.get("opens_at")),
                closes_at=_parse_dt(vote_config.get("closes_at")),
                linked_session_id=session.id,
                created_by=user.id,
            )
            db.add(vote_session)
            await db.flush()
            session.linked_vote_session_id = vote_session.id

    # Handle sequences update: from explicit sequences or auto-generated from workflow
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
            await db.flush()

            for action_order, action_data in enumerate(seq_data.actions):
                action = Action(
                    sequence_id=sequence.id,
                    action_type=action_data.action_type,
                    command=action_data.command,
                    parameters=action_data.parameters,
                    delay_ms=action_data.delay_ms,
                    on_failure=action_data.on_failure,
                    service_id=action_data.service_id,
                )
                db.add(action)
    elif "workflow" in update_data and update_data["workflow"]:
        # Auto-generate sequences from workflow action nodes
        await _sync_sequences_from_workflow(db, session, update_data["workflow"])

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
    """Delete a session and all associated data (vote session, participants, etc.)."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    # Auto-stop active sessions before deleting
    if session.is_active:
        engine = get_engine()
        try:
            await engine.stop_session(session_id)
            # Refresh session after stop
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
        except Exception:
            logger.warning("Failed to stop session %s before delete, forcing cleanup", session_id)
    else:
        # Cancel any orphaned engine task even if session isn't "active"
        engine = get_engine()
        if session_id in engine._running_sessions:
            engine._running_sessions[session_id].cancel()
            del engine._running_sessions[session_id]
            logger.info("Cancelled orphaned engine task for session %s", session_id)

    # Store linked vote session id before clearing reference
    linked_vote_session_id = session.linked_vote_session_id

    # Delete participants first (to avoid FK constraint issues)
    from theatarr.models.session_participant import SessionParticipant
    participants_result = await db.execute(
        select(SessionParticipant).where(SessionParticipant.session_id == session_id)
    )
    for participant in participants_result.scalars().all():
        await db.delete(participant)

    # Clear the session's reference to vote session
    session.linked_vote_session_id = None
    await db.flush()

    # Delete linked vote session if present
    if linked_vote_session_id:
        vote_result = await db.execute(
            select(VoteSession).where(VoteSession.id == linked_vote_session_id)
        )
        linked_vote = vote_result.scalar_one_or_none()
        if linked_vote:
            # Clear vote session's reference to this session
            linked_vote.linked_session_id = None
            await db.flush()
            # Now delete the vote session
            await db.delete(linked_vote)

    # Delete session (sequences deleted via cascade="all, delete-orphan")
    await db.delete(session)
    await db.commit()


@router.post(
    "/{session_id}/duplicate",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate Session",
)
async def duplicate_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionResponse:
    """Duplicate a session as a new draft (no scheduled date)."""
    result = await db.execute(
        select(Session)
        .options(
            selectinload(Session.sequences).selectinload(Sequence.actions),
        )
        .where(Session.id == session_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise NotFoundError("Session", session_id)

    display_code = await _unique_display_code(db)

    new_session = Session(
        name=f"{source.name} (copie)",
        description=source.description,
        movie_id=source.movie_id,
        movie_title=source.movie_title,
        movie_poster_url=source.movie_poster_url,
        movie_source_id=source.movie_source_id,
        movie_source=source.movie_source,
        color_palette=source.color_palette,
        status=SessionStatus.DRAFT,
        scheduled_at=None,
        auto_resume_enabled=source.auto_resume_enabled,
        workflow=source.workflow,
        display_code=display_code,
        movie_selection_mode=source.movie_selection_mode,
        movie_resolved=source.movie_selection_mode == MovieSelectionMode.FIXED.value and source.movie_title is not None,
        template_id=source.template_id,
        enrichment_options=source.enrichment_options,
    )
    db.add(new_session)
    await db.flush()

    # Duplicate sequences and actions
    for seq in sorted(source.sequences, key=lambda s: s.order_index):
        new_seq = Sequence(
            session_id=new_session.id,
            name=seq.name,
            description=seq.description,
            order_index=seq.order_index,
            duration_type=DurationType(seq.duration_type) if isinstance(seq.duration_type, str) else seq.duration_type,
            duration_ms=seq.duration_ms,
            duration_fallback_ms=seq.duration_fallback_ms,
            transition_ms=seq.transition_ms,
        )
        db.add(new_seq)
        await db.flush()

        for action in seq.actions:
            new_action = Action(
                sequence_id=new_seq.id,
                action_type=action.action_type,
                command=action.command,
                parameters=action.parameters,
                delay_ms=action.delay_ms,
                on_failure=action.on_failure,
                service_id=action.service_id,
            )
            db.add(new_action)

    await db.commit()
    await db.refresh(new_session)

    return _session_to_response(new_session)


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
    engine = get_engine()

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
    engine = get_engine()

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


@router.get(
    "/{session_id}/action-log",
    summary="Get Session Action Log",
)
async def get_session_action_log(
    user: AdminUser,
    session_id: str,
) -> list[dict]:
    """Get the in-memory action execution log for a session.

    Returns the last 100 action results with success/failure status,
    timing, and error messages. Only available for sessions that have
    been running in the current engine lifecycle.
    """
    engine = get_engine()
    return engine.get_action_log(session_id)


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


# ============================================================================
# Movie Selection Mode endpoints
# ============================================================================


@router.post(
    "/{session_id}/reveal-mystery",
    response_model=SessionResponse,
    summary="Reveal Mystery Movie",
)
async def reveal_mystery_movie(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionResponse:
    """Manually reveal the mystery movie before scheduled time."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    if session.movie_selection_mode != MovieSelectionMode.MYSTERY.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not in mystery mode",
        )

    if session.movie_resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movie has already been revealed",
        )

    try:
        session = await resolve_mystery_movie(db, session)
    except MovieResolutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Broadcast movie resolved event
    await ws_manager.broadcast(
        Channel.SESSION.value,
        {
            "type": "movie_resolved",
            "payload": {
                "session_id": session.id,
                "movie_title": session.movie_title,
                "movie_poster_url": session.movie_poster_url,
                "selection_mode": "mystery",
            },
        },
    )

    return _session_to_response(session)


@router.post(
    "/{session_id}/resolve-vote",
    response_model=SessionResponse,
    summary="Resolve Vote Result",
)
async def resolve_vote_result(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> SessionResponse:
    """Manually resolve the vote result and apply winning movie to session."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise NotFoundError("Session", session_id)

    if session.movie_selection_mode != MovieSelectionMode.VOTE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not in vote mode",
        )

    if session.movie_resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movie has already been resolved",
        )

    if not session.linked_vote_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has no linked vote session",
        )

    try:
        session = await resolve_vote_winner(db, session)
    except MovieResolutionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Broadcast movie resolved event
    await ws_manager.broadcast(
        Channel.SESSION.value,
        {
            "type": "movie_resolved",
            "payload": {
                "session_id": session.id,
                "movie_title": session.movie_title,
                "movie_poster_url": session.movie_poster_url,
                "selection_mode": "vote",
            },
        },
    )

    return _session_to_response(session)


# ============================================================================
# Session Participants endpoints
# ============================================================================


@router.get(
    "/{session_id}/participants",
    summary="List Session Participants",
)
async def list_session_participants(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> dict:
    """List all participants for a session."""
    from theatarr.models.session_participant import SessionParticipant
    from theatarr.models.user import User

    # Check session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Session", session_id)

    # Get participants with user info
    query = (
        select(SessionParticipant, User)
        .join(User)
        .where(SessionParticipant.session_id == session_id)
        .order_by(SessionParticipant.invited_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for participant, participant_user in rows:
        items.append({
            "id": participant.id,
            "user_id": participant.user_id,
            "username": participant_user.username,
            "first_name": participant_user.first_name,
            "last_name": participant_user.last_name,
            "email": participant_user.email,
            "invitation_status": participant.invitation_status,
            "invited_at": participant.invited_at.isoformat() if participant.invited_at else None,
            "responded_at": participant.responded_at.isoformat() if participant.responded_at else None,
        })

    return {"items": items, "total": len(items)}


@router.post(
    "/{session_id}/participants",
    status_code=status.HTTP_201_CREATED,
    summary="Add Session Participants",
)
async def add_session_participants(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    user_ids: list[str],
) -> dict:
    """Add participants to a session."""
    from datetime import datetime, timezone
    from theatarr.models.session_participant import SessionParticipant, InvitationStatus
    from theatarr.models.user import User

    # Check session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise NotFoundError("Session", session_id)

    added = []
    auto_accepted = []
    now = datetime.now(timezone.utc)

    for uid in user_ids:
        # Check user exists
        user_result = await db.execute(select(User).where(User.id == uid))
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            continue

        # Check if already a participant
        existing = await db.execute(
            select(SessionParticipant).where(
                SessionParticipant.session_id == session_id,
                SessionParticipant.user_id == uid,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Check if user has auto_accept_invitations enabled
        if target_user.auto_accept_invitations:
            invitation_status = InvitationStatus.ACCEPTED.value
            responded_at = now
            auto_accepted.append(uid)
        else:
            invitation_status = InvitationStatus.PENDING.value
            responded_at = None

        # Create participant
        participant = SessionParticipant(
            session_id=session_id,
            user_id=uid,
            invitation_status=invitation_status,
            invited_at=now,
            responded_at=responded_at,
        )
        db.add(participant)
        added.append(uid)

    await db.commit()

    return {"added": added, "auto_accepted": auto_accepted, "count": len(added)}


@router.delete(
    "/{session_id}/participants/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Session Participant",
)
async def remove_session_participant(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    user_id: str,
) -> None:
    """Remove a participant from a session."""
    from theatarr.models.session_participant import SessionParticipant

    result = await db.execute(
        select(SessionParticipant).where(
            SessionParticipant.session_id == session_id,
            SessionParticipant.user_id == user_id,
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise NotFoundError("Session participant", f"{session_id}/{user_id}")

    await db.delete(participant)
    await db.commit()

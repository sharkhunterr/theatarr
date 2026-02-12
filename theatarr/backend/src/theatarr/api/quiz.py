"""Quiz API router for Theatarr."""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.api.ws import ws_manager, Channel
from theatarr.database import DbSession
from theatarr.models.quiz import QuizAnswer, QuizSession, QuizSessionStatus, QuizToken
from theatarr.models.user import User
from theatarr.schemas.quiz import (
    QuizAnswerResponse,
    QuizAnswerSubmit,
    QuizDisplayState,
    QuizJoin,
    QuizResultsResponse,
    QuizScoreboardEntry,
    QuizSessionCreate,
    QuizSessionListResponse,
    QuizSessionPublicResponse,
    QuizSessionResponse,
    QuizSessionUpdate,
    QuizTokenCreate,
    QuizTokenListResponse,
    QuizTokenResponse,
)
from theatarr.services.quiz import (
    advance_question,
    create_quiz_tokens,
    end_quiz,
    get_participant_score,
    get_question_stats,
    get_scoreboard,
    join_quiz,
    open_quiz,
    start_quiz,
    submit_answer,
    validate_quiz_token,
)

router = APIRouter(tags=["Quiz"])


def _quiz_session_to_response(
    qs: QuizSession,
    participant_count: int | None = None,
    template_name: str | None = None,
) -> QuizSessionResponse:
    """Convert QuizSession model to response schema."""
    questions = qs.questions or []
    p_count = participant_count if participant_count is not None else len(qs.tokens) if hasattr(qs, 'tokens') and qs.tokens else 0
    return QuizSessionResponse(
        id=qs.id,
        name=qs.name,
        description=qs.description,
        status=qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status,
        questions=questions,
        config=qs.config,
        current_question_index=qs.current_question_index,
        question_count=len(questions),
        participant_count=p_count,
        template_id=qs.template_id,
        template_name=template_name,
        started_at=qs.started_at,
        ended_at=qs.ended_at,
        created_at=qs.created_at,
        updated_at=qs.updated_at,
    )


def _token_to_response(token: QuizToken, base_url: str = "") -> QuizTokenResponse:
    """Convert QuizToken model to response schema."""
    quiz_url = f"{base_url}/quiz/{token.token}" if base_url else None
    return QuizTokenResponse(
        id=token.id,
        token=token.token,
        label=token.label,
        participant_name=token.participant_name,
        is_active=token.is_active,
        joined_at=token.joined_at,
        quiz_url=quiz_url,
    )


def _build_public_question(question: dict, config: dict | None = None) -> dict:
    """Build a public question dict (without correct_indices)."""
    return {
        "text": question.get("text", ""),
        "choices": question.get("choices", []),
        "allow_multiple": question.get("allow_multiple", False),
        "time_limit_seconds": question.get("time_limit_seconds") or (config or {}).get("default_time_limit_seconds", 30),
        "hint": question.get("hint"),
        "image_url": question.get("image_url"),
    }


logger = logging.getLogger(__name__)

# Track pending delayed advance tasks to avoid duplicates
_pending_advance_tasks: dict[str, asyncio.Task] = {}


async def _delayed_advance_question(quiz_session_id: str, delay: float) -> None:
    """Wait for feedback delay, then advance to next question."""
    try:
        await asyncio.sleep(delay)

        from theatarr.database import async_session_maker

        async with async_session_maker() as db:
            result = await db.execute(
                select(QuizSession)
                .options(selectinload(QuizSession.tokens))
                .where(QuizSession.id == quiz_session_id)
            )
            qs = result.scalar_one_or_none()
            if not qs:
                return

            qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
            if qs_status != QuizSessionStatus.ACTIVE.value:
                return

            questions = qs.questions or []
            config = qs.config or {}
            qs, is_ended = await advance_question(db, qs)

            if is_ended:
                scoreboard = await get_scoreboard(db, qs.id)
                all_stats = await get_question_stats(db, qs.id)
                await ws_manager.broadcast(
                    f"{Channel.QUIZ.value}:{qs.id}",
                    {
                        "type": "quiz_ended",
                        "payload": {
                            "quiz_session_id": qs.id,
                            "scoreboard": scoreboard,
                            "question_stats": all_stats,
                        },
                    },
                )
            else:
                new_index = qs.current_question_index
                if new_index < len(questions):
                    new_question = _build_public_question(questions[new_index], config)
                    await ws_manager.broadcast(
                        f"{Channel.QUIZ.value}:{qs.id}",
                        {
                            "type": "quiz_question",
                            "payload": {
                                "quiz_session_id": qs.id,
                                "question_index": new_index,
                                "question": new_question,
                                "total_questions": len(questions),
                            },
                        },
                    )
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("Error in delayed quiz advance for %s", quiz_session_id)
    finally:
        _pending_advance_tasks.pop(quiz_session_id, None)


def _schedule_delayed_advance(quiz_session_id: str, delay: float) -> None:
    """Schedule a delayed advance, cancelling any previous pending one."""
    existing = _pending_advance_tasks.get(quiz_session_id)
    if existing and not existing.done():
        existing.cancel()
    task = asyncio.create_task(_delayed_advance_question(quiz_session_id, delay))
    _pending_advance_tasks[quiz_session_id] = task


async def _check_auto_advance(db: DbSession, qs: QuizSession) -> None:
    """If auto_advance is enabled and all participants answered, advance to next question."""
    config = qs.config or {}
    if not config.get("auto_advance", False):
        return

    qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
    if qs_status != QuizSessionStatus.ACTIVE.value:
        return

    current_idx = qs.current_question_index
    questions = qs.questions or []
    if current_idx < 0 or current_idx >= len(questions):
        return

    # Count joined participants
    joined_result = await db.execute(
        select(QuizToken).where(
            QuizToken.quiz_session_id == qs.id,
            QuizToken.joined_at.isnot(None),
        )
    )
    joined_tokens = joined_result.scalars().all()
    if not joined_tokens:
        return

    # Count answers for current question
    answer_count_result = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.quiz_session_id == qs.id,
            QuizAnswer.question_index == current_idx,
        )
    )
    answer_count = len(answer_count_result.scalars().all())

    if answer_count < len(joined_tokens):
        return

    # All answered — check feedback config
    show_feedback = config.get("show_feedback", True)
    feedback_delay = config.get("feedback_delay_seconds", 5)
    prev_question = questions[current_idx]

    if show_feedback:
        # Broadcast results, then schedule delayed advance
        q_stats = await get_question_stats(db, qs.id, current_idx)
        await ws_manager.broadcast(
            f"{Channel.QUIZ.value}:{qs.id}",
            {
                "type": "quiz_question_results",
                "payload": {
                    "quiz_session_id": qs.id,
                    "question_index": current_idx,
                    "correct_indices": prev_question.get("correct_indices", []),
                    "stats": q_stats[0] if q_stats else None,
                    "feedback_delay_seconds": feedback_delay,
                },
            },
        )
        _schedule_delayed_advance(qs.id, feedback_delay)
    else:
        # No feedback — advance immediately
        qs, is_ended = await advance_question(db, qs)

        if is_ended:
            scoreboard = await get_scoreboard(db, qs.id)
            all_stats = await get_question_stats(db, qs.id)
            await ws_manager.broadcast(
                f"{Channel.QUIZ.value}:{qs.id}",
                {
                    "type": "quiz_ended",
                    "payload": {
                        "quiz_session_id": qs.id,
                        "scoreboard": scoreboard,
                        "question_stats": all_stats,
                    },
                },
            )
        else:
            new_index = qs.current_question_index
            if new_index < len(questions):
                new_question = _build_public_question(questions[new_index], config)
                await ws_manager.broadcast(
                    f"{Channel.QUIZ.value}:{qs.id}",
                    {
                        "type": "quiz_question",
                        "payload": {
                            "quiz_session_id": qs.id,
                            "question_index": new_index,
                            "question": new_question,
                            "total_questions": len(questions),
                        },
                    },
                )


# ============================================================================
# Admin Routes (require authentication)
# ============================================================================


@router.get(
    "/quiz-sessions",
    response_model=QuizSessionListResponse,
    summary="List Quiz Sessions",
)
async def list_quiz_sessions(
    db: DbSession,
    user: AdminUser,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> QuizSessionListResponse:
    """List all quiz sessions (admin only)."""
    query = select(QuizSession).options(selectinload(QuizSession.tokens))

    if status_filter:
        query = query.where(QuizSession.status == status_filter)

    query = query.order_by(QuizSession.created_at.desc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Get total count
    count_query = select(QuizSession)
    if status_filter:
        count_query = count_query.where(QuizSession.status == status_filter)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return QuizSessionListResponse(
        items=[_quiz_session_to_response(qs) for qs in sessions],
        total=total,
    )


@router.post(
    "/quiz-sessions",
    response_model=QuizSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Quiz Session",
)
async def create_quiz_session(
    db: DbSession,
    user: AdminUser,
    data: QuizSessionCreate,
) -> QuizSessionResponse:
    """Create a new quiz session (admin only)."""
    quiz_session = QuizSession(
        name=data.name,
        description=data.description,
        status=QuizSessionStatus.DRAFT,
        questions=[q.model_dump() for q in data.questions],
        config=data.config.model_dump(),
        template_id=data.template_id,
        created_by=user.id,
    )
    db.add(quiz_session)
    await db.commit()

    # Re-fetch with tokens relationship loaded
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == quiz_session.id)
    )
    quiz_session = result.scalar_one()

    return _quiz_session_to_response(quiz_session)


@router.get(
    "/quiz-sessions/{session_id}",
    response_model=QuizSessionResponse,
    summary="Get Quiz Session",
)
async def get_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizSessionResponse:
    """Get a quiz session by ID (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    return _quiz_session_to_response(quiz_session)


@router.patch(
    "/quiz-sessions/{session_id}",
    response_model=QuizSessionResponse,
    summary="Update Quiz Session",
)
async def update_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: QuizSessionUpdate,
) -> QuizSessionResponse:
    """Update a quiz session (admin only, DRAFT status only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    current_status = quiz_session.status.value if isinstance(quiz_session.status, QuizSessionStatus) else quiz_session.status
    if current_status != QuizSessionStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update quiz sessions in DRAFT status",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Handle questions specially
    if "questions" in update_data and update_data["questions"] is not None:
        update_data["questions"] = [
            q.model_dump() if hasattr(q, "model_dump") else q
            for q in update_data["questions"]
        ]

    # Handle config specially
    if "config" in update_data and update_data["config"] is not None:
        config = update_data["config"]
        update_data["config"] = config.model_dump() if hasattr(config, "model_dump") else config

    for field, value in update_data.items():
        setattr(quiz_session, field, value)

    await db.commit()

    # Re-fetch
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one()

    return _quiz_session_to_response(quiz_session)


@router.delete(
    "/quiz-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Quiz Session",
)
async def delete_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> None:
    """Delete a quiz session (admin only)."""
    result = await db.execute(
        select(QuizSession).where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    await db.delete(quiz_session)
    await db.commit()


@router.post(
    "/quiz-sessions/{session_id}/open",
    response_model=QuizSessionResponse,
    summary="Open Quiz Session",
)
async def open_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizSessionResponse:
    """Open a quiz session for participants to join (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    try:
        quiz_session = await open_quiz(db, quiz_session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return _quiz_session_to_response(quiz_session)


@router.post(
    "/quiz-sessions/{session_id}/start",
    response_model=QuizSessionResponse,
    summary="Start Quiz Session",
)
async def start_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizSessionResponse:
    """Start the quiz — present first question (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    try:
        quiz_session = await start_quiz(db, quiz_session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Broadcast quiz started with first question
    questions = quiz_session.questions or []
    if questions:
        first_question = _build_public_question(questions[0], quiz_session.config)
        await ws_manager.broadcast(
            f"{Channel.QUIZ.value}:{session_id}",
            {
                "type": "quiz_started",
                "payload": {
                    "quiz_session_id": session_id,
                    "question_index": 0,
                    "question": first_question,
                    "total_questions": len(questions),
                },
            },
        )

    return _quiz_session_to_response(quiz_session)


@router.post(
    "/quiz-sessions/{session_id}/next-question",
    response_model=QuizSessionResponse,
    summary="Next Question",
)
async def next_question(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizSessionResponse:
    """Advance to the next question (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    # Before advancing, broadcast results for the current question
    prev_index = quiz_session.current_question_index
    questions = quiz_session.questions or []
    config = quiz_session.config or {}
    show_feedback = config.get("show_feedback", True)
    feedback_delay = config.get("feedback_delay_seconds", 5)

    if 0 <= prev_index < len(questions) and show_feedback:
        prev_question = questions[prev_index]
        q_stats = await get_question_stats(db, session_id, prev_index)
        await ws_manager.broadcast(
            f"{Channel.QUIZ.value}:{session_id}",
            {
                "type": "quiz_question_results",
                "payload": {
                    "quiz_session_id": session_id,
                    "question_index": prev_index,
                    "correct_indices": prev_question.get("correct_indices", []),
                    "stats": q_stats[0] if q_stats else None,
                    "feedback_delay_seconds": feedback_delay,
                },
            },
        )
        # Schedule delayed advance instead of immediate
        _schedule_delayed_advance(session_id, feedback_delay)

        # Return current state (advance will happen after delay)
        return _quiz_session_to_response(quiz_session)

    # No feedback — advance immediately
    try:
        quiz_session, is_ended = await advance_question(db, quiz_session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if is_ended:
        scoreboard = await get_scoreboard(db, session_id)
        all_stats = await get_question_stats(db, session_id)
        await ws_manager.broadcast(
            f"{Channel.QUIZ.value}:{session_id}",
            {
                "type": "quiz_ended",
                "payload": {
                    "quiz_session_id": session_id,
                    "scoreboard": scoreboard,
                    "question_stats": all_stats,
                },
            },
        )
    else:
        new_index = quiz_session.current_question_index
        if new_index < len(questions):
            new_question = _build_public_question(questions[new_index], config)
            await ws_manager.broadcast(
                f"{Channel.QUIZ.value}:{session_id}",
                {
                    "type": "quiz_question",
                    "payload": {
                        "quiz_session_id": session_id,
                        "question_index": new_index,
                        "question": new_question,
                        "total_questions": len(questions),
                    },
                },
            )

    # Re-fetch to get updated state
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one()

    return _quiz_session_to_response(quiz_session)


@router.post(
    "/quiz-sessions/{session_id}/end",
    response_model=QuizSessionResponse,
    summary="End Quiz Session",
)
async def end_quiz_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizSessionResponse:
    """End the quiz early (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    try:
        quiz_session = await end_quiz(db, quiz_session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Broadcast quiz ended
    scoreboard = await get_scoreboard(db, session_id)
    all_stats = await get_question_stats(db, session_id)
    await ws_manager.broadcast(
        f"{Channel.QUIZ.value}:{session_id}",
        {
            "type": "quiz_ended",
            "payload": {
                "quiz_session_id": session_id,
                "scoreboard": scoreboard,
                "question_stats": all_stats,
            },
        },
    )

    return _quiz_session_to_response(quiz_session)


@router.get(
    "/quiz-sessions/{session_id}/results",
    response_model=QuizResultsResponse,
    summary="Get Quiz Results",
)
async def get_quiz_results(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> QuizResultsResponse:
    """Get quiz results with scoreboard and stats (admin only)."""
    result = await db.execute(
        select(QuizSession).where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    scoreboard = await get_scoreboard(db, session_id)
    all_stats = await get_question_stats(db, session_id)

    return QuizResultsResponse(
        quiz_session_id=session_id,
        status=quiz_session.status.value if isinstance(quiz_session.status, QuizSessionStatus) else quiz_session.status,
        question_count=len(quiz_session.questions or []),
        scoreboard=[QuizScoreboardEntry(**entry) for entry in scoreboard],
        question_stats=all_stats,
    )


@router.get(
    "/quiz-sessions/{session_id}/display-state",
    response_model=QuizDisplayState,
    summary="Get Quiz Display State",
)
async def get_quiz_display_state(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    request: Request,
) -> QuizDisplayState:
    """Get full quiz state for display/kiosk rendering (admin only)."""
    result = await db.execute(
        select(QuizSession)
        .options(selectinload(QuizSession.tokens))
        .where(QuizSession.id == session_id)
    )
    qs = result.scalar_one_or_none()
    if not qs:
        raise NotFoundError("QuizSession", session_id)

    qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
    questions = qs.questions or []
    current_idx = qs.current_question_index
    config = qs.config or {}

    # Determine phase
    if qs_status == QuizSessionStatus.COMPLETED.value:
        phase = "podium"
    elif qs_status == QuizSessionStatus.ACTIVE.value and 0 <= current_idx < len(questions):
        phase = "question"
    elif qs_status in (QuizSessionStatus.OPEN.value, QuizSessionStatus.DRAFT.value):
        phase = "waiting"
    else:
        phase = "waiting"

    # Current question (full data for display — includes correct_indices for feedback)
    current_question = None
    correct_indices = None
    if 0 <= current_idx < len(questions):
        q = questions[current_idx]
        current_question = {
            "text": q.get("text", ""),
            "choices": q.get("choices", []),
            "allow_multiple": q.get("allow_multiple", False),
            "time_limit_seconds": q.get("time_limit_seconds") or config.get("default_time_limit_seconds", 30),
            "hint": q.get("hint"),
        }
        correct_indices = q.get("correct_indices", [])

    # Time remaining
    time_remaining = None
    if phase == "question" and current_question and qs.current_question_started_at:
        time_limit = current_question.get("time_limit_seconds", 30)
        elapsed = (datetime.now() - qs.current_question_started_at).total_seconds()
        time_remaining = max(0, time_limit - elapsed)

    # Participants
    joined_tokens = [t for t in (qs.tokens or []) if t.joined_at is not None]
    # Get answer counts for current question
    answer_result = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.quiz_session_id == qs.id,
            QuizAnswer.question_index == current_idx,
        )
    )
    current_answers = answer_result.scalars().all()
    answered_token_ids = {a.token_id for a in current_answers}

    participants = []
    for token in joined_tokens:
        score = await get_participant_score(db, qs.id, token.id)
        participants.append({
            "name": token.participant_name or token.label or "Anonyme",
            "score": score,
            "has_answered_current": token.id in answered_token_ids,
        })

    # Scoreboard
    scoreboard_data = await get_scoreboard(db, qs.id)

    # Answer distribution for current question
    answer_distribution = None
    if current_answers:
        dist: dict[str, int] = {}
        for answer in current_answers:
            for idx in (answer.selected_indices or []):
                key = str(idx)
                dist[key] = dist.get(key, 0) + 1
        answer_distribution = dist

    # Join URL
    base_url = str(request.base_url).rstrip("/")
    frontend_url = base_url.replace(":2273", ":2173")  # Backend → frontend port
    join_url = f"{frontend_url}/portal/quiz/{qs.id}"

    return QuizDisplayState(
        quiz_session_id=qs.id,
        name=qs.name,
        status=qs_status,
        phase=phase,
        current_question_index=current_idx,
        total_questions=len(questions),
        current_question=current_question,
        correct_indices=correct_indices,
        time_remaining_seconds=time_remaining,
        participants=participants,
        scoreboard=scoreboard_data,
        answer_distribution=answer_distribution,
        join_url=join_url,
    )


# ============================================================================
# Token Management (admin)
# ============================================================================


@router.post(
    "/quiz-sessions/{session_id}/tokens",
    response_model=QuizTokenListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Quiz Tokens",
)
async def create_tokens(
    db: DbSession,
    user: AdminUser,
    request: Request,
    session_id: str,
    data: QuizTokenCreate,
) -> QuizTokenListResponse:
    """Create quiz tokens for a session (admin only)."""
    result = await db.execute(
        select(QuizSession).where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()

    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    tokens = await create_quiz_tokens(
        db,
        session_id,
        count=data.count,
        label_prefix=data.label_prefix,
    )

    base_url = str(request.base_url).rstrip("/")

    return QuizTokenListResponse(
        items=[_token_to_response(t, base_url) for t in tokens],
        total=len(tokens),
    )


@router.get(
    "/quiz-sessions/{session_id}/tokens",
    response_model=QuizTokenListResponse,
    summary="List Quiz Tokens",
)
async def list_tokens(
    db: DbSession,
    user: AdminUser,
    request: Request,
    session_id: str,
) -> QuizTokenListResponse:
    """List all tokens for a quiz session (admin only)."""
    result = await db.execute(
        select(QuizToken).where(QuizToken.quiz_session_id == session_id)
    )
    tokens = result.scalars().all()

    base_url = str(request.base_url).rstrip("/")

    return QuizTokenListResponse(
        items=[_token_to_response(t, base_url) for t in tokens],
        total=len(tokens),
    )


@router.delete(
    "/quiz-sessions/{session_id}/tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Quiz Token",
)
async def delete_token(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    token_id: str,
) -> None:
    """Delete a quiz token (admin only)."""
    result = await db.execute(
        select(QuizToken).where(
            QuizToken.id == token_id,
            QuizToken.quiz_session_id == session_id,
        )
    )
    token = result.scalar_one_or_none()

    if not token:
        raise NotFoundError("QuizToken", token_id)

    await db.delete(token)
    await db.commit()


@router.post(
    "/quiz-sessions/{session_id}/invite",
    status_code=status.HTTP_201_CREATED,
    summary="Invite Users to Quiz",
)
async def invite_users_to_quiz(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    user_ids: list[str],
) -> dict:
    """Invite portal users to a quiz session by creating tokens with user_id."""
    result = await db.execute(
        select(QuizSession).where(QuizSession.id == session_id)
    )
    quiz_session = result.scalar_one_or_none()
    if not quiz_session:
        raise NotFoundError("QuizSession", session_id)

    added = []
    for uid in user_ids:
        # Check user exists
        user_result = await db.execute(select(User).where(User.id == uid))
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            continue

        # Check if already has a token for this quiz
        existing = await db.execute(
            select(QuizToken).where(
                QuizToken.quiz_session_id == session_id,
                QuizToken.user_id == uid,
            )
        )
        if existing.scalar_one_or_none():
            continue

        from theatarr.services.quiz import generate_quiz_token
        token_value = generate_quiz_token()

        token = QuizToken(
            quiz_session_id=session_id,
            token=token_value,
            user_id=uid,
            label=target_user.first_name or target_user.username,
        )
        db.add(token)
        added.append(uid)

    await db.commit()

    return {"added": added, "count": len(added)}


# ============================================================================
# Public Routes (for participants, via token)
# ============================================================================


@router.get(
    "/quiz/{token}",
    response_model=QuizSessionPublicResponse,
    summary="Get Quiz Session (Public)",
)
async def get_public_quiz_session(
    db: DbSession,
    token: str,
) -> QuizSessionPublicResponse:
    """Get quiz session info using a quiz token (public)."""
    quiz_token = await validate_quiz_token(db, token)

    if not quiz_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired quiz token",
        )

    qs = quiz_token.quiz_session
    questions = qs.questions or []
    config = qs.config or {}

    # Build current question (without correct_indices)
    current_question = None
    time_remaining = None
    current_idx = qs.current_question_index

    if 0 <= current_idx < len(questions):
        current_question = _build_public_question(questions[current_idx], config)
        # Calculate time remaining
        if qs.current_question_started_at:
            time_limit = questions[current_idx].get("time_limit_seconds") or config.get("default_time_limit_seconds", 30)
            elapsed = (datetime.now() - qs.current_question_started_at).total_seconds()
            time_remaining = max(0, int(time_limit - elapsed))

    # Get participant's score
    my_score = 0
    if quiz_token.joined_at:
        my_score = await get_participant_score(db, qs.id, quiz_token.id)

    # Count participants
    token_result = await db.execute(
        select(QuizToken).where(
            QuizToken.quiz_session_id == qs.id,
            QuizToken.joined_at.isnot(None),
        )
    )
    participant_count = len(token_result.scalars().all())

    # Safe config (no internal settings exposed)
    safe_config = {
        "show_live_results": config.get("show_live_results", "anonymous"),
        "show_scores_live": config.get("show_scores_live", False),
    }

    return QuizSessionPublicResponse(
        id=qs.id,
        name=qs.name,
        description=qs.description,
        status=qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status,
        question_count=len(questions),
        current_question_index=current_idx,
        current_question=current_question,
        time_remaining_seconds=time_remaining,
        config=safe_config,
        participant_count=participant_count,
        participant_name=quiz_token.participant_name,
        my_score=my_score,
    )


@router.post(
    "/quiz/{token}/join",
    response_model=QuizSessionPublicResponse,
    summary="Join Quiz (Public)",
)
async def join_quiz_session(
    db: DbSession,
    token: str,
    data: QuizJoin,
) -> QuizSessionPublicResponse:
    """Join a quiz session with a participant name (public)."""
    quiz_token = await validate_quiz_token(db, token)

    if not quiz_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired quiz token",
        )

    qs = quiz_token.quiz_session
    qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status

    if qs_status not in (QuizSessionStatus.OPEN.value, QuizSessionStatus.ACTIVE.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz is not open for joining",
        )

    quiz_token = await join_quiz(db, quiz_token, data.participant_name)

    # Broadcast participant joined
    token_result = await db.execute(
        select(QuizToken).where(
            QuizToken.quiz_session_id == qs.id,
            QuizToken.joined_at.isnot(None),
        )
    )
    participant_count = len(token_result.scalars().all())

    await ws_manager.broadcast(
        f"{Channel.QUIZ.value}:{qs.id}",
        {
            "type": "quiz_participant_joined",
            "payload": {
                "quiz_session_id": qs.id,
                "participant_name": data.participant_name,
                "participant_count": participant_count,
            },
        },
    )

    # Return the public session view
    return await get_public_quiz_session(db, token)


@router.post(
    "/quiz/{token}/answer",
    response_model=QuizAnswerResponse,
    summary="Submit Answer (Public)",
)
async def submit_quiz_answer(
    db: DbSession,
    token: str,
    data: QuizAnswerSubmit,
) -> QuizAnswerResponse:
    """Submit an answer for the current question (public)."""
    quiz_token = await validate_quiz_token(db, token)

    if not quiz_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired quiz token",
        )

    if not quiz_token.joined_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must join the quiz before answering",
        )

    qs = quiz_token.quiz_session

    try:
        answer = await submit_answer(
            db,
            qs,
            quiz_token,
            question_index=data.question_index,
            selected_indices=data.selected_indices,
            response_time_ms=data.response_time_ms,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Get updated score
    score = await get_participant_score(db, qs.id, quiz_token.id)

    # Broadcast answer submitted (for live results)
    config = qs.config or {}
    show_live = config.get("show_live_results", "anonymous")
    if show_live != "disabled":
        q_stats = await get_question_stats(db, qs.id, data.question_index)
        broadcast_payload: dict = {
            "quiz_session_id": qs.id,
            "question_index": data.question_index,
            "stats": q_stats[0] if q_stats else None,
        }
        if show_live == "named":
            broadcast_payload["participant_name"] = quiz_token.participant_name

        await ws_manager.broadcast(
            f"{Channel.QUIZ.value}:{qs.id}",
            {
                "type": "quiz_answer_submitted",
                "payload": broadcast_payload,
            },
        )

    # Check auto-advance
    await _check_auto_advance(db, qs)

    # Get correct indices for the response
    questions = qs.questions or []
    correct_indices = []
    if data.question_index < len(questions):
        correct_indices = questions[data.question_index].get("correct_indices", [])

    return QuizAnswerResponse(
        is_correct=answer.is_correct,
        correct_indices=correct_indices,
        score=score,
    )

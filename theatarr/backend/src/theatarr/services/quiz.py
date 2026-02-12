"""Quiz service for Theatarr - handles quiz logic, tokens, scoring."""

import secrets
import string
from collections import defaultdict
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from theatarr.models.quiz import QuizAnswer, QuizSession, QuizSessionStatus, QuizToken


def generate_quiz_token(length: int = 8) -> str:
    """Generate a short, URL-safe quiz token."""
    alphabet = "".join(
        c for c in string.ascii_uppercase + string.digits if c not in "0OIL1"
    )
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_quiz_tokens(
    db: AsyncSession,
    quiz_session_id: str,
    count: int = 1,
    label_prefix: str | None = None,
) -> list[QuizToken]:
    """Create multiple quiz tokens."""
    tokens: list[QuizToken] = []

    for i in range(count):
        token_value = generate_quiz_token()

        # Ensure uniqueness
        while True:
            result = await db.execute(
                select(QuizToken).where(QuizToken.token == token_value)
            )
            if not result.scalar_one_or_none():
                break
            token_value = generate_quiz_token()

        label = f"{label_prefix} {i + 1}" if label_prefix else None

        quiz_token = QuizToken(
            quiz_session_id=quiz_session_id,
            token=token_value,
            label=label,
        )
        db.add(quiz_token)
        tokens.append(quiz_token)

    await db.commit()
    for token in tokens:
        await db.refresh(token)

    return tokens


async def validate_quiz_token(
    db: AsyncSession,
    token: str,
) -> QuizToken | None:
    """Validate a quiz token and return it with its session loaded."""
    result = await db.execute(
        select(QuizToken)
        .options(selectinload(QuizToken.quiz_session))
        .where(QuizToken.token == token)
    )
    quiz_token = result.scalar_one_or_none()

    if not quiz_token or not quiz_token.is_valid:
        return None

    return quiz_token


async def join_quiz(
    db: AsyncSession,
    token: QuizToken,
    participant_name: str,
) -> QuizToken:
    """Join a quiz session with a participant name."""
    token.participant_name = participant_name
    token.joined_at = datetime.now()
    await db.commit()
    await db.refresh(token)
    return token


async def open_quiz(
    db: AsyncSession,
    quiz_session: QuizSession,
) -> QuizSession:
    """Open a quiz for participants to join."""
    if quiz_session.status != QuizSessionStatus.DRAFT:
        raise ValueError(f"Cannot open quiz in {quiz_session.status} status")

    quiz_session.status = QuizSessionStatus.OPEN
    await db.commit()
    await db.refresh(quiz_session)
    return quiz_session


async def start_quiz(
    db: AsyncSession,
    quiz_session: QuizSession,
) -> QuizSession:
    """Start the quiz — present first question."""
    if quiz_session.status != QuizSessionStatus.OPEN:
        raise ValueError(f"Cannot start quiz in {quiz_session.status} status")

    if not quiz_session.questions or len(quiz_session.questions) == 0:
        raise ValueError("Quiz has no questions")

    quiz_session.status = QuizSessionStatus.ACTIVE
    quiz_session.current_question_index = 0
    quiz_session.current_question_started_at = datetime.now()
    quiz_session.started_at = datetime.now()
    await db.commit()
    await db.refresh(quiz_session)
    return quiz_session


async def advance_question(
    db: AsyncSession,
    quiz_session: QuizSession,
) -> tuple[QuizSession, bool]:
    """Advance to the next question. Returns (session, is_ended)."""
    if quiz_session.status != QuizSessionStatus.ACTIVE:
        raise ValueError(f"Cannot advance in {quiz_session.status} status")

    next_index = quiz_session.current_question_index + 1

    if next_index >= len(quiz_session.questions or []):
        # Last question — end quiz
        quiz_session = await end_quiz(db, quiz_session)
        return quiz_session, True

    quiz_session.current_question_index = next_index
    quiz_session.current_question_started_at = datetime.now()
    await db.commit()
    await db.refresh(quiz_session)
    return quiz_session, False


async def submit_answer(
    db: AsyncSession,
    quiz_session: QuizSession,
    token: QuizToken,
    question_index: int,
    selected_indices: list[int],
    response_time_ms: int | None = None,
) -> QuizAnswer:
    """Submit an answer for the current question."""
    if quiz_session.status != QuizSessionStatus.ACTIVE:
        raise ValueError("Quiz is not active")

    if question_index != quiz_session.current_question_index:
        raise ValueError("Not the current question")

    # Check not already answered
    existing = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.quiz_session_id == quiz_session.id,
            QuizAnswer.token_id == token.id,
            QuizAnswer.question_index == question_index,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already answered this question")

    # Check correctness
    questions = quiz_session.questions or []
    if question_index >= len(questions):
        raise ValueError("Invalid question index")

    question = questions[question_index]
    correct_indices = set(question.get("correct_indices", []))
    is_correct = set(selected_indices) == correct_indices

    answer = QuizAnswer(
        quiz_session_id=quiz_session.id,
        token_id=token.id,
        question_index=question_index,
        selected_indices=selected_indices,
        is_correct=is_correct,
        answered_at=datetime.now(),
        response_time_ms=response_time_ms,
    )
    db.add(answer)
    await db.commit()
    await db.refresh(answer)
    return answer


async def end_quiz(
    db: AsyncSession,
    quiz_session: QuizSession,
) -> QuizSession:
    """End the quiz."""
    quiz_session.status = QuizSessionStatus.COMPLETED
    quiz_session.ended_at = datetime.now()
    await db.commit()
    await db.refresh(quiz_session)
    return quiz_session


async def get_scoreboard(
    db: AsyncSession,
    quiz_session_id: str,
) -> list[dict]:
    """Get scoreboard sorted by score desc, then avg response time asc."""
    # Get all answers for this quiz
    result = await db.execute(
        select(QuizAnswer)
        .options(selectinload(QuizAnswer.token))
        .where(QuizAnswer.quiz_session_id == quiz_session_id)
    )
    answers = result.scalars().all()

    # Group by token
    by_token: dict[str, list[QuizAnswer]] = defaultdict(list)
    for answer in answers:
        by_token[answer.token_id].append(answer)

    scoreboard = []
    for token_id, token_answers in by_token.items():
        token = token_answers[0].token
        score = sum(1 for a in token_answers if a.is_correct)
        total_answered = len(token_answers)
        times = [a.response_time_ms for a in token_answers if a.response_time_ms]
        avg_time = int(sum(times) / len(times)) if times else None

        display_name = token.participant_name or token.label or "Anonymous"
        scoreboard.append({
            "token_id": token_id,
            "participant_name": display_name,
            "name": display_name,
            "score": score,
            "total_answered": total_answered,
            "avg_response_time_ms": avg_time,
        })

    # Sort: score desc, then avg_time asc (None last)
    scoreboard.sort(key=lambda x: (-x["score"], x["avg_response_time_ms"] or 999999))
    return scoreboard


async def get_question_stats(
    db: AsyncSession,
    quiz_session_id: str,
    question_index: int | None = None,
) -> list[dict]:
    """Get per-question answer distribution."""
    query = select(QuizAnswer).where(
        QuizAnswer.quiz_session_id == quiz_session_id
    )
    if question_index is not None:
        query = query.where(QuizAnswer.question_index == question_index)

    result = await db.execute(query)
    answers = result.scalars().all()

    # Group by question
    by_question: dict[int, list[QuizAnswer]] = defaultdict(list)
    for answer in answers:
        by_question[answer.question_index].append(answer)

    stats = []
    for q_index in sorted(by_question.keys()):
        q_answers = by_question[q_index]
        total = len(q_answers)
        correct_count = sum(1 for a in q_answers if a.is_correct)

        # Choice distribution
        distribution: dict[int, int] = defaultdict(int)
        for a in q_answers:
            for idx in (a.selected_indices or []):
                distribution[idx] += 1

        stats.append({
            "question_index": q_index,
            "total_answers": total,
            "correct_count": correct_count,
            "distribution": dict(distribution),
        })

    return stats


async def get_participant_score(
    db: AsyncSession,
    quiz_session_id: str,
    token_id: str,
) -> int:
    """Get a participant's current score."""
    result = await db.execute(
        select(func.count(QuizAnswer.id)).where(
            QuizAnswer.quiz_session_id == quiz_session_id,
            QuizAnswer.token_id == token_id,
            QuizAnswer.is_correct == True,
        )
    )
    return result.scalar() or 0

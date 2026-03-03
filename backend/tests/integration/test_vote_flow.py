"""Integration tests for complete vote flow."""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.vote import VoteSession, Vote, VoteToken, VoteSessionStatus
from theatarr.services.vote import VoteService


@pytest_asyncio.fixture
async def vote_session(db_session: AsyncSession) -> VoteSession:
    """Create a test vote session."""
    session = VoteSession(
        name="Movie Night Vote",
        description="Choose the movie for tonight",
        status=VoteSessionStatus.OPEN,
        movie_options=[
            {"index": 0, "title": "Movie A", "year": 2023},
            {"index": 1, "title": "Movie B", "year": 2022},
            {"index": 2, "title": "Movie C", "year": 2021},
        ],
        require_token=True,
        opens_at=datetime.now(timezone.utc) - timedelta(hours=1),
        closes_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest_asyncio.fixture
async def vote_token(
    db_session: AsyncSession, vote_session: VoteSession
) -> VoteToken:
    """Create a test vote token."""
    token = VoteToken(
        vote_session_id=vote_session.id,
        token="TEST1234",
        label="Test Token",
        max_uses=5,
        use_count=0,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db_session.add(token)
    await db_session.commit()
    await db_session.refresh(token)
    return token


class TestVoteSessionLifecycle:
    """Tests for vote session lifecycle."""

    @pytest.mark.asyncio
    async def test_create_vote_session(self, db_session: AsyncSession):
        """Test creating a new vote session."""
        service = VoteService(db_session)

        session = await service.create_session(
            name="Test Vote",
            movie_options=[
                {"title": "Movie 1"},
                {"title": "Movie 2"},
            ],
        )

        assert session.id is not None
        assert session.name == "Test Vote"
        assert session.status == VoteSessionStatus.DRAFT
        assert len(session.movie_options) == 2

    @pytest.mark.asyncio
    async def test_open_vote_session(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test opening a vote session for voting."""
        service = VoteService(db_session)

        # Set to draft first
        vote_session.status = VoteSessionStatus.DRAFT
        await db_session.commit()

        opened = await service.open_session(vote_session.id)

        assert opened.status == VoteSessionStatus.OPEN
        assert opened.is_open is True

    @pytest.mark.asyncio
    async def test_close_vote_session(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test closing a vote session."""
        service = VoteService(db_session)

        closed = await service.close_session(vote_session.id)

        assert closed.status == VoteSessionStatus.CLOSED
        assert closed.closed_at is not None


class TestVoteTokenGeneration:
    """Tests for vote token generation."""

    @pytest.mark.asyncio
    async def test_generate_token(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test generating a new vote token."""
        service = VoteService(db_session)

        token = await service.create_token(
            session_id=vote_session.id,
            label="Guest Token",
            max_uses=3,
        )

        assert token.id is not None
        assert token.vote_session_id == vote_session.id
        assert len(token.token) >= 6
        assert token.max_uses == 3

    @pytest.mark.asyncio
    async def test_generate_multiple_tokens(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test generating multiple unique tokens."""
        service = VoteService(db_session)

        tokens = []
        for i in range(5):
            token = await service.create_token(
                session_id=vote_session.id,
                label=f"Guest {i+1}",
            )
            tokens.append(token)

        # All tokens should be unique
        token_values = [t.token for t in tokens]
        assert len(set(token_values)) == 5


class TestVoteCasting:
    """Tests for casting votes."""

    @pytest.mark.asyncio
    async def test_cast_vote_success(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
        vote_token: VoteToken,
    ):
        """Test successfully casting a vote."""
        service = VoteService(db_session)

        vote = await service.cast_vote(
            session_id=vote_session.id,
            movie_index=1,
            token_value=vote_token.token,
        )

        assert vote.id is not None
        assert vote.vote_session_id == vote_session.id
        assert vote.movie_index == 1
        assert vote.token_id == vote_token.id

    @pytest.mark.asyncio
    async def test_cast_vote_increments_token_use(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
        vote_token: VoteToken,
    ):
        """Test that casting vote increments token use count."""
        service = VoteService(db_session)
        initial_count = vote_token.use_count

        await service.cast_vote(
            session_id=vote_session.id,
            movie_index=0,
            token_value=vote_token.token,
        )

        await db_session.refresh(vote_token)
        assert vote_token.use_count == initial_count + 1

    @pytest.mark.asyncio
    async def test_cast_vote_invalid_token(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test casting vote with invalid token fails."""
        service = VoteService(db_session)

        with pytest.raises(Exception) as exc_info:
            await service.cast_vote(
                session_id=vote_session.id,
                movie_index=0,
                token_value="INVALID",
            )

        assert "token" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cast_vote_expired_token(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
        vote_token: VoteToken,
    ):
        """Test casting vote with expired token fails."""
        # Expire the token
        vote_token.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        await db_session.commit()

        service = VoteService(db_session)

        with pytest.raises(Exception) as exc_info:
            await service.cast_vote(
                session_id=vote_session.id,
                movie_index=0,
                token_value=vote_token.token,
            )

        assert "expired" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cast_vote_closed_session(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
        vote_token: VoteToken,
    ):
        """Test casting vote in closed session fails."""
        vote_session.status = VoteSessionStatus.CLOSED
        await db_session.commit()

        service = VoteService(db_session)

        with pytest.raises(Exception) as exc_info:
            await service.cast_vote(
                session_id=vote_session.id,
                movie_index=0,
                token_value=vote_token.token,
            )

        assert "closed" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cast_vote_invalid_movie_index(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
        vote_token: VoteToken,
    ):
        """Test casting vote for invalid movie index fails."""
        service = VoteService(db_session)

        with pytest.raises(Exception):
            await service.cast_vote(
                session_id=vote_session.id,
                movie_index=99,  # Invalid index
                token_value=vote_token.token,
            )


class TestVoteResults:
    """Tests for vote result calculation."""

    @pytest.mark.asyncio
    async def test_get_vote_counts(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
    ):
        """Test getting vote counts per movie."""
        # Add some votes directly
        for i in range(3):
            vote = Vote(
                vote_session_id=vote_session.id,
                movie_index=0,
            )
            db_session.add(vote)

        for i in range(2):
            vote = Vote(
                vote_session_id=vote_session.id,
                movie_index=1,
            )
            db_session.add(vote)

        await db_session.commit()

        service = VoteService(db_session)
        counts = await service.get_vote_counts(vote_session.id)

        assert counts[0] == 3
        assert counts[1] == 2
        assert counts.get(2, 0) == 0

    @pytest.mark.asyncio
    async def test_determine_winner(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
    ):
        """Test determining the winning movie."""
        # Movie 1 gets most votes
        for i in range(5):
            vote = Vote(
                vote_session_id=vote_session.id,
                movie_index=1,
            )
            db_session.add(vote)

        # Movie 0 gets fewer votes
        for i in range(2):
            vote = Vote(
                vote_session_id=vote_session.id,
                movie_index=0,
            )
            db_session.add(vote)

        await db_session.commit()

        service = VoteService(db_session)
        winner_index = await service.determine_winner(vote_session.id)

        assert winner_index == 1

    @pytest.mark.asyncio
    async def test_determine_winner_tie_handling(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
    ):
        """Test handling tie in votes."""
        # Equal votes for movie 0 and 1
        for movie_index in [0, 1]:
            for i in range(3):
                vote = Vote(
                    vote_session_id=vote_session.id,
                    movie_index=movie_index,
                )
                db_session.add(vote)

        await db_session.commit()

        service = VoteService(db_session)
        winner_index = await service.determine_winner(vote_session.id)

        # Should return one of the tied movies (implementation specific)
        assert winner_index in [0, 1]


class TestVoteSessionClosure:
    """Tests for vote session closure and winner assignment."""

    @pytest.mark.asyncio
    async def test_close_and_assign_winner(
        self,
        db_session: AsyncSession,
        vote_session: VoteSession,
    ):
        """Test closing session and assigning winner."""
        # Add votes
        for i in range(5):
            vote = Vote(
                vote_session_id=vote_session.id,
                movie_index=2,  # Movie C wins
            )
            db_session.add(vote)

        await db_session.commit()

        service = VoteService(db_session)
        closed = await service.close_and_determine_winner(vote_session.id)

        assert closed.status == VoteSessionStatus.CLOSED
        assert closed.winning_movie_index == 2

    @pytest.mark.asyncio
    async def test_close_with_no_votes(
        self, db_session: AsyncSession, vote_session: VoteSession
    ):
        """Test closing session with no votes."""
        service = VoteService(db_session)
        closed = await service.close_and_determine_winner(vote_session.id)

        assert closed.status == VoteSessionStatus.CLOSED
        assert closed.winning_movie_index is None

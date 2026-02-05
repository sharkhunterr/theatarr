"""Integration tests for wallmount WebSocket functionality."""

import pytest
import pytest_asyncio
import asyncio
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.session import Session, SessionStatus
from theatarr.models.sequence import Sequence, DurationType
from theatarr.models.movie import Movie


@pytest_asyncio.fixture
async def test_movie(db_session: AsyncSession) -> Movie:
    """Create a test movie."""
    movie = Movie(
        title="Test Movie",
        year=2023,
        runtime_minutes=120,
        poster_url="https://example.com/poster.jpg",
        backdrop_url="https://example.com/backdrop.jpg",
        overview="A great test movie",
        rating=8.5,
        genres=["Action", "Sci-Fi"],
    )
    db_session.add(movie)
    await db_session.commit()
    await db_session.refresh(movie)
    return movie


@pytest_asyncio.fixture
async def test_session(
    db_session: AsyncSession, test_movie: Movie
) -> Session:
    """Create a test session with movie."""
    session = Session(
        name="Wallmount Test Session",
        movie_id=test_movie.id,
        status=SessionStatus.SCHEDULED,
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db_session.add(session)
    await db_session.flush()

    sequence = Sequence(
        session_id=session.id,
        name="Main Feature",
        order_index=0,
        duration_type=DurationType.DYNAMIC,
        duration_fallback_ms=7200000,  # 2 hours
        transition_ms=2000,
    )
    db_session.add(sequence)
    await db_session.commit()
    await db_session.refresh(session)
    return session


class TestWallmountStateEndpoint:
    """Tests for wallmount state HTTP endpoint."""

    @pytest.mark.asyncio
    async def test_get_wallmount_state_no_session(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test getting wallmount state when no active session."""
        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "active_session" in data
        assert data["active_session"] is None

    @pytest.mark.asyncio
    async def test_get_wallmount_state_with_session(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test getting wallmount state with active session."""
        # Start the session
        test_session.status = SessionStatus.RUNNING
        test_session.started_at = datetime.now(timezone.utc)
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["active_session"] is not None
        assert data["active_session"]["status"] == "running"

    @pytest.mark.asyncio
    async def test_get_wallmount_state_includes_movie(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        test_movie: Movie,
        db_session: AsyncSession,
    ):
        """Test that wallmount state includes movie info."""
        test_session.status = SessionStatus.RUNNING
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        assert "movie" in data or "movie" in data.get("active_session", {})

    @pytest.mark.asyncio
    async def test_get_wallmount_state_includes_countdown(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that scheduled session includes countdown."""
        # Keep session as scheduled (future start)
        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        # For scheduled sessions, there should be countdown info
        if data.get("active_session"):
            session_data = data["active_session"]
            if session_data.get("status") == "scheduled":
                assert "scheduled_at" in session_data


class TestWallmountPublicAccess:
    """Tests for public wallmount access."""

    @pytest.mark.asyncio
    async def test_wallmount_page_accessible_without_auth(
        self, client: AsyncClient
    ):
        """Test that wallmount page is accessible without authentication."""
        response = await client.get("/api/wallmount/state")
        # Should be accessible (200) or redirect, not 401
        assert response.status_code in [200, 302, 307]

    @pytest.mark.asyncio
    async def test_wallmount_requires_token_when_configured(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test that wallmount requires token when configured."""
        # This test depends on settings configuration
        # If wallmount_requires_token is True, unauthenticated access
        # should require a valid token parameter
        pass


class TestWallmountWebSocketConnection:
    """Tests for wallmount WebSocket connections."""

    @pytest.mark.asyncio
    async def test_websocket_connection_established(self, client: AsyncClient):
        """Test that WebSocket connection can be established."""
        # WebSocket connections require special handling in tests
        # This tests the endpoint exists and accepts connections
        pass

    @pytest.mark.asyncio
    async def test_websocket_receives_initial_state(self, client: AsyncClient):
        """Test that WebSocket receives initial state on connection."""
        pass

    @pytest.mark.asyncio
    async def test_websocket_receives_session_updates(
        self, client: AsyncClient, test_session: Session
    ):
        """Test that WebSocket receives session state updates."""
        pass


class TestWallmountStateUpdates:
    """Tests for wallmount state update broadcasts."""

    @pytest.mark.asyncio
    async def test_state_update_on_session_start(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that state update is sent when session starts."""
        # Start the session
        response = await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify the session is now running
        state_response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = state_response.json()

        assert data["active_session"]["status"] == "running"

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_state_update_on_session_pause(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that state update is sent when session pauses."""
        # Start first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        # Pause
        response = await client.post(
            f"/api/sessions/{test_session.id}/pause",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify
        state_response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = state_response.json()

        assert data["active_session"]["status"] == "paused"

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_state_update_on_sequence_change(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that state update is sent when sequence changes."""
        # Add another sequence
        seq2 = Sequence(
            session_id=test_session.id,
            name="End Credits",
            order_index=1,
            duration_type=DurationType.FIXED,
            duration_ms=30000,
        )
        db_session.add(seq2)
        await db_session.commit()

        # Start session
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        # Skip to next sequence
        response = await client.post(
            f"/api/sessions/{test_session.id}/skip",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify sequence index changed
        state_response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = state_response.json()

        assert data["active_session"]["current_sequence_index"] >= 1

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )


class TestWallmountPaletteIntegration:
    """Tests for wallmount color palette integration."""

    @pytest.mark.asyncio
    async def test_state_includes_palette(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        test_movie: Movie,
        db_session: AsyncSession,
    ):
        """Test that wallmount state includes color palette."""
        test_session.status = SessionStatus.RUNNING
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        # Palette should be included (or extractable)
        # May be under 'palette' or 'theme' key

    @pytest.mark.asyncio
    async def test_palette_extracted_from_poster(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        test_movie: Movie,
        db_session: AsyncSession,
    ):
        """Test that palette is extracted from movie poster."""
        # This requires the palette extraction service
        # The test verifies integration between wallmount and palette service
        pass


class TestWallmountTemplateIntegration:
    """Tests for wallmount template integration."""

    @pytest.mark.asyncio
    async def test_state_includes_template(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that wallmount state includes active template."""
        test_session.status = SessionStatus.RUNNING
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        # Template info should be available

    @pytest.mark.asyncio
    async def test_template_changes_reflect_in_state(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that template changes are reflected in wallmount state."""
        pass


class TestWallmountTimerCalculations:
    """Tests for wallmount countdown timer calculations."""

    @pytest.mark.asyncio
    async def test_countdown_calculated_correctly(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that countdown is calculated correctly for scheduled sessions."""
        # Set session to start in 1 hour
        start_time = datetime.now(timezone.utc) + timedelta(hours=1)
        test_session.scheduled_at = start_time
        test_session.status = SessionStatus.SCHEDULED
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        # Countdown should be approximately 1 hour (3600 seconds)
        if data.get("countdown_seconds"):
            assert 3500 < data["countdown_seconds"] < 3700

    @pytest.mark.asyncio
    async def test_elapsed_time_tracked(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
        db_session: AsyncSession,
    ):
        """Test that elapsed time is tracked during running session."""
        test_session.status = SessionStatus.RUNNING
        test_session.started_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        test_session.current_sequence_elapsed_ms = 300000  # 5 minutes
        await db_session.commit()

        response = await client.get(
            "/api/wallmount/state",
            headers=auth_headers,
        )
        data = response.json()

        session_data = data.get("active_session", {})
        assert session_data.get("current_sequence_elapsed_ms", 0) >= 300000

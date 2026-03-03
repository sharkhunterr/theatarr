"""Contract tests for Sessions API.

These tests verify the API contract matches the documented schema,
ensuring backwards compatibility and correct response shapes.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.sequence import DurationType, Sequence
from theatarr.models.session import Session, SessionStatus


@pytest_asyncio.fixture
async def test_session(db_session: AsyncSession) -> Session:
    """Create a test session for API tests."""
    session = Session(
        name="API Test Session",
        description="A session for API contract testing",
        status=SessionStatus.DRAFT,
    )
    db_session.add(session)
    await db_session.flush()

    # Add a sequence
    sequence = Sequence(
        session_id=session.id,
        name="Test Sequence",
        order_index=0,
        duration_type=DurationType.FIXED,
        duration_ms=5000,
        transition_ms=1000,
    )
    db_session.add(sequence)
    await db_session.commit()
    await db_session.refresh(session)
    return session


class TestSessionsListContract:
    """Contract tests for GET /api/sessions."""

    @pytest.mark.asyncio
    async def test_list_sessions_returns_array(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        """Test that list endpoint returns an array."""
        response = await client.get("/api/sessions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_sessions_item_shape(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test that each session item has required fields."""
        response = await client.get("/api/sessions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert len(data) >= 1
        session = data[0]

        # Required fields per API contract
        required_fields = [
            "id",
            "name",
            "status",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in session, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_list_sessions_status_values(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test that status is a valid enum value."""
        response = await client.get("/api/sessions", headers=auth_headers)
        data = response.json()

        valid_statuses = [
            "draft",
            "scheduled",
            "running",
            "paused",
            "completed",
            "interrupted",
        ]
        for session in data:
            assert session["status"] in valid_statuses

    @pytest.mark.asyncio
    async def test_list_sessions_requires_auth(self, client: AsyncClient):
        """Test that list endpoint requires authentication."""
        response = await client.get("/api/sessions")
        assert response.status_code == 401


class TestSessionDetailContract:
    """Contract tests for GET /api/sessions/{id}."""

    @pytest.mark.asyncio
    async def test_get_session_returns_full_object(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test that detail endpoint returns full session object."""
        response = await client.get(
            f"/api/sessions/{test_session.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should include nested sequences
        assert "sequences" in data
        assert isinstance(data["sequences"], list)

    @pytest.mark.asyncio
    async def test_get_session_sequence_shape(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test that sequences have correct shape."""
        response = await client.get(
            f"/api/sessions/{test_session.id}",
            headers=auth_headers,
        )
        data = response.json()

        for sequence in data["sequences"]:
            required_fields = [
                "id",
                "name",
                "order_index",
                "duration_type",
            ]
            for field in required_fields:
                assert field in sequence, f"Missing sequence field: {field}"

    @pytest.mark.asyncio
    async def test_get_session_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that non-existent session returns 404."""
        response = await client.get(
            "/api/sessions/nonexistent-id",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestSessionCreateContract:
    """Contract tests for POST /api/sessions."""

    @pytest.mark.asyncio
    async def test_create_session_minimal(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test creating session with minimal data."""
        response = await client.post(
            "/api/sessions",
            headers=auth_headers,
            json={"name": "New Session"},
        )
        assert response.status_code == 201
        data = response.json()

        assert "id" in data
        assert data["name"] == "New Session"
        assert data["status"] == "draft"

    @pytest.mark.asyncio
    async def test_create_session_full(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test creating session with all fields."""
        response = await client.post(
            "/api/sessions",
            headers=auth_headers,
            json={
                "name": "Full Session",
                "description": "A complete session",
            },
        )
        assert response.status_code == 201
        data = response.json()

        assert data["description"] == "A complete session"

    @pytest.mark.asyncio
    async def test_create_session_validation_error(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that missing required fields returns 422."""
        response = await client.post(
            "/api/sessions",
            headers=auth_headers,
            json={},  # Missing required 'name' field
        )
        assert response.status_code == 422


class TestSessionUpdateContract:
    """Contract tests for PUT /api/sessions/{id}."""

    @pytest.mark.asyncio
    async def test_update_session_name(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test updating session name."""
        response = await client.put(
            f"/api/sessions/{test_session.id}",
            headers=auth_headers,
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_session_preserves_id(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test that update preserves session ID."""
        response = await client.put(
            f"/api/sessions/{test_session.id}",
            headers=auth_headers,
            json={"name": "Updated"},
        )
        data = response.json()

        assert data["id"] == test_session.id


class TestSessionDeleteContract:
    """Contract tests for DELETE /api/sessions/{id}."""

    @pytest.mark.asyncio
    async def test_delete_session_success(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        """Test deleting a session."""
        # Create a session to delete
        session = Session(name="To Delete", status=SessionStatus.DRAFT)
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        response = await client.delete(
            f"/api/sessions/{session.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_session_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test deleting non-existent session."""
        response = await client.delete(
            "/api/sessions/nonexistent",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestSessionControlContract:
    """Contract tests for session control endpoints."""

    @pytest.mark.asyncio
    async def test_start_session_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test POST /api/sessions/{id}/start."""
        response = await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "running"
        assert data["started_at"] is not None

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_pause_session_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test POST /api/sessions/{id}/pause."""
        # Start first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        response = await client.post(
            f"/api/sessions/{test_session.id}/pause",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "paused"

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_resume_session_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test POST /api/sessions/{id}/resume."""
        # Start and pause first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )
        await client.post(
            f"/api/sessions/{test_session.id}/pause",
            headers=auth_headers,
        )

        response = await client.post(
            f"/api/sessions/{test_session.id}/resume",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "running"

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_stop_session_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test POST /api/sessions/{id}/stop."""
        # Start first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        response = await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "completed"
        assert data["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_skip_session_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test POST /api/sessions/{id}/skip."""
        # Start first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        response = await client.post(
            f"/api/sessions/{test_session.id}/skip",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should have advanced (or completed if only one sequence)
        assert data["current_sequence_index"] >= 0

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )


class TestSessionStateContract:
    """Contract tests for session state endpoint."""

    @pytest.mark.asyncio
    async def test_get_session_state_endpoint(
        self, client: AsyncClient, auth_headers: dict, test_session: Session
    ):
        """Test GET /api/sessions/{id}/state."""
        # Start session first
        await client.post(
            f"/api/sessions/{test_session.id}/start",
            headers=auth_headers,
        )

        response = await client.get(
            f"/api/sessions/{test_session.id}/state",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify state contract
        required_fields = [
            "session_id",
            "status",
            "current_sequence_index",
            "current_sequence_elapsed_ms",
            "total_sequences",
        ]
        for field in required_fields:
            assert field in data, f"Missing state field: {field}"

        # Cleanup
        await client.post(
            f"/api/sessions/{test_session.id}/stop",
            headers=auth_headers,
        )

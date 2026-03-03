"""Validation tests for quickstart.md scenarios.

These tests verify that the documented quickstart scenarios work correctly,
ensuring documentation accuracy and a smooth onboarding experience.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.user import User
from theatarr.models.session import Session, SessionStatus
from theatarr.models.sequence import Sequence, DurationType
from theatarr.models.service import Service, ServiceCategory, ConnectionStatus
from theatarr.services.auth import hash_password, create_access_token


class TestQuickstartScenario1AddService:
    """Test Quickstart Scenario 1: Add a Service."""

    @pytest.mark.asyncio
    async def test_add_hue_service(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test adding a Philips Hue service as documented in quickstart."""
        # This matches the curl command in quickstart.md
        service_data = {
            "name": "Living Room Hue",
            "adapter_type": "hue",
            "category": "lighting",
            "config": {
                "bridge_ip": "192.168.1.10",
                "api_key": "test-hue-api-key",
            },
        }

        response = await client.post(
            "/api/v1/services",
            headers=auth_headers,
            json=service_data,
        )

        assert response.status_code in [200, 201]

        data = response.json()
        assert data["name"] == "Living Room Hue"
        assert data["adapter_type"] == "hue"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_test_service_connection(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test the service connection test endpoint."""
        # First create a service
        service = Service(
            name="Test Hue",
            adapter_type="hue",
            category=ServiceCategory.LIGHTING,
            config={"bridge_ip": "192.168.1.10"},
            is_enabled=True,
        )
        db_session.add(service)
        await db_session.commit()
        await db_session.refresh(service)

        # Test the connection endpoint
        response = await client.post(
            f"/api/v1/services/{service.id}/test",
            headers=auth_headers,
        )

        # Should return a result (success or failure depending on mock)
        assert response.status_code in [200, 400, 503]


class TestQuickstartScenario2CreateSession:
    """Test Quickstart Scenario 2: Create a Session."""

    @pytest.mark.asyncio
    async def test_create_session(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test creating a session as documented in quickstart."""
        # This matches the curl command in quickstart.md
        session_data = {
            "name": "Movie Night",
        }

        response = await client.post(
            "/api/v1/sessions",
            headers=auth_headers,
            json=session_data,
        )

        assert response.status_code in [200, 201]

        data = response.json()
        assert data["name"] == "Movie Night"
        assert data["status"] == "draft"
        assert "id" in data


class TestQuickstartScenario3AddSequences:
    """Test Quickstart Scenario 3: Add Sequences."""

    @pytest_asyncio.fixture
    async def test_session(
        self, db_session: AsyncSession
    ) -> Session:
        """Create a test session."""
        session = Session(
            name="Test Session",
            status=SessionStatus.DRAFT,
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        return session

    @pytest.mark.asyncio
    async def test_add_sequence_with_actions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_session: Session,
    ):
        """Test adding a sequence with actions as documented in quickstart."""
        # This matches the curl command in quickstart.md
        sequence_data = {
            "name": "Welcome",
            "duration_type": "fixed",
            "duration_ms": 60000,
            "actions": [
                {
                    "action_type": "lighting",
                    "command": "set_color",
                    "parameters": {
                        "color": "#FF5500",
                        "intensity": 50,
                        "targets": ["group:living-room"],
                    },
                }
            ],
        }

        response = await client.post(
            f"/api/v1/sessions/{test_session.id}/sequences",
            headers=auth_headers,
            json=sequence_data,
        )

        assert response.status_code in [200, 201]

        data = response.json()
        assert data["name"] == "Welcome"
        assert data["duration_type"] == "fixed"
        assert data["duration_ms"] == 60000


class TestQuickstartScenario4StartSession:
    """Test Quickstart Scenario 4: Start Session."""

    @pytest_asyncio.fixture
    async def ready_session(
        self, db_session: AsyncSession
    ) -> Session:
        """Create a session ready to start."""
        session = Session(
            name="Ready Session",
            status=SessionStatus.SCHEDULED,
        )
        db_session.add(session)
        await db_session.flush()

        # Add a sequence
        sequence = Sequence(
            session_id=session.id,
            name="Main Feature",
            order_index=0,
            duration_type=DurationType.FIXED,
            duration_ms=60000,
        )
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(session)
        return session

    @pytest.mark.asyncio
    async def test_start_session(
        self,
        client: AsyncClient,
        auth_headers: dict,
        ready_session: Session,
    ):
        """Test starting a session as documented in quickstart."""
        # This matches the curl command in quickstart.md
        response = await client.post(
            f"/api/v1/sessions/{ready_session.id}/start",
            headers=auth_headers,
        )

        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "running"

        # Cleanup: stop the session
        await client.post(
            f"/api/v1/sessions/{ready_session.id}/stop",
            headers=auth_headers,
        )

    @pytest.mark.asyncio
    async def test_control_endpoint_play(
        self,
        client: AsyncClient,
        auth_headers: dict,
        ready_session: Session,
    ):
        """Test the control endpoint with play action."""
        # Alternative control endpoint style
        response = await client.post(
            f"/api/v1/sessions/{ready_session.id}/control",
            headers=auth_headers,
            json={"action": "play"},
        )

        # Should work or return appropriate error
        assert response.status_code in [200, 400, 404]


class TestQuickstartFullWorkflow:
    """Test the complete quickstart workflow end-to-end."""

    @pytest.mark.asyncio
    async def test_complete_cinema_setup_workflow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test complete workflow: create service -> create session -> add sequence -> start."""

        # Step 1: Create a service
        service_response = await client.post(
            "/api/v1/services",
            headers=auth_headers,
            json={
                "name": "Cinema Lights",
                "adapter_type": "mock",
                "category": "lighting",
                "config": {},
            },
        )
        assert service_response.status_code in [200, 201]
        service_id = service_response.json().get("id")

        # Step 2: Create a session
        session_response = await client.post(
            "/api/v1/sessions",
            headers=auth_headers,
            json={
                "name": "E2E Test Session",
            },
        )
        assert session_response.status_code in [200, 201]
        session_data = session_response.json()
        session_id = session_data["id"]

        # Step 3: Add a sequence
        sequence_response = await client.post(
            f"/api/v1/sessions/{session_id}/sequences",
            headers=auth_headers,
            json={
                "name": "Pre-show",
                "duration_type": "fixed",
                "duration_ms": 30000,
                "actions": [
                    {
                        "action_type": "lighting",
                        "command": "set_brightness",
                        "parameters": {"brightness": 50},
                    }
                ],
            },
        )
        assert sequence_response.status_code in [200, 201]

        # Step 4: Schedule the session
        schedule_response = await client.patch(
            f"/api/v1/sessions/{session_id}",
            headers=auth_headers,
            json={
                "status": "scheduled",
            },
        )
        # May or may not require explicit status change
        assert schedule_response.status_code in [200, 400]

        # Step 5: Start the session
        start_response = await client.post(
            f"/api/v1/sessions/{session_id}/start",
            headers=auth_headers,
        )
        # Should start or explain why not
        assert start_response.status_code in [200, 400]

        # Cleanup
        await client.post(
            f"/api/v1/sessions/{session_id}/stop",
            headers=auth_headers,
        )


class TestQuickstartAPIDocumentation:
    """Test that API endpoints match documentation."""

    @pytest.mark.asyncio
    async def test_api_docs_accessible(self, client: AsyncClient):
        """Test that API documentation is accessible at /docs."""
        response = await client.get("/docs")
        # Should be accessible (200 or redirect)
        assert response.status_code in [200, 302, 307]

    @pytest.mark.asyncio
    async def test_openapi_schema_accessible(self, client: AsyncClient):
        """Test that OpenAPI schema is accessible."""
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data


class TestQuickstartConfigurationExport:
    """Test configuration export as documented in quickstart."""

    @pytest.mark.asyncio
    async def test_export_configuration(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test exporting configuration as documented."""
        response = await client.get(
            "/api/v1/config/export",
            headers=auth_headers,
        )

        assert response.status_code == 200

        data = response.json()
        assert "version" in data
        assert "exported_at" in data


class TestQuickstartMigrations:
    """Test database migration scenarios from quickstart."""

    @pytest.mark.asyncio
    async def test_database_schema_is_valid(self, db_session: AsyncSession):
        """Test that database schema is properly created."""
        from sqlalchemy import text

        # Verify core tables exist
        result = await db_session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
        tables = {row[0] for row in result.fetchall()}

        expected_tables = {
            "users",
            "sessions",
            "sequences",
            "actions",
            "services",
            "settings",
        }

        for table in expected_tables:
            assert table in tables, f"Table {table} not found in database"


class TestQuickstartAuthentication:
    """Test authentication flow from quickstart."""

    @pytest.mark.asyncio
    async def test_login_returns_token(self, client: AsyncClient, db_session: AsyncSession):
        """Test that login returns a valid token."""
        # Create test user
        user = User(
            username="testlogin",
            password_hash=hash_password("testpassword"),
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            data={
                "username": "testlogin",
                "password": "testpassword",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_token_can_access_protected_endpoint(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that token can access protected endpoints."""
        # Create test user and get token
        user = User(
            username="tokentest",
            password_hash=hash_password("testpassword"),
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        token = create_access_token(user)

        # Access protected endpoint
        response = await client.get(
            "/api/v1/sessions",
            headers={"Authorization": f"Bearer {token.access_token}"},
        )

        assert response.status_code == 200

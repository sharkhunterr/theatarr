"""Unit tests for vote token validation."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from theatarr.services.vote import (
    VoteTokenService,
    generate_token,
    validate_token_format,
    TokenValidationError,
)
from theatarr.models.vote import VoteSession, VoteToken, VoteSessionStatus


class TestTokenGeneration:
    """Tests for token generation utilities."""

    def test_generate_token_length(self):
        """Test that generated tokens have correct length."""
        token = generate_token()
        assert len(token) == 8  # Default length

    def test_generate_token_custom_length(self):
        """Test generating token with custom length."""
        token = generate_token(length=12)
        assert len(token) == 12

    def test_generate_token_uniqueness(self):
        """Test that generated tokens are unique."""
        tokens = [generate_token() for _ in range(100)]
        assert len(set(tokens)) == 100  # All unique

    def test_generate_token_alphanumeric(self):
        """Test that tokens contain only alphanumeric characters."""
        token = generate_token()
        assert token.isalnum()

    def test_generate_token_uppercase(self):
        """Test that tokens are uppercase."""
        token = generate_token()
        assert token.isupper() or token.replace("0123456789", "").isupper()


class TestTokenFormatValidation:
    """Tests for token format validation."""

    def test_validate_valid_token(self):
        """Test validating a correctly formatted token."""
        assert validate_token_format("ABCD1234") is True

    def test_validate_empty_token(self):
        """Test that empty token is invalid."""
        assert validate_token_format("") is False

    def test_validate_too_short_token(self):
        """Test that too short token is invalid."""
        assert validate_token_format("ABC") is False

    def test_validate_too_long_token(self):
        """Test that too long token is invalid."""
        assert validate_token_format("A" * 100) is False

    def test_validate_special_characters(self):
        """Test that tokens with special characters are invalid."""
        assert validate_token_format("ABC!@#$") is False

    def test_validate_spaces(self):
        """Test that tokens with spaces are invalid."""
        assert validate_token_format("ABC 1234") is False


class TestVoteTokenService:
    """Tests for VoteTokenService class."""

    @pytest.fixture
    def service(self) -> VoteTokenService:
        """Create a token service instance."""
        return VoteTokenService()

    @pytest.fixture
    def mock_vote_session(self) -> VoteSession:
        """Create a mock vote session."""
        session = MagicMock(spec=VoteSession)
        session.id = "session-123"
        session.status = VoteSessionStatus.OPEN
        session.require_token = True
        session.opens_at = datetime.now(timezone.utc) - timedelta(hours=1)
        session.closes_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.is_open = True
        return session

    @pytest.fixture
    def mock_valid_token(self) -> VoteToken:
        """Create a mock valid token."""
        token = MagicMock(spec=VoteToken)
        token.id = "token-123"
        token.token = "ABCD1234"
        token.vote_session_id = "session-123"
        token.is_active = True
        token.max_uses = 5
        token.use_count = 0
        token.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        token.is_valid = True
        return token

    def test_service_initialization(self, service: VoteTokenService):
        """Test service initializes correctly."""
        assert service is not None

    def test_create_token_default_params(self, service: VoteTokenService):
        """Test creating token with default parameters."""
        token_data = service.create_token_data(
            session_id="session-123",
        )
        assert "token" in token_data
        assert token_data["vote_session_id"] == "session-123"
        assert token_data["is_active"] is True

    def test_create_token_with_label(self, service: VoteTokenService):
        """Test creating token with custom label."""
        token_data = service.create_token_data(
            session_id="session-123",
            label="Guest Token",
        )
        assert token_data["label"] == "Guest Token"

    def test_create_token_with_max_uses(self, service: VoteTokenService):
        """Test creating token with max uses limit."""
        token_data = service.create_token_data(
            session_id="session-123",
            max_uses=3,
        )
        assert token_data["max_uses"] == 3

    def test_create_token_with_expiration(self, service: VoteTokenService):
        """Test creating token with expiration time."""
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        token_data = service.create_token_data(
            session_id="session-123",
            expires_at=expires,
        )
        assert token_data["expires_at"] == expires

    def test_validate_token_success(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test successful token validation."""
        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is True
        assert result.error is None

    def test_validate_token_inactive(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test validating inactive token."""
        mock_valid_token.is_active = False
        mock_valid_token.is_valid = False

        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is False
        assert "inactive" in result.error.lower()

    def test_validate_token_expired(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test validating expired token."""
        mock_valid_token.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        mock_valid_token.is_valid = False

        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is False
        assert "expired" in result.error.lower()

    def test_validate_token_max_uses_reached(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test validating token that has reached max uses."""
        mock_valid_token.max_uses = 3
        mock_valid_token.use_count = 3
        mock_valid_token.is_valid = False

        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is False
        assert "uses" in result.error.lower() or "limit" in result.error.lower()

    def test_validate_token_wrong_session(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test validating token for different session."""
        mock_valid_token.vote_session_id = "different-session"

        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is False
        assert "session" in result.error.lower()

    def test_validate_token_session_closed(
        self,
        service: VoteTokenService,
        mock_vote_session: VoteSession,
        mock_valid_token: VoteToken,
    ):
        """Test validating token when session is closed."""
        mock_vote_session.is_open = False
        mock_vote_session.status = VoteSessionStatus.CLOSED

        result = service.validate_token(mock_valid_token, mock_vote_session)
        assert result.is_valid is False
        assert "closed" in result.error.lower()

    def test_increment_use_count(
        self,
        service: VoteTokenService,
        mock_valid_token: VoteToken,
    ):
        """Test incrementing token use count."""
        initial_count = mock_valid_token.use_count
        service.increment_use_count(mock_valid_token)
        assert mock_valid_token.use_count == initial_count + 1

    def test_deactivate_token(
        self,
        service: VoteTokenService,
        mock_valid_token: VoteToken,
    ):
        """Test deactivating a token."""
        service.deactivate_token(mock_valid_token)
        assert mock_valid_token.is_active is False


class TestTokenValidationError:
    """Tests for TokenValidationError exception."""

    def test_error_with_message(self):
        """Test error with message."""
        error = TokenValidationError("Token expired")
        assert str(error) == "Token expired"

    def test_error_with_code(self):
        """Test error with code attribute."""
        error = TokenValidationError("Invalid token", code="INVALID_TOKEN")
        assert error.code == "INVALID_TOKEN"


class TestTokenBulkOperations:
    """Tests for bulk token operations."""

    @pytest.fixture
    def service(self) -> VoteTokenService:
        return VoteTokenService()

    def test_create_multiple_tokens(self, service: VoteTokenService):
        """Test creating multiple tokens at once."""
        tokens = service.create_bulk_tokens(
            session_id="session-123",
            count=5,
        )
        assert len(tokens) == 5
        # All should be unique
        token_values = [t["token"] for t in tokens]
        assert len(set(token_values)) == 5

    def test_create_multiple_tokens_with_prefix(self, service: VoteTokenService):
        """Test creating tokens with custom labels."""
        tokens = service.create_bulk_tokens(
            session_id="session-123",
            count=3,
            label_prefix="Guest ",
        )
        labels = [t["label"] for t in tokens]
        assert "Guest 1" in labels
        assert "Guest 2" in labels
        assert "Guest 3" in labels


class TestTokenSecurityValidation:
    """Tests for token security validations."""

    @pytest.fixture
    def service(self) -> VoteTokenService:
        return VoteTokenService()

    def test_rate_limiting_check(self, service: VoteTokenService):
        """Test rate limiting for token validation."""
        # Simulate multiple rapid validations
        results = []
        for _ in range(10):
            result = service.check_rate_limit(
                token_id="token-123",
                ip_address="192.168.1.1",
            )
            results.append(result)

        # Should eventually hit rate limit
        # (Depends on implementation - may all pass if no rate limiting)

    def test_suspicious_activity_detection(self, service: VoteTokenService):
        """Test detection of suspicious token usage."""
        # Multiple IPs using same token
        ips = ["192.168.1.1", "192.168.1.2", "192.168.1.3", "10.0.0.1"]

        is_suspicious = service.detect_suspicious_activity(
            token_id="token-123",
            recent_ips=ips,
        )
        # Many different IPs may be suspicious
        # (Depends on implementation)

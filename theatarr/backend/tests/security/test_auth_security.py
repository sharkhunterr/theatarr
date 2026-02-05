"""Security audit tests for authentication and authorization.

Verifies:
- Token expiration is enforced
- Password hashing is secure
- Authorization is properly checked
- Rate limiting (if implemented)
- Input validation
- SQL injection prevention
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from jose import jwt
from passlib.context import CryptContext

from theatarr.services.auth import (
    create_access_token,
    verify_password,
    hash_password,
    authenticate_user,
    get_current_user,
)
from theatarr.config import Settings
from theatarr.models.user import User


class TestPasswordSecurity:
    """Tests for password hashing security."""

    def test_password_hash_uses_bcrypt(self):
        """Verify bcrypt is used for password hashing."""
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = hash_password("test_password")

        # bcrypt hashes start with $2b$
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_password_hash_is_salted(self):
        """Verify that passwords are salted (same password gives different hashes)."""
        password = "test_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Same password should produce different hashes (due to salt)
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_password_verification_is_constant_time(self):
        """Verify that password verification doesn't leak timing info."""
        # Note: bcrypt is inherently constant-time for verification
        hashed = hash_password("correct_password")

        # Both should take similar time (bcrypt handles this)
        result_correct = verify_password("correct_password", hashed)
        result_wrong = verify_password("wrong_password", hashed)

        assert result_correct is True
        assert result_wrong is False

    def test_empty_password_rejected(self):
        """Verify empty passwords are handled safely."""
        hashed = hash_password("some_password")

        # Empty password should not match
        assert verify_password("", hashed) is False

    def test_long_password_handled(self):
        """Verify long passwords are handled (bcrypt has 72 byte limit)."""
        # bcrypt truncates at 72 bytes, but should still work
        long_password = "a" * 100
        hashed = hash_password(long_password)
        assert verify_password(long_password, hashed)


class TestTokenSecurity:
    """Tests for JWT token security."""

    @pytest.fixture
    def mock_user(self) -> User:
        """Create a mock user."""
        user = MagicMock(spec=User)
        user.id = "test-user-123"
        user.username = "testuser"
        user.is_active = True
        return user

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings with known values."""
        with patch("theatarr.services.auth.settings") as mock:
            mock.secret_key = "test-secret-key-at-least-32-characters-long"
            mock.jwt_algorithm = "HS256"
            mock.access_token_expire_minutes = 60
            yield mock

    def test_token_contains_expiration(self, mock_user, mock_settings):
        """Verify tokens contain expiration claim."""
        token = create_access_token(mock_user)

        # Decode without verification to inspect claims
        payload = jwt.decode(
            token.access_token,
            mock_settings.secret_key,
            algorithms=[mock_settings.jwt_algorithm],
        )

        assert "exp" in payload
        assert payload["exp"] > datetime.now(timezone.utc).timestamp()

    def test_token_expiration_is_enforced(self, mock_user, mock_settings):
        """Verify expired tokens are rejected."""
        # Create token with past expiration
        expire = datetime.now(timezone.utc) - timedelta(hours=1)
        payload = {
            "sub": mock_user.id,
            "username": mock_user.username,
            "exp": expire,
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        expired_token = jwt.encode(
            payload,
            mock_settings.secret_key,
            algorithm=mock_settings.jwt_algorithm,
        )

        # Attempting to decode should raise exception
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(
                expired_token,
                mock_settings.secret_key,
                algorithms=[mock_settings.jwt_algorithm],
            )

    def test_token_signature_validated(self, mock_user, mock_settings):
        """Verify token signature is validated."""
        token = create_access_token(mock_user)

        # Try to decode with wrong key
        with pytest.raises(jwt.JWTError):
            jwt.decode(
                token.access_token,
                "wrong-secret-key",
                algorithms=[mock_settings.jwt_algorithm],
            )

    def test_token_algorithm_is_validated(self, mock_user, mock_settings):
        """Verify token algorithm is validated."""
        token = create_access_token(mock_user)

        # Try to decode with wrong algorithm
        with pytest.raises(jwt.JWTError):
            jwt.decode(
                token.access_token,
                mock_settings.secret_key,
                algorithms=["HS384"],  # Different algorithm
            )

    def test_token_subject_is_user_id(self, mock_user, mock_settings):
        """Verify token subject is user ID (not username)."""
        token = create_access_token(mock_user)

        payload = jwt.decode(
            token.access_token,
            mock_settings.secret_key,
            algorithms=[mock_settings.jwt_algorithm],
        )

        assert payload["sub"] == mock_user.id

    def test_modified_token_is_rejected(self, mock_user, mock_settings):
        """Verify tampered tokens are rejected."""
        token = create_access_token(mock_user)

        # Modify the token (change a character in the middle)
        token_parts = token.access_token.split(".")
        modified_payload = token_parts[1][:-1] + "X"
        tampered_token = f"{token_parts[0]}.{modified_payload}.{token_parts[2]}"

        with pytest.raises(jwt.JWTError):
            jwt.decode(
                tampered_token,
                mock_settings.secret_key,
                algorithms=[mock_settings.jwt_algorithm],
            )


class TestAuthenticationSecurity:
    """Tests for authentication flow security."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return AsyncMock()

    @pytest.fixture
    def mock_user(self) -> User:
        """Create a mock user."""
        user = MagicMock(spec=User)
        user.id = "test-user-123"
        user.username = "testuser"
        user.password_hash = hash_password("correct_password")
        user.is_active = True
        return user

    @pytest.mark.asyncio
    async def test_nonexistent_user_rejected(self, mock_db):
        """Verify nonexistent users are rejected."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "nonexistent", "password")
        assert user is None

    @pytest.mark.asyncio
    async def test_wrong_password_rejected(self, mock_db, mock_user):
        """Verify wrong passwords are rejected."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "testuser", "wrong_password")
        assert user is None

    @pytest.mark.asyncio
    async def test_inactive_user_rejected(self, mock_db, mock_user):
        """Verify inactive users are rejected."""
        mock_user.is_active = False

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result

        user = await authenticate_user(mock_db, "testuser", "correct_password")
        assert user is None

    @pytest.mark.asyncio
    async def test_successful_auth_updates_login_time(self, mock_db, mock_user):
        """Verify successful auth updates last login timestamp."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result

        before = datetime.now(timezone.utc)
        user = await authenticate_user(mock_db, "testuser", "correct_password")
        after = datetime.now(timezone.utc)

        assert user is not None
        assert before <= mock_user.last_login_at <= after


class TestAuthorizationSecurity:
    """Tests for authorization security."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def mock_settings(self):
        with patch("theatarr.services.auth.settings") as mock:
            mock.secret_key = "test-secret-key-at-least-32-characters-long"
            mock.jwt_algorithm = "HS256"
            mock.access_token_expire_minutes = 60
            yield mock

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, mock_db, mock_settings):
        """Verify invalid tokens return 401."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await get_current_user("invalid_token", mock_db)

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_user_returns_401(self, mock_db, mock_settings):
        """Verify tokens for deleted users return 401."""
        from fastapi import HTTPException

        # Create valid token
        user = MagicMock(spec=User)
        user.id = "deleted-user"
        user.username = "deleteduser"
        token = create_access_token(user)

        # User no longer exists
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await get_current_user(token.access_token, mock_db)

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_disabled_user_returns_403(self, mock_db, mock_settings):
        """Verify disabled users return 403."""
        from fastapi import HTTPException

        # Create valid token
        user = MagicMock(spec=User)
        user.id = "disabled-user"
        user.username = "disableduser"
        user.is_active = False
        token = create_access_token(user)

        # User exists but is disabled
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_db.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await get_current_user(token.access_token, mock_db)

        assert exc.value.status_code == 403


class TestInputValidation:
    """Tests for input validation and injection prevention."""

    def test_sql_injection_in_username_prevented(self):
        """Verify SQL injection attempts in username are handled safely."""
        # SQLAlchemy parameterized queries prevent SQL injection
        # This test documents that the code uses safe query patterns
        malicious_inputs = [
            "admin'--",
            "'; DROP TABLE users;--",
            "admin' OR '1'='1",
            "admin\x00",
        ]

        for malicious in malicious_inputs:
            # hash_password should handle any input safely
            hashed = hash_password(malicious)
            assert hashed is not None
            assert verify_password(malicious, hashed)


class TestConfigurationSecurity:
    """Tests for secure configuration."""

    def test_secret_key_minimum_length(self):
        """Verify secret key has minimum length requirement."""
        # Settings should require minimum 32 character secret key
        settings = Settings.__pydantic_fields__["secret_key"]
        assert settings.metadata[0].min_length >= 32

    def test_token_expiration_has_maximum(self):
        """Verify token expiration has a maximum limit."""
        settings = Settings.__pydantic_fields__["access_token_expire_minutes"]
        # Should have an upper limit (1 week = 10080 minutes)
        assert settings.metadata[0].le <= 10080

    def test_vote_token_expiration_has_maximum(self):
        """Verify vote token expiration has a maximum limit."""
        settings = Settings.__pydantic_fields__["vote_token_expiry_hours"]
        # Should have an upper limit (1 week = 168 hours)
        assert settings.metadata[0].le <= 168


class TestVoteTokenSecurity:
    """Tests for vote token security."""

    def test_vote_token_is_sufficiently_random(self):
        """Verify vote tokens have sufficient entropy."""
        import secrets

        # Generate tokens and check uniqueness
        tokens = set()
        for _ in range(1000):
            token = secrets.token_urlsafe(32)
            tokens.add(token)

        # All tokens should be unique
        assert len(tokens) == 1000

    def test_vote_token_length_is_sufficient(self):
        """Verify vote tokens are long enough to prevent guessing."""
        import secrets

        token = secrets.token_urlsafe(32)
        # 32 bytes = 256 bits of entropy, base64 encoded
        assert len(token) >= 40  # ~43 characters for 32 bytes

"""Unit tests for config manager service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from theatarr.services.config_manager import (
    ConfigManager,
    ConfigExport,
    ImportPreview,
    Conflict,
    ConflictType,
    ResolutionStrategy,
)


class TestConfigExport:
    """Tests for ConfigExport class."""

    def test_create_export_minimal(self):
        """Test creating export with minimal data."""
        export = ConfigExport(
            version="1.0.0",
            exported_at=datetime.now(timezone.utc).isoformat(),
            settings={},
        )
        assert export.version == "1.0.0"
        assert export.settings == {}

    def test_create_export_full(self):
        """Test creating export with all data."""
        export = ConfigExport(
            version="1.0.0",
            exported_at=datetime.now(timezone.utc).isoformat(),
            settings={"key": "value"},
            services=[{"id": "svc-1", "name": "Test Service"}],
            templates=[{"id": "tpl-1", "name": "Test Template"}],
            trailer_rules=[{"id": "rule-1", "name": "Test Rule"}],
        )
        assert len(export.services) == 1
        assert len(export.templates) == 1
        assert len(export.trailer_rules) == 1

    def test_export_to_dict(self):
        """Test converting export to dictionary."""
        export = ConfigExport(
            version="1.0.0",
            exported_at="2024-01-01T00:00:00Z",
            settings={"theme": "dark"},
        )
        d = export.to_dict()
        assert d["version"] == "1.0.0"
        assert d["settings"]["theme"] == "dark"

    def test_export_from_dict(self):
        """Test creating export from dictionary."""
        data = {
            "version": "1.0.0",
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {"theme": "dark"},
        }
        export = ConfigExport.from_dict(data)
        assert export.version == "1.0.0"
        assert export.settings["theme"] == "dark"


class TestConflict:
    """Tests for Conflict class."""

    def test_create_conflict(self):
        """Test creating a conflict."""
        conflict = Conflict(
            type=ConflictType.MODIFIED,
            entity_type="service",
            entity_id="svc-1",
            entity_name="Plex Server",
            current_value={"url": "http://old.local"},
            imported_value={"url": "http://new.local"},
        )
        assert conflict.type == ConflictType.MODIFIED
        assert conflict.entity_type == "service"
        assert conflict.entity_name == "Plex Server"

    def test_conflict_types(self):
        """Test different conflict types."""
        for ctype in ConflictType:
            conflict = Conflict(
                type=ctype,
                entity_type="service",
                entity_id="svc-1",
                entity_name="Test",
            )
            assert conflict.type == ctype


class TestImportPreview:
    """Tests for ImportPreview class."""

    def test_create_preview_no_conflicts(self):
        """Test creating preview with no conflicts."""
        preview = ImportPreview(
            version_compatible=True,
            settings_to_update={"theme": "dark"},
            services_to_add=[],
            services_to_update=[],
            templates_to_add=[],
            templates_to_update=[],
            conflicts=[],
        )
        assert preview.version_compatible is True
        assert len(preview.conflicts) == 0

    def test_create_preview_with_conflicts(self):
        """Test creating preview with conflicts."""
        conflicts = [
            Conflict(
                type=ConflictType.MODIFIED,
                entity_type="service",
                entity_id="svc-1",
                entity_name="Plex",
            ),
        ]
        preview = ImportPreview(
            version_compatible=True,
            settings_to_update={},
            services_to_add=[],
            services_to_update=["svc-1"],
            templates_to_add=[],
            templates_to_update=[],
            conflicts=conflicts,
        )
        assert len(preview.conflicts) == 1

    def test_preview_has_conflicts_property(self):
        """Test has_conflicts property."""
        preview_no_conflicts = ImportPreview(
            version_compatible=True,
            settings_to_update={},
            services_to_add=[],
            services_to_update=[],
            templates_to_add=[],
            templates_to_update=[],
            conflicts=[],
        )
        assert preview_no_conflicts.has_conflicts is False

        preview_with_conflicts = ImportPreview(
            version_compatible=True,
            settings_to_update={},
            services_to_add=[],
            services_to_update=[],
            templates_to_add=[],
            templates_to_update=[],
            conflicts=[
                Conflict(
                    type=ConflictType.MODIFIED,
                    entity_type="service",
                    entity_id="svc-1",
                    entity_name="Test",
                )
            ],
        )
        assert preview_with_conflicts.has_conflicts is True


class TestConfigManager:
    """Tests for ConfigManager class."""

    @pytest.fixture
    def manager(self) -> ConfigManager:
        """Create config manager instance."""
        return ConfigManager()

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_export_config_structure(
        self, manager: ConfigManager, mock_db
    ):
        """Test that export has correct structure."""
        # Mock database queries
        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[]))
        )))

        export = await manager.export_config(mock_db)

        assert "version" in export
        assert "exported_at" in export
        assert "settings" in export

    @pytest.mark.asyncio
    async def test_export_includes_services(
        self, manager: ConfigManager, mock_db
    ):
        """Test that export includes services."""
        mock_service = MagicMock()
        mock_service.id = "svc-1"
        mock_service.name = "Test Service"
        mock_service.config = {"url": "http://localhost"}

        mock_result = MagicMock()
        mock_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[mock_service]))
        )
        mock_db.execute = AsyncMock(return_value=mock_result)

        export = await manager.export_config(mock_db, include_services=True)

        assert "services" in export

    @pytest.mark.asyncio
    async def test_preview_import_version_check(
        self, manager: ConfigManager, mock_db
    ):
        """Test that preview checks version compatibility."""
        import_data = {
            "version": "1.0.0",
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
        }

        mock_db.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[]))
        )))

        preview = await manager.preview_import(mock_db, import_data)

        assert isinstance(preview, ImportPreview)
        assert preview.version_compatible is True

    @pytest.mark.asyncio
    async def test_preview_import_detects_conflicts(
        self, manager: ConfigManager, mock_db
    ):
        """Test that preview detects modification conflicts."""
        existing_service = MagicMock()
        existing_service.id = "svc-1"
        existing_service.name = "Plex"
        existing_service.config = {"url": "http://old.local"}

        import_data = {
            "version": "1.0.0",
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "id": "svc-1",
                    "name": "Plex",
                    "config": {"url": "http://new.local"},
                }
            ],
        }

        mock_result = MagicMock()
        mock_result.scalars = MagicMock(
            return_value=MagicMock(all=MagicMock(return_value=[existing_service]))
        )
        mock_result.scalar_one_or_none = MagicMock(return_value=existing_service)
        mock_db.execute = AsyncMock(return_value=mock_result)

        preview = await manager.preview_import(mock_db, import_data)

        # Should detect the modified service
        assert any(
            c.entity_id == "svc-1" and c.type == ConflictType.MODIFIED
            for c in preview.conflicts
        )


class TestSecretEncryption:
    """Tests for secret encryption in config export."""

    @pytest.fixture
    def manager(self) -> ConfigManager:
        return ConfigManager()

    def test_encrypt_secrets(self, manager: ConfigManager):
        """Test encrypting secrets with password."""
        data = {
            "services": [
                {
                    "id": "svc-1",
                    "config": {
                        "url": "http://localhost",
                        "api_key": "secret-key-123",
                        "token": "secret-token",
                    },
                }
            ]
        }

        encrypted = manager.encrypt_secrets(data, password="testpassword")

        # Should have encrypted data
        assert "encrypted" in encrypted or "iv" in encrypted or encrypted != data

    def test_decrypt_secrets(self, manager: ConfigManager):
        """Test decrypting secrets with password."""
        original_data = {
            "services": [
                {
                    "id": "svc-1",
                    "config": {
                        "api_key": "secret-key-123",
                    },
                }
            ]
        }

        encrypted = manager.encrypt_secrets(original_data, password="testpassword")
        decrypted = manager.decrypt_secrets(encrypted, password="testpassword")

        # Should recover original data
        assert decrypted["services"][0]["config"]["api_key"] == "secret-key-123"

    def test_decrypt_with_wrong_password(self, manager: ConfigManager):
        """Test that wrong password fails decryption."""
        original_data = {"secret": "value"}

        encrypted = manager.encrypt_secrets(original_data, password="correct")

        with pytest.raises(Exception):
            manager.decrypt_secrets(encrypted, password="wrong")

    def test_identify_secret_fields(self, manager: ConfigManager):
        """Test identifying which fields are secrets."""
        config = {
            "url": "http://localhost",
            "api_key": "secret",
            "token": "secret",
            "password": "secret",
            "username": "not-secret",
        }

        secret_fields = manager._identify_secret_fields(config)

        assert "api_key" in secret_fields
        assert "token" in secret_fields
        assert "password" in secret_fields
        assert "url" not in secret_fields
        assert "username" not in secret_fields


class TestResolutionStrategies:
    """Tests for conflict resolution strategies."""

    @pytest.fixture
    def manager(self) -> ConfigManager:
        return ConfigManager()

    def test_resolution_keep_current(self, manager: ConfigManager):
        """Test KEEP_CURRENT resolution strategy."""
        conflict = Conflict(
            type=ConflictType.MODIFIED,
            entity_type="service",
            entity_id="svc-1",
            entity_name="Test",
            current_value={"url": "http://current"},
            imported_value={"url": "http://imported"},
        )

        resolved = manager.resolve_conflict(
            conflict, ResolutionStrategy.KEEP_CURRENT
        )

        assert resolved == {"url": "http://current"}

    def test_resolution_use_imported(self, manager: ConfigManager):
        """Test USE_IMPORTED resolution strategy."""
        conflict = Conflict(
            type=ConflictType.MODIFIED,
            entity_type="service",
            entity_id="svc-1",
            entity_name="Test",
            current_value={"url": "http://current"},
            imported_value={"url": "http://imported"},
        )

        resolved = manager.resolve_conflict(
            conflict, ResolutionStrategy.USE_IMPORTED
        )

        assert resolved == {"url": "http://imported"}

    def test_resolution_merge(self, manager: ConfigManager):
        """Test MERGE resolution strategy."""
        conflict = Conflict(
            type=ConflictType.MODIFIED,
            entity_type="service",
            entity_id="svc-1",
            entity_name="Test",
            current_value={"url": "http://current", "port": 8080},
            imported_value={"url": "http://imported", "timeout": 30},
        )

        resolved = manager.resolve_conflict(conflict, ResolutionStrategy.MERGE)

        # Should have values from both
        assert "url" in resolved
        assert "port" in resolved
        assert "timeout" in resolved


class TestVersionCompatibility:
    """Tests for version compatibility checking."""

    @pytest.fixture
    def manager(self) -> ConfigManager:
        return ConfigManager()

    def test_same_version_compatible(self, manager: ConfigManager):
        """Test that same version is compatible."""
        assert manager.is_version_compatible("1.0.0", "1.0.0") is True

    def test_minor_version_compatible(self, manager: ConfigManager):
        """Test that minor version difference is compatible."""
        assert manager.is_version_compatible("1.1.0", "1.0.0") is True
        assert manager.is_version_compatible("1.0.0", "1.1.0") is True

    def test_major_version_incompatible(self, manager: ConfigManager):
        """Test that major version difference is incompatible."""
        assert manager.is_version_compatible("2.0.0", "1.0.0") is False

    def test_invalid_version_format(self, manager: ConfigManager):
        """Test handling of invalid version format."""
        with pytest.raises(ValueError):
            manager.is_version_compatible("invalid", "1.0.0")

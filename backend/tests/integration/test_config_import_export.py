"""Integration tests for config import/export flow."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.settings import Settings
from theatarr.models.service import Service, ServiceCategory, ConnectionStatus
from theatarr.models.template import Template, TemplateType
from theatarr.services.config_manager import ConfigManager


@pytest_asyncio.fixture
async def sample_settings(db_session: AsyncSession) -> list[Settings]:
    """Create sample settings."""
    settings = [
        Settings(key="theme", value={"mode": "dark"}),
        Settings(key="language", value={"code": "en"}),
        Settings(key="notifications", value={"enabled": True}),
    ]
    for s in settings:
        db_session.add(s)
    await db_session.commit()
    return settings


@pytest_asyncio.fixture
async def sample_services(db_session: AsyncSession) -> list[Service]:
    """Create sample services."""
    services = [
        Service(
            name="Plex Server",
            adapter_type="plex",
            category=ServiceCategory.MEDIA_SOURCE,
            config={"url": "http://localhost:32400", "token": "secret-token"},
            is_enabled=True,
            connection_status=ConnectionStatus.CONNECTED,
        ),
        Service(
            name="Living Room Hue",
            adapter_type="hue",
            category=ServiceCategory.LIGHTING,
            config={"bridge_ip": "192.168.1.100", "username": "hue-user"},
            is_enabled=True,
            connection_status=ConnectionStatus.CONNECTED,
        ),
    ]
    for s in services:
        db_session.add(s)
    await db_session.commit()
    for s in services:
        await db_session.refresh(s)
    return services


@pytest_asyncio.fixture
async def sample_templates(db_session: AsyncSession) -> list[Template]:
    """Create sample templates."""
    templates = [
        Template(
            name="Movie Night",
            description="Template for movie night sessions",
            template_type=TemplateType.MOVIE_INFO,
            layout={"components": ["poster", "title", "rating"]},
            config={"show_rating": True},
            is_active=True,
        ),
    ]
    for t in templates:
        db_session.add(t)
    await db_session.commit()
    for t in templates:
        await db_session.refresh(t)
    return templates


class TestConfigExport:
    """Tests for configuration export."""

    @pytest.mark.asyncio
    async def test_export_settings(
        self, db_session: AsyncSession, sample_settings: list[Settings]
    ):
        """Test exporting settings."""
        manager = ConfigManager()

        export = await manager.export_config(db_session, include_settings=True)

        assert "settings" in export
        assert len(export["settings"]) >= 3

    @pytest.mark.asyncio
    async def test_export_services(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test exporting services."""
        manager = ConfigManager()

        export = await manager.export_config(db_session, include_services=True)

        assert "services" in export
        assert len(export["services"]) >= 2

    @pytest.mark.asyncio
    async def test_export_templates(
        self, db_session: AsyncSession, sample_templates: list[Template]
    ):
        """Test exporting templates."""
        manager = ConfigManager()

        export = await manager.export_config(db_session, include_templates=True)

        assert "templates" in export
        assert len(export["templates"]) >= 1

    @pytest.mark.asyncio
    async def test_export_includes_version(self, db_session: AsyncSession):
        """Test that export includes version info."""
        manager = ConfigManager()

        export = await manager.export_config(db_session)

        assert "version" in export
        assert "exported_at" in export

    @pytest.mark.asyncio
    async def test_export_with_encryption(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test exporting with secret encryption."""
        manager = ConfigManager()

        export = await manager.export_config(
            db_session,
            include_services=True,
            encrypt_secrets=True,
            password="test-password",
        )

        # Secrets should be encrypted
        for service in export.get("services", []):
            config = service.get("config", {})
            # Token should not be visible as plaintext
            if "token" in config:
                assert config["token"] != "secret-token"

    @pytest.mark.asyncio
    async def test_full_export(
        self,
        db_session: AsyncSession,
        sample_settings: list[Settings],
        sample_services: list[Service],
        sample_templates: list[Template],
    ):
        """Test full configuration export."""
        manager = ConfigManager()

        export = await manager.export_config(
            db_session,
            include_settings=True,
            include_services=True,
            include_templates=True,
        )

        assert "settings" in export
        assert "services" in export
        assert "templates" in export


class TestConfigImportPreview:
    """Tests for import preview functionality."""

    @pytest.mark.asyncio
    async def test_preview_compatible_version(
        self, db_session: AsyncSession
    ):
        """Test preview with compatible version."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {"theme": {"mode": "light"}},
        }

        preview = await manager.preview_import(db_session, import_data)

        assert preview.version_compatible is True

    @pytest.mark.asyncio
    async def test_preview_detects_new_settings(
        self, db_session: AsyncSession
    ):
        """Test that preview detects new settings."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {"new_setting": {"value": "test"}},
        }

        preview = await manager.preview_import(db_session, import_data)

        assert "new_setting" in preview.settings_to_update

    @pytest.mark.asyncio
    async def test_preview_detects_modified_service(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test that preview detects modified services."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "id": sample_services[0].id,
                    "name": "Plex Server",
                    "adapter_type": "plex",
                    "category": "media_source",
                    "config": {"url": "http://new-host:32400"},
                }
            ],
        }

        preview = await manager.preview_import(db_session, import_data)

        # Should detect conflict
        assert any(
            c.entity_id == sample_services[0].id
            for c in preview.conflicts
        )

    @pytest.mark.asyncio
    async def test_preview_detects_new_service(
        self, db_session: AsyncSession
    ):
        """Test that preview detects new services."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "id": "new-service-id",
                    "name": "New Service",
                    "adapter_type": "mock",
                    "category": "lighting",
                    "config": {},
                }
            ],
        }

        preview = await manager.preview_import(db_session, import_data)

        assert "new-service-id" in preview.services_to_add


class TestConfigImport:
    """Tests for configuration import."""

    @pytest.mark.asyncio
    async def test_import_settings(self, db_session: AsyncSession):
        """Test importing settings."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {"imported_setting": {"value": "test"}},
        }

        result = await manager.import_config(db_session, import_data)

        assert result["success"] is True

        # Verify setting was imported
        from sqlalchemy import select
        stmt = select(Settings).where(Settings.key == "imported_setting")
        db_result = await db_session.execute(stmt)
        setting = db_result.scalar_one_or_none()
        assert setting is not None
        assert setting.value["value"] == "test"

    @pytest.mark.asyncio
    async def test_import_new_service(self, db_session: AsyncSession):
        """Test importing a new service."""
        manager = ConfigManager()

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "name": "Imported Service",
                    "adapter_type": "mock",
                    "category": "lighting",
                    "config": {"key": "value"},
                    "is_enabled": True,
                }
            ],
        }

        result = await manager.import_config(db_session, import_data)

        assert result["success"] is True
        assert result["services_added"] >= 1

    @pytest.mark.asyncio
    async def test_import_with_conflict_resolution_keep_current(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test import with keep_current conflict resolution."""
        manager = ConfigManager()

        original_url = sample_services[0].config["url"]

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "id": sample_services[0].id,
                    "name": "Plex Server",
                    "adapter_type": "plex",
                    "category": "media_source",
                    "config": {"url": "http://different:32400"},
                }
            ],
        }

        resolutions = {
            sample_services[0].id: "keep_current",
        }

        result = await manager.import_config(
            db_session,
            import_data,
            resolutions=resolutions,
        )

        assert result["success"] is True

        # Verify original was kept
        await db_session.refresh(sample_services[0])
        assert sample_services[0].config["url"] == original_url

    @pytest.mark.asyncio
    async def test_import_with_conflict_resolution_use_imported(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test import with use_imported conflict resolution."""
        manager = ConfigManager()

        new_url = "http://imported:32400"

        import_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "id": sample_services[0].id,
                    "name": "Plex Server",
                    "adapter_type": "plex",
                    "category": "media_source",
                    "config": {"url": new_url},
                }
            ],
        }

        resolutions = {
            sample_services[0].id: "use_imported",
        }

        result = await manager.import_config(
            db_session,
            import_data,
            resolutions=resolutions,
        )

        assert result["success"] is True

        # Verify imported value was used
        await db_session.refresh(sample_services[0])
        assert sample_services[0].config["url"] == new_url

    @pytest.mark.asyncio
    async def test_import_with_decryption(self, db_session: AsyncSession):
        """Test importing encrypted configuration."""
        manager = ConfigManager()
        password = "test-password"

        # First export with encryption
        original_data = {
            "version": manager.current_version,
            "exported_at": "2024-01-01T00:00:00Z",
            "settings": {},
            "services": [
                {
                    "name": "Encrypted Service",
                    "adapter_type": "mock",
                    "category": "lighting",
                    "config": {"secret": "my-secret-value"},
                }
            ],
        }

        encrypted = manager.encrypt_secrets(original_data, password)

        # Import with decryption
        result = await manager.import_config(
            db_session,
            encrypted,
            password=password,
        )

        assert result["success"] is True


class TestRoundTrip:
    """Tests for export-import round trip."""

    @pytest.mark.asyncio
    async def test_full_round_trip(
        self,
        db_session: AsyncSession,
        sample_settings: list[Settings],
        sample_services: list[Service],
        sample_templates: list[Template],
    ):
        """Test full export-import round trip."""
        manager = ConfigManager()

        # Export everything
        export = await manager.export_config(
            db_session,
            include_settings=True,
            include_services=True,
            include_templates=True,
        )

        # Clear database (simulate new installation)
        for setting in sample_settings:
            await db_session.delete(setting)
        for service in sample_services:
            await db_session.delete(service)
        for template in sample_templates:
            await db_session.delete(template)
        await db_session.commit()

        # Import
        result = await manager.import_config(db_session, export)

        assert result["success"] is True
        assert result["settings_updated"] >= len(sample_settings)
        assert result["services_added"] >= len(sample_services)
        assert result["templates_added"] >= len(sample_templates)

    @pytest.mark.asyncio
    async def test_encrypted_round_trip(
        self, db_session: AsyncSession, sample_services: list[Service]
    ):
        """Test encrypted export-import round trip."""
        manager = ConfigManager()
        password = "secure-password-123"

        # Export with encryption
        export = await manager.export_config(
            db_session,
            include_services=True,
            encrypt_secrets=True,
            password=password,
        )

        # Import with decryption
        result = await manager.import_config(
            db_session,
            export,
            password=password,
            resolutions={s.id: "use_imported" for s in sample_services},
        )

        assert result["success"] is True

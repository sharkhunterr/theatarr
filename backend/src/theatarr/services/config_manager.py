"""Configuration import/export service for Theatarr."""

import base64
import json
import secrets
from datetime import datetime
from typing import Any

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models import (
    Session,
    Sequence,
    Action,
    Service,
    Template,
    TrailerRule,
    Settings,
)


class ConflictType:
    """Types of conflicts that can occur during import."""

    DUPLICATE = "duplicate"
    VERSION_MISMATCH = "version_mismatch"
    MISSING_DEPENDENCY = "missing_dependency"
    SCHEMA_CHANGED = "schema_changed"


class ConflictResolution:
    """Resolution strategies for conflicts."""

    SKIP = "skip"
    OVERWRITE = "overwrite"
    RENAME = "rename"
    MERGE = "merge"


class ConfigExport:
    """Configuration export data structure."""

    def __init__(
        self,
        version: str = "1.0",
        exported_at: str | None = None,
        sessions: list[dict] | None = None,
        services: list[dict] | None = None,
        templates: list[dict] | None = None,
        trailer_rules: list[dict] | None = None,
        settings: dict | None = None,
    ):
        self.version = version
        self.exported_at = exported_at or datetime.utcnow().isoformat()
        self.sessions = sessions or []
        self.services = services or []
        self.templates = templates or []
        self.trailer_rules = trailer_rules or []
        self.settings = settings or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "version": self.version,
            "exported_at": self.exported_at,
            "sessions": self.sessions,
            "services": self.services,
            "templates": self.templates,
            "trailer_rules": self.trailer_rules,
            "settings": self.settings,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ConfigExport":
        """Create from dictionary."""
        return cls(
            version=data.get("version", "1.0"),
            exported_at=data.get("exported_at"),
            sessions=data.get("sessions", []),
            services=data.get("services", []),
            templates=data.get("templates", []),
            trailer_rules=data.get("trailer_rules", []),
            settings=data.get("settings", {}),
        )


class Conflict:
    """Represents a conflict during import."""

    def __init__(
        self,
        entity_type: str,
        entity_id: str,
        entity_name: str,
        conflict_type: str,
        details: str,
        existing_data: dict | None = None,
        incoming_data: dict | None = None,
    ):
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.entity_name = entity_name
        self.conflict_type = conflict_type
        self.details = details
        self.existing_data = existing_data
        self.incoming_data = incoming_data

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "entity_name": self.entity_name,
            "conflict_type": self.conflict_type,
            "details": self.details,
            "existing_data": self.existing_data,
            "incoming_data": self.incoming_data,
        }


class ImportPreview:
    """Preview of what will be imported."""

    def __init__(self):
        self.sessions_to_create: list[dict] = []
        self.sessions_to_update: list[dict] = []
        self.services_to_create: list[dict] = []
        self.services_to_update: list[dict] = []
        self.templates_to_create: list[dict] = []
        self.templates_to_update: list[dict] = []
        self.trailer_rules_to_create: list[dict] = []
        self.trailer_rules_to_update: list[dict] = []
        self.settings_to_update: dict = {}
        self.conflicts: list[Conflict] = []

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "sessions": {
                "create": len(self.sessions_to_create),
                "update": len(self.sessions_to_update),
            },
            "services": {
                "create": len(self.services_to_create),
                "update": len(self.services_to_update),
            },
            "templates": {
                "create": len(self.templates_to_create),
                "update": len(self.templates_to_update),
            },
            "trailer_rules": {
                "create": len(self.trailer_rules_to_create),
                "update": len(self.trailer_rules_to_update),
            },
            "settings": bool(self.settings_to_update),
            "conflicts": [c.to_dict() for c in self.conflicts],
            "has_conflicts": len(self.conflicts) > 0,
        }


class ConfigManager:
    """Manages configuration import and export."""

    SENSITIVE_FIELDS = [
        "api_key",
        "api_secret",
        "password",
        "token",
        "access_token",
        "refresh_token",
        "client_secret",
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """Derive encryption key from password."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def _encrypt_data(self, data: str, password: str) -> dict[str, str]:
        """Encrypt data with password."""
        salt = secrets.token_bytes(16)
        key = self._derive_key(password, salt)
        f = Fernet(key)
        encrypted = f.encrypt(data.encode())
        return {
            "salt": base64.b64encode(salt).decode(),
            "data": base64.b64encode(encrypted).decode(),
        }

    def _decrypt_data(self, encrypted: dict[str, str], password: str) -> str:
        """Decrypt data with password."""
        salt = base64.b64decode(encrypted["salt"])
        key = self._derive_key(password, salt)
        f = Fernet(key)
        decrypted = f.decrypt(base64.b64decode(encrypted["data"]))
        return decrypted.decode()

    def _mask_sensitive_data(self, data: dict, mask: bool = True) -> dict:
        """Mask or remove sensitive fields from data."""
        result = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                if mask:
                    result[key] = "***MASKED***"
                # Skip if not masking (will be encrypted separately)
            elif isinstance(value, dict):
                result[key] = self._mask_sensitive_data(value, mask)
            else:
                result[key] = value
        return result

    def _extract_sensitive_data(self, data: dict) -> dict:
        """Extract sensitive fields from data."""
        result = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                result[key] = value
            elif isinstance(value, dict):
                nested = self._extract_sensitive_data(value)
                if nested:
                    result[key] = nested
        return result

    async def export_config(
        self,
        include_sessions: bool = True,
        include_services: bool = True,
        include_templates: bool = True,
        include_trailer_rules: bool = True,
        include_settings: bool = True,
        encrypt_secrets: bool = True,
        encryption_password: str | None = None,
    ) -> dict[str, Any]:
        """Export configuration to a dictionary.

        Args:
            include_sessions: Include session configurations
            include_services: Include service configurations
            include_templates: Include template configurations
            include_trailer_rules: Include trailer rule configurations
            include_settings: Include global settings
            encrypt_secrets: Whether to encrypt sensitive data
            encryption_password: Password for encryption (required if encrypt_secrets=True)

        Returns:
            Dictionary containing the exported configuration
        """
        export = ConfigExport()
        sensitive_data: dict[str, Any] = {}

        if include_sessions:
            sessions = await self.db.execute(select(Session))
            for session in sessions.scalars().all():
                session_data = {
                    "id": session.id,
                    "name": session.name,
                    "description": session.description,
                    "movie_id": session.movie_id,
                    "sequences": [],
                }

                sequences = await self.db.execute(
                    select(Sequence)
                    .where(Sequence.session_id == session.id)
                    .order_by(Sequence.order)
                )
                for seq in sequences.scalars().all():
                    seq_data = {
                        "id": seq.id,
                        "name": seq.name,
                        "description": seq.description,
                        "order": seq.order,
                        "duration_seconds": seq.duration_seconds,
                        "transition_type": seq.transition_type,
                        "transition_duration_ms": seq.transition_duration_ms,
                        "actions": [],
                    }

                    actions = await self.db.execute(
                        select(Action)
                        .where(Action.sequence_id == seq.id)
                        .order_by(Action.order)
                    )
                    for action in actions.scalars().all():
                        seq_data["actions"].append({
                            "id": action.id,
                            "name": action.name,
                            "action_type": action.action_type,
                            "target_service_id": action.target_service_id,
                            "parameters": action.parameters,
                            "delay_ms": action.delay_ms,
                            "order": action.order,
                        })

                    session_data["sequences"].append(seq_data)

                export.sessions.append(session_data)

        if include_services:
            services = await self.db.execute(select(Service))
            for service in services.scalars().all():
                service_data = {
                    "id": service.id,
                    "name": service.name,
                    "service_type": service.service_type,
                    "adapter_name": service.adapter_name,
                    "config": self._mask_sensitive_data(service.config or {}, mask=False),
                    "is_enabled": service.is_enabled,
                }

                # Extract sensitive config data
                service_sensitive = self._extract_sensitive_data(service.config or {})
                if service_sensitive:
                    sensitive_data[f"service:{service.id}"] = service_sensitive

                # Mask in export
                service_data["config"] = self._mask_sensitive_data(service.config or {})
                export.services.append(service_data)

        if include_templates:
            templates = await self.db.execute(select(Template))
            for template in templates.scalars().all():
                export.templates.append({
                    "id": template.id,
                    "name": template.name,
                    "description": template.description,
                    "layout": template.layout,
                    "components": template.components,
                    "styles": template.styles,
                    "is_default": template.is_default,
                    "is_builtin": template.is_builtin,
                })

        if include_trailer_rules:
            rules = await self.db.execute(select(TrailerRule))
            for rule in rules.scalars().all():
                export.trailer_rules.append({
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "is_enabled": rule.is_enabled,
                    "genres": rule.genres,
                    "min_year": rule.min_year,
                    "max_year": rule.max_year,
                    "min_rating": rule.min_rating,
                    "max_rating": rule.max_rating,
                    "preferred_quality": rule.preferred_quality,
                    "min_quality": rule.min_quality,
                    "max_storage_gb": rule.max_storage_gb,
                    "max_trailer_count": rule.max_trailer_count,
                    "max_downloads_per_run": rule.max_downloads_per_run,
                    "frequency": rule.frequency,
                    "rotation_enabled": rule.rotation_enabled,
                    "rotation_keep_most_recent": rule.rotation_keep_most_recent,
                    "rotation_keep_most_played": rule.rotation_keep_most_played,
                })

        if include_settings:
            settings = await self.db.execute(select(Settings))
            for setting in settings.scalars().all():
                export.settings[setting.key] = setting.value

        result = export.to_dict()

        # Encrypt sensitive data if requested
        if encrypt_secrets and encryption_password and sensitive_data:
            result["encrypted_secrets"] = self._encrypt_data(
                json.dumps(sensitive_data),
                encryption_password,
            )

        return result

    async def preview_import(
        self,
        config_data: dict[str, Any],
    ) -> ImportPreview:
        """Preview what would be imported without making changes.

        Args:
            config_data: The configuration data to preview

        Returns:
            ImportPreview with details of what would change
        """
        preview = ImportPreview()
        config = ConfigExport.from_dict(config_data)

        # Check sessions
        for session_data in config.sessions:
            existing = await self.db.execute(
                select(Session).where(Session.id == session_data["id"])
            )
            existing_session = existing.scalar_one_or_none()

            if existing_session:
                # Check for conflicts
                if existing_session.name != session_data["name"]:
                    preview.conflicts.append(Conflict(
                        entity_type="session",
                        entity_id=session_data["id"],
                        entity_name=session_data["name"],
                        conflict_type=ConflictType.DUPLICATE,
                        details=f"Session with ID {session_data['id']} exists with name '{existing_session.name}'",
                        existing_data={"name": existing_session.name},
                        incoming_data={"name": session_data["name"]},
                    ))
                preview.sessions_to_update.append(session_data)
            else:
                preview.sessions_to_create.append(session_data)

        # Check services
        for service_data in config.services:
            existing = await self.db.execute(
                select(Service).where(Service.id == service_data["id"])
            )
            existing_service = existing.scalar_one_or_none()

            if existing_service:
                if existing_service.adapter_name != service_data["adapter_name"]:
                    preview.conflicts.append(Conflict(
                        entity_type="service",
                        entity_id=service_data["id"],
                        entity_name=service_data["name"],
                        conflict_type=ConflictType.SCHEMA_CHANGED,
                        details=f"Service adapter changed from '{existing_service.adapter_name}' to '{service_data['adapter_name']}'",
                        existing_data={"adapter_name": existing_service.adapter_name},
                        incoming_data={"adapter_name": service_data["adapter_name"]},
                    ))
                preview.services_to_update.append(service_data)
            else:
                preview.services_to_create.append(service_data)

        # Check templates
        for template_data in config.templates:
            existing = await self.db.execute(
                select(Template).where(Template.id == template_data["id"])
            )
            existing_template = existing.scalar_one_or_none()

            if existing_template:
                if existing_template.is_builtin and not template_data.get("is_builtin"):
                    preview.conflicts.append(Conflict(
                        entity_type="template",
                        entity_id=template_data["id"],
                        entity_name=template_data["name"],
                        conflict_type=ConflictType.SCHEMA_CHANGED,
                        details="Cannot overwrite builtin template",
                        existing_data={"is_builtin": True},
                        incoming_data={"is_builtin": template_data.get("is_builtin", False)},
                    ))
                preview.templates_to_update.append(template_data)
            else:
                preview.templates_to_create.append(template_data)

        # Check trailer rules
        for rule_data in config.trailer_rules:
            existing = await self.db.execute(
                select(TrailerRule).where(TrailerRule.id == rule_data["id"])
            )
            existing_rule = existing.scalar_one_or_none()

            if existing_rule:
                preview.trailer_rules_to_update.append(rule_data)
            else:
                preview.trailer_rules_to_create.append(rule_data)

        # Check settings
        preview.settings_to_update = config.settings

        return preview

    async def import_config(
        self,
        config_data: dict[str, Any],
        conflict_resolutions: dict[str, str] | None = None,
        encryption_password: str | None = None,
    ) -> dict[str, Any]:
        """Import configuration from a dictionary.

        Args:
            config_data: The configuration data to import
            conflict_resolutions: Resolution strategy per conflict ID (entity_type:entity_id)
            encryption_password: Password to decrypt sensitive data

        Returns:
            Summary of import results
        """
        conflict_resolutions = conflict_resolutions or {}
        config = ConfigExport.from_dict(config_data)

        # Decrypt secrets if present
        decrypted_secrets: dict[str, Any] = {}
        if "encrypted_secrets" in config_data and encryption_password:
            try:
                decrypted_json = self._decrypt_data(
                    config_data["encrypted_secrets"],
                    encryption_password,
                )
                decrypted_secrets = json.loads(decrypted_json)
            except Exception:
                # Failed to decrypt - proceed without secrets
                pass

        results = {
            "sessions_created": 0,
            "sessions_updated": 0,
            "sessions_skipped": 0,
            "services_created": 0,
            "services_updated": 0,
            "services_skipped": 0,
            "templates_created": 0,
            "templates_updated": 0,
            "templates_skipped": 0,
            "trailer_rules_created": 0,
            "trailer_rules_updated": 0,
            "trailer_rules_skipped": 0,
            "settings_updated": 0,
            "errors": [],
        }

        # Import sessions
        for session_data in config.sessions:
            try:
                existing = await self.db.execute(
                    select(Session).where(Session.id == session_data["id"])
                )
                existing_session = existing.scalar_one_or_none()

                conflict_key = f"session:{session_data['id']}"
                resolution = conflict_resolutions.get(conflict_key, ConflictResolution.OVERWRITE)

                if existing_session:
                    if resolution == ConflictResolution.SKIP:
                        results["sessions_skipped"] += 1
                        continue

                    # Update existing
                    existing_session.name = session_data["name"]
                    existing_session.description = session_data.get("description")
                    existing_session.movie_id = session_data.get("movie_id")
                    results["sessions_updated"] += 1
                else:
                    # Create new
                    new_session = Session(
                        id=session_data["id"],
                        name=session_data["name"],
                        description=session_data.get("description"),
                        movie_id=session_data.get("movie_id"),
                    )
                    self.db.add(new_session)
                    results["sessions_created"] += 1

                # Handle sequences and actions
                for seq_data in session_data.get("sequences", []):
                    existing_seq = await self.db.execute(
                        select(Sequence).where(Sequence.id == seq_data["id"])
                    )
                    existing_sequence = existing_seq.scalar_one_or_none()

                    if existing_sequence:
                        existing_sequence.name = seq_data["name"]
                        existing_sequence.description = seq_data.get("description")
                        existing_sequence.order = seq_data["order"]
                        existing_sequence.duration_seconds = seq_data.get("duration_seconds")
                        existing_sequence.transition_type = seq_data.get("transition_type")
                        existing_sequence.transition_duration_ms = seq_data.get("transition_duration_ms")
                    else:
                        new_sequence = Sequence(
                            id=seq_data["id"],
                            session_id=session_data["id"],
                            name=seq_data["name"],
                            description=seq_data.get("description"),
                            order=seq_data["order"],
                            duration_seconds=seq_data.get("duration_seconds"),
                            transition_type=seq_data.get("transition_type"),
                            transition_duration_ms=seq_data.get("transition_duration_ms"),
                        )
                        self.db.add(new_sequence)

                    # Handle actions
                    for action_data in seq_data.get("actions", []):
                        existing_act = await self.db.execute(
                            select(Action).where(Action.id == action_data["id"])
                        )
                        existing_action = existing_act.scalar_one_or_none()

                        if existing_action:
                            existing_action.name = action_data.get("name")
                            existing_action.action_type = action_data["action_type"]
                            existing_action.target_service_id = action_data.get("target_service_id")
                            existing_action.parameters = action_data.get("parameters", {})
                            existing_action.delay_ms = action_data.get("delay_ms", 0)
                            existing_action.order = action_data.get("order", 0)
                        else:
                            new_action = Action(
                                id=action_data["id"],
                                sequence_id=seq_data["id"],
                                name=action_data.get("name"),
                                action_type=action_data["action_type"],
                                target_service_id=action_data.get("target_service_id"),
                                parameters=action_data.get("parameters", {}),
                                delay_ms=action_data.get("delay_ms", 0),
                                order=action_data.get("order", 0),
                            )
                            self.db.add(new_action)

            except Exception as e:
                results["errors"].append(f"Session {session_data['id']}: {str(e)}")

        # Import services
        for service_data in config.services:
            try:
                existing = await self.db.execute(
                    select(Service).where(Service.id == service_data["id"])
                )
                existing_service = existing.scalar_one_or_none()

                conflict_key = f"service:{service_data['id']}"
                resolution = conflict_resolutions.get(conflict_key, ConflictResolution.OVERWRITE)

                # Restore secrets if available
                service_config = service_data.get("config", {})
                secrets_key = f"service:{service_data['id']}"
                if secrets_key in decrypted_secrets:
                    service_config = {**service_config, **decrypted_secrets[secrets_key]}

                if existing_service:
                    if resolution == ConflictResolution.SKIP:
                        results["services_skipped"] += 1
                        continue

                    existing_service.name = service_data["name"]
                    existing_service.service_type = service_data["service_type"]
                    existing_service.adapter_name = service_data["adapter_name"]
                    existing_service.config = service_config
                    existing_service.is_enabled = service_data.get("is_enabled", True)
                    results["services_updated"] += 1
                else:
                    new_service = Service(
                        id=service_data["id"],
                        name=service_data["name"],
                        service_type=service_data["service_type"],
                        adapter_name=service_data["adapter_name"],
                        config=service_config,
                        is_enabled=service_data.get("is_enabled", True),
                    )
                    self.db.add(new_service)
                    results["services_created"] += 1

            except Exception as e:
                results["errors"].append(f"Service {service_data['id']}: {str(e)}")

        # Import templates
        for template_data in config.templates:
            try:
                existing = await self.db.execute(
                    select(Template).where(Template.id == template_data["id"])
                )
                existing_template = existing.scalar_one_or_none()

                conflict_key = f"template:{template_data['id']}"
                resolution = conflict_resolutions.get(conflict_key, ConflictResolution.OVERWRITE)

                if existing_template:
                    if resolution == ConflictResolution.SKIP or existing_template.is_builtin:
                        results["templates_skipped"] += 1
                        continue

                    existing_template.name = template_data["name"]
                    existing_template.description = template_data.get("description")
                    existing_template.layout = template_data["layout"]
                    existing_template.components = template_data.get("components", [])
                    existing_template.styles = template_data.get("styles", {})
                    existing_template.is_default = template_data.get("is_default", False)
                    results["templates_updated"] += 1
                else:
                    new_template = Template(
                        id=template_data["id"],
                        name=template_data["name"],
                        description=template_data.get("description"),
                        layout=template_data["layout"],
                        components=template_data.get("components", []),
                        styles=template_data.get("styles", {}),
                        is_default=template_data.get("is_default", False),
                        is_builtin=False,  # Imported templates are never builtin
                    )
                    self.db.add(new_template)
                    results["templates_created"] += 1

            except Exception as e:
                results["errors"].append(f"Template {template_data['id']}: {str(e)}")

        # Import trailer rules
        for rule_data in config.trailer_rules:
            try:
                existing = await self.db.execute(
                    select(TrailerRule).where(TrailerRule.id == rule_data["id"])
                )
                existing_rule = existing.scalar_one_or_none()

                conflict_key = f"trailer_rule:{rule_data['id']}"
                resolution = conflict_resolutions.get(conflict_key, ConflictResolution.OVERWRITE)

                if existing_rule:
                    if resolution == ConflictResolution.SKIP:
                        results["trailer_rules_skipped"] += 1
                        continue

                    existing_rule.name = rule_data["name"]
                    existing_rule.description = rule_data.get("description")
                    existing_rule.is_enabled = rule_data.get("is_enabled", True)
                    existing_rule.genres = rule_data.get("genres")
                    existing_rule.min_year = rule_data.get("min_year")
                    existing_rule.max_year = rule_data.get("max_year")
                    existing_rule.min_rating = rule_data.get("min_rating")
                    existing_rule.max_rating = rule_data.get("max_rating")
                    existing_rule.preferred_quality = rule_data.get("preferred_quality", "1080p")
                    existing_rule.min_quality = rule_data.get("min_quality", "720p")
                    existing_rule.max_storage_gb = rule_data.get("max_storage_gb", 10.0)
                    existing_rule.max_trailer_count = rule_data.get("max_trailer_count")
                    existing_rule.max_downloads_per_run = rule_data.get("max_downloads_per_run", 5)
                    existing_rule.frequency = rule_data.get("frequency", "weekly")
                    existing_rule.rotation_enabled = rule_data.get("rotation_enabled", True)
                    existing_rule.rotation_keep_most_recent = rule_data.get("rotation_keep_most_recent", 20)
                    existing_rule.rotation_keep_most_played = rule_data.get("rotation_keep_most_played", 10)
                    results["trailer_rules_updated"] += 1
                else:
                    new_rule = TrailerRule(
                        id=rule_data["id"],
                        name=rule_data["name"],
                        description=rule_data.get("description"),
                        is_enabled=rule_data.get("is_enabled", True),
                        genres=rule_data.get("genres"),
                        min_year=rule_data.get("min_year"),
                        max_year=rule_data.get("max_year"),
                        min_rating=rule_data.get("min_rating"),
                        max_rating=rule_data.get("max_rating"),
                        preferred_quality=rule_data.get("preferred_quality", "1080p"),
                        min_quality=rule_data.get("min_quality", "720p"),
                        max_storage_gb=rule_data.get("max_storage_gb", 10.0),
                        max_trailer_count=rule_data.get("max_trailer_count"),
                        max_downloads_per_run=rule_data.get("max_downloads_per_run", 5),
                        frequency=rule_data.get("frequency", "weekly"),
                        rotation_enabled=rule_data.get("rotation_enabled", True),
                        rotation_keep_most_recent=rule_data.get("rotation_keep_most_recent", 20),
                        rotation_keep_most_played=rule_data.get("rotation_keep_most_played", 10),
                    )
                    self.db.add(new_rule)
                    results["trailer_rules_created"] += 1

            except Exception as e:
                results["errors"].append(f"TrailerRule {rule_data['id']}: {str(e)}")

        # Import settings
        for key, value in config.settings.items():
            try:
                existing = await self.db.execute(
                    select(Settings).where(Settings.key == key)
                )
                existing_setting = existing.scalar_one_or_none()

                if existing_setting:
                    existing_setting.value = value
                else:
                    new_setting = Settings(key=key, value=value)
                    self.db.add(new_setting)

                results["settings_updated"] += 1

            except Exception as e:
                results["errors"].append(f"Setting {key}: {str(e)}")

        await self.db.commit()

        return results

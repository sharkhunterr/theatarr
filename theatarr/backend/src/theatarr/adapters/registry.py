"""Adapter registry for dynamic adapter discovery and management."""

from typing import Any

from theatarr.adapters.base import AdapterCategory, ServiceAdapter


class AdapterRegistry:
    """Registry for service adapters.

    Handles discovery, registration, and instantiation of adapters.
    """

    _adapters: dict[str, type[ServiceAdapter]] = {}
    _instances: dict[str, ServiceAdapter] = {}

    @classmethod
    def register(cls, adapter_class: type[ServiceAdapter]) -> type[ServiceAdapter]:
        """Register an adapter class.

        Can be used as a decorator:
            @AdapterRegistry.register
            class MyAdapter(ServiceAdapter):
                ...
        """
        adapter_type = adapter_class.adapter_type
        if adapter_type in cls._adapters:
            raise ValueError(f"Adapter '{adapter_type}' is already registered")

        cls._adapters[adapter_type] = adapter_class
        return adapter_class

    @classmethod
    def get_adapter_class(cls, adapter_type: str) -> type[ServiceAdapter] | None:
        """Get an adapter class by type."""
        return cls._adapters.get(adapter_type)

    @classmethod
    def create_adapter(
        cls,
        adapter_type: str,
        config: dict[str, Any],
        instance_id: str | None = None,
    ) -> ServiceAdapter:
        """Create an adapter instance.

        Args:
            adapter_type: The type of adapter to create.
            config: Configuration dictionary for the adapter.
            instance_id: Optional ID to cache the instance.

        Returns:
            The created adapter instance.

        Raises:
            ValueError: If the adapter type is not registered.
        """
        adapter_class = cls._adapters.get(adapter_type)
        if adapter_class is None:
            raise ValueError(f"Unknown adapter type: {adapter_type}")

        adapter = adapter_class(config)

        if instance_id:
            cls._instances[instance_id] = adapter

        return adapter

    @classmethod
    def get_instance(cls, instance_id: str) -> ServiceAdapter | None:
        """Get a cached adapter instance by ID."""
        return cls._instances.get(instance_id)

    @classmethod
    def remove_instance(cls, instance_id: str) -> None:
        """Remove a cached adapter instance."""
        cls._instances.pop(instance_id, None)

    @classmethod
    def list_adapters(
        cls,
        category: AdapterCategory | None = None,
    ) -> list[dict[str, Any]]:
        """List all registered adapters.

        Args:
            category: Optional filter by category.

        Returns:
            List of adapter info dictionaries.
        """
        adapters = []
        for adapter_type, adapter_class in cls._adapters.items():
            if category and adapter_class.category != category:
                continue

            adapters.append(
                {
                    "type": adapter_type,
                    "category": adapter_class.category.value,
                    "display_name": adapter_class.display_name,
                    "config_schema": adapter_class.get_config_schema(),
                }
            )

        return adapters

    @classmethod
    def clear(cls) -> None:
        """Clear all registered adapters and instances (for testing)."""
        cls._adapters.clear()
        cls._instances.clear()


def discover_adapters() -> None:
    """Discover and register all available adapters.

    This imports adapter modules which register themselves via @AdapterRegistry.register.
    """
    # Import adapter modules to trigger registration
    try:
        from theatarr.adapters import mock  # noqa: F401
    except ImportError:
        pass

    # Lighting adapters
    try:
        from theatarr.adapters.lighting import hue  # noqa: F401
    except ImportError:
        pass

    try:
        from theatarr.adapters.lighting import homeassistant  # noqa: F401
    except ImportError:
        pass

    # Media source adapters
    try:
        from theatarr.adapters.media import plex  # noqa: F401
    except ImportError:
        pass

    try:
        from theatarr.adapters.media import jellyfin  # noqa: F401
    except ImportError:
        pass

    # Player adapters
    try:
        from theatarr.adapters.players import androidtv  # noqa: F401
    except ImportError:
        pass

    try:
        from theatarr.adapters.players import chromecast  # noqa: F401
    except ImportError:
        pass

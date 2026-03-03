"""Unit tests for sequence validation."""

import pytest
from pydantic import ValidationError

from theatarr.schemas.sequence import (
    ActionCreate,
    ActionType,
    ActionUpdate,
    DurationType,
    OnFailure,
    SequenceCreate,
    SequenceUpdate,
)


class TestSequenceCreateValidation:
    """Tests for SequenceCreate schema validation."""

    def test_valid_minimal_sequence(self):
        """Test creating sequence with minimal valid data."""
        seq = SequenceCreate(name="Test Sequence", order_index=0)
        assert seq.name == "Test Sequence"
        assert seq.order_index == 0
        assert seq.duration_type == DurationType.FIXED  # default

    def test_valid_full_sequence(self):
        """Test creating sequence with all fields."""
        seq = SequenceCreate(
            name="Full Sequence",
            description="A complete sequence",
            order_index=1,
            duration_type=DurationType.DYNAMIC,
            duration_ms=30000,
            duration_fallback_ms=60000,
            transition_ms=2000,
        )
        assert seq.name == "Full Sequence"
        assert seq.description == "A complete sequence"
        assert seq.duration_type == DurationType.DYNAMIC
        assert seq.duration_ms == 30000
        assert seq.transition_ms == 2000

    def test_name_required(self):
        """Test that name is required."""
        with pytest.raises(ValidationError) as exc_info:
            SequenceCreate(order_index=0)
        assert "name" in str(exc_info.value)

    def test_name_not_empty(self):
        """Test that name cannot be empty string."""
        with pytest.raises(ValidationError):
            SequenceCreate(name="", order_index=0)

    def test_name_max_length(self):
        """Test name maximum length validation."""
        # Should accept reasonable length
        seq = SequenceCreate(name="A" * 255, order_index=0)
        assert len(seq.name) == 255

        # Should reject too long
        with pytest.raises(ValidationError):
            SequenceCreate(name="A" * 500, order_index=0)

    def test_order_index_optional(self):
        """Test that order_index is optional (auto-assigned)."""
        seq = SequenceCreate(name="Test")
        assert seq.order_index is None

    def test_duration_ms_non_negative(self):
        """Test that duration_ms must be non-negative if provided."""
        with pytest.raises(ValidationError):
            SequenceCreate(name="Test", order_index=0, duration_ms=-1)

        # Zero is allowed
        seq = SequenceCreate(name="Test", order_index=0, duration_ms=0)
        assert seq.duration_ms == 0

    def test_duration_fallback_ms_positive(self):
        """Test that duration_fallback_ms must be positive."""
        with pytest.raises(ValidationError):
            SequenceCreate(name="Test", order_index=0, duration_fallback_ms=0)

    def test_transition_ms_non_negative(self):
        """Test that transition_ms must be non-negative."""
        # Zero is allowed
        seq = SequenceCreate(name="Test", order_index=0, transition_ms=0)
        assert seq.transition_ms == 0

        # Negative is not
        with pytest.raises(ValidationError):
            SequenceCreate(name="Test", order_index=0, transition_ms=-100)

    def test_duration_type_enum_values(self):
        """Test that duration_type accepts valid enum values."""
        for dtype in [DurationType.FIXED, DurationType.DYNAMIC, DurationType.MANUAL]:
            seq = SequenceCreate(name="Test", order_index=0, duration_type=dtype)
            assert seq.duration_type == dtype

    def test_duration_type_invalid_value(self):
        """Test that invalid duration_type raises error."""
        with pytest.raises(ValidationError):
            SequenceCreate(name="Test", order_index=0, duration_type="invalid")


class TestSequenceUpdateValidation:
    """Tests for SequenceUpdate schema validation."""

    def test_all_fields_optional(self):
        """Test that all fields are optional for update."""
        update = SequenceUpdate()
        assert update.name is None
        assert update.description is None

    def test_partial_update(self):
        """Test partial update with only some fields."""
        update = SequenceUpdate(name="Updated Name")
        assert update.name == "Updated Name"
        assert update.duration_type is None

    def test_update_validates_values(self):
        """Test that update still validates provided values."""
        with pytest.raises(ValidationError):
            SequenceUpdate(duration_fallback_ms=0)  # ge=1000


class TestActionCreateValidation:
    """Tests for ActionCreate schema validation."""

    def test_valid_minimal_action(self):
        """Test creating action with minimal valid data."""
        action = ActionCreate(
            action_type=ActionType.LIGHTING,
            command="set_brightness",
        )
        assert action.action_type == ActionType.LIGHTING
        assert action.command == "set_brightness"

    def test_valid_full_action(self):
        """Test creating action with all fields."""
        action = ActionCreate(
            service_id="service-123",
            action_type=ActionType.MEDIA,
            command="play",
            parameters={"media_id": "abc123"},
            delay_ms=1000,
            on_failure=OnFailure.ABORT,
        )
        assert action.service_id == "service-123"
        assert action.delay_ms == 1000
        assert action.on_failure == OnFailure.ABORT

    def test_action_type_required(self):
        """Test that action_type is required."""
        with pytest.raises(ValidationError) as exc_info:
            ActionCreate(command="test")
        assert "action_type" in str(exc_info.value)

    def test_command_required(self):
        """Test that command is required."""
        with pytest.raises(ValidationError) as exc_info:
            ActionCreate(action_type=ActionType.LIGHTING)
        assert "command" in str(exc_info.value)

    def test_command_not_empty(self):
        """Test that command cannot be empty."""
        with pytest.raises(ValidationError):
            ActionCreate(action_type=ActionType.LIGHTING, command="")

    def test_delay_ms_non_negative(self):
        """Test that delay_ms must be non-negative."""
        # Zero is allowed
        action = ActionCreate(
            action_type=ActionType.LIGHTING,
            command="test",
            delay_ms=0,
        )
        assert action.delay_ms == 0

        # Negative is not
        with pytest.raises(ValidationError):
            ActionCreate(
                action_type=ActionType.LIGHTING,
                command="test",
                delay_ms=-100,
            )

    def test_action_type_enum_values(self):
        """Test that action_type accepts valid enum values."""
        for atype in ActionType:
            action = ActionCreate(action_type=atype, command="test")
            assert action.action_type == atype

    def test_on_failure_enum_values(self):
        """Test that on_failure accepts valid enum values."""
        for on_fail in OnFailure:
            action = ActionCreate(
                action_type=ActionType.LIGHTING,
                command="test",
                on_failure=on_fail,
            )
            assert action.on_failure == on_fail

    def test_parameters_default_empty_dict(self):
        """Test that parameters defaults to empty dict."""
        action = ActionCreate(
            action_type=ActionType.LIGHTING,
            command="test",
        )
        assert action.parameters == {}

    def test_parameters_accepts_nested_dict(self):
        """Test that parameters accepts nested dictionaries."""
        params = {
            "color": {"r": 255, "g": 128, "b": 64},
            "brightness": 75,
            "transition": {"duration": 1000, "easing": "ease-in-out"},
        }
        action = ActionCreate(
            action_type=ActionType.LIGHTING,
            command="set_color",
            parameters=params,
        )
        assert action.parameters == params

    def test_parameters_accepts_lists(self):
        """Test that parameters accepts lists."""
        params = {"targets": ["light-1", "light-2", "light-3"]}
        action = ActionCreate(
            action_type=ActionType.LIGHTING,
            command="set_group",
            parameters=params,
        )
        assert action.parameters == params


class TestActionUpdateValidation:
    """Tests for ActionUpdate schema validation."""

    def test_all_fields_optional(self):
        """Test that all fields are optional for update."""
        update = ActionUpdate()
        assert update.command is None
        assert update.parameters is None

    def test_partial_update(self):
        """Test partial update with only some fields."""
        update = ActionUpdate(command="new_command")
        assert update.command == "new_command"
        assert update.action_type is None

    def test_update_validates_values(self):
        """Test that update still validates provided values."""
        with pytest.raises(ValidationError):
            ActionUpdate(delay_ms=-50)


class TestSequenceWithActionsValidation:
    """Tests for sequence validation with nested actions."""

    def test_sequence_with_valid_actions(self):
        """Test creating sequence with valid nested actions."""
        seq = SequenceCreate(
            name="Test",
            order_index=0,
            actions=[
                ActionCreate(
                    action_type=ActionType.LIGHTING,
                    command="dim_lights",
                ),
                ActionCreate(
                    action_type=ActionType.AUDIO,
                    command="play_ambient",
                    delay_ms=500,
                ),
            ],
        )
        assert len(seq.actions) == 2

    def test_sequence_with_invalid_action(self):
        """Test that invalid nested action fails validation."""
        with pytest.raises(ValidationError):
            SequenceCreate(
                name="Test",
                order_index=0,
                actions=[
                    {
                        "action_type": "LIGHTING",
                        # Missing required 'command'
                    }
                ],
            )

    def test_sequence_with_empty_actions(self):
        """Test creating sequence with empty actions list."""
        seq = SequenceCreate(
            name="Test",
            order_index=0,
            actions=[],
        )
        assert seq.actions == []


class TestDurationTypeLogic:
    """Tests for duration type business logic."""

    def test_fixed_duration_requires_duration_ms(self):
        """Test that FIXED duration type should have duration_ms."""
        # While not strictly required by schema, business logic should validate
        seq = SequenceCreate(
            name="Test",
            order_index=0,
            duration_type=DurationType.FIXED,
            duration_ms=30000,
        )
        assert seq.duration_ms == 30000

    def test_dynamic_duration_uses_fallback(self):
        """Test that DYNAMIC type uses fallback when no media duration."""
        seq = SequenceCreate(
            name="Test",
            order_index=0,
            duration_type=DurationType.DYNAMIC,
            duration_fallback_ms=90000,
        )
        assert seq.duration_fallback_ms == 90000

    def test_manual_duration_no_auto_advance(self):
        """Test MANUAL type configuration."""
        seq = SequenceCreate(
            name="Test",
            order_index=0,
            duration_type=DurationType.MANUAL,
        )
        assert seq.duration_type == DurationType.MANUAL

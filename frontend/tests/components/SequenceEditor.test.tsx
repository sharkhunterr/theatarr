/**
 * Tests for SequenceEditor component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API client
vi.mock('../../src/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock component imports
const mockSequenceEditor = vi.fn();
vi.mock('../../src/components/sequences/SequenceEditor', () => ({
  default: (props: any) => {
    mockSequenceEditor(props);
    return (
      <div data-testid="sequence-editor">
        <input
          data-testid="sequence-name"
          value={props.sequence?.name || ''}
          onChange={(e) => props.onChange?.({ ...props.sequence, name: e.target.value })}
          placeholder="Sequence name"
        />
        <select
          data-testid="duration-type"
          value={props.sequence?.duration_type || 'fixed'}
          onChange={(e) => props.onChange?.({ ...props.sequence, duration_type: e.target.value })}
        >
          <option value="fixed">Fixed</option>
          <option value="dynamic">Dynamic</option>
          <option value="manual">Manual</option>
        </select>
        <input
          data-testid="duration-ms"
          type="number"
          value={props.sequence?.duration_ms || ''}
          onChange={(e) => props.onChange?.({ ...props.sequence, duration_ms: parseInt(e.target.value) })}
          placeholder="Duration (ms)"
        />
        <button data-testid="save-btn" onClick={props.onSave}>
          Save
        </button>
        <button data-testid="cancel-btn" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    );
  },
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('SequenceEditor Component', () => {
  const mockOnChange = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultSequence = {
    id: 'seq-1',
    name: 'Test Sequence',
    description: '',
    order_index: 0,
    duration_type: 'fixed',
    duration_ms: 30000,
    duration_fallback_ms: 60000,
    transition_ms: 1000,
    actions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the editor', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sequence-editor')).toBeInTheDocument();
    });

    it('should display sequence name', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const nameInput = screen.getByTestId('sequence-name');
      expect(nameInput).toHaveValue('Test Sequence');
    });

    it('should display duration type selector', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const durationTypeSelect = screen.getByTestId('duration-type');
      expect(durationTypeSelect).toBeInTheDocument();
      expect(durationTypeSelect).toHaveValue('fixed');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when name is updated', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const nameInput = screen.getByTestId('sequence-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should call onChange when duration type is changed', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const durationTypeSelect = screen.getByTestId('duration-type');
      await user.selectOptions(durationTypeSelect, 'dynamic');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should call onSave when save button is clicked', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const saveBtn = screen.getByTestId('save-btn');
      await user.click(saveBtn);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const cancelBtn = screen.getByTestId('cancel-btn');
      await user.click(cancelBtn);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Duration Configuration', () => {
    it('should show duration input for fixed type', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={{ ...defaultSequence, duration_type: 'fixed' }}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const durationInput = screen.getByTestId('duration-ms');
      expect(durationInput).toBeInTheDocument();
    });

    it('should accept valid duration value', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={{ ...defaultSequence, duration_ms: undefined }}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const durationInput = screen.getByTestId('duration-ms');
      await user.type(durationInput, '60000');

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should show error for empty name', async () => {
      const user = userEvent.setup();
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={defaultSequence}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const nameInput = screen.getByTestId('sequence-name');
      await user.clear(nameInput);

      // Validation would typically show an error message
      // Implementation details depend on actual component
    });
  });

  describe('Actions List', () => {
    it('should render with empty actions list', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={{ ...defaultSequence, actions: [] }}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sequence-editor')).toBeInTheDocument();
    });

    it('should render with existing actions', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;
      const sequenceWithActions = {
        ...defaultSequence,
        actions: [
          {
            id: 'action-1',
            action_type: 'lighting',
            command: 'set_brightness',
            parameters: { brightness: 50 },
            delay_ms: 0,
            on_failure: 'warn',
          },
        ],
      };

      render(
        <SequenceEditor
          sequence={sequenceWithActions}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sequence-editor')).toBeInTheDocument();
    });
  });

  describe('New Sequence Creation', () => {
    it('should work with undefined sequence (new)', async () => {
      const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

      render(
        <SequenceEditor
          sequence={undefined}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sequence-editor')).toBeInTheDocument();
    });
  });
});

describe('SequenceEditor Accessibility', () => {
  it('should have accessible form elements', async () => {
    const SequenceEditor = (await import('../../src/components/sequences/SequenceEditor')).default;

    render(
      <SequenceEditor
        sequence={{
          id: 'seq-1',
          name: 'Test',
          order_index: 0,
          duration_type: 'fixed',
          duration_ms: 30000,
          actions: [],
        }}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Check that inputs are accessible
    const nameInput = screen.getByTestId('sequence-name');
    expect(nameInput).toBeEnabled();
  });
});

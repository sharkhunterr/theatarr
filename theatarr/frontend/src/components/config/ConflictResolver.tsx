import { AlertTriangle, RefreshCw, SkipForward, Copy, Merge } from 'lucide-react';

interface Conflict {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  conflict_type: string;
  details: string;
  existing_data: Record<string, unknown> | null;
  incoming_data: Record<string, unknown> | null;
}

interface ConflictResolverProps {
  conflicts: Conflict[];
  resolutions: Record<string, string>;
  onResolutionChange: (key: string, resolution: string) => void;
}

const RESOLUTION_OPTIONS = [
  {
    value: 'overwrite',
    label: 'Overwrite',
    icon: RefreshCw,
    description: 'Replace existing with imported',
    color: 'text-yellow-400',
  },
  {
    value: 'skip',
    label: 'Skip',
    icon: SkipForward,
    description: 'Keep existing, ignore imported',
    color: 'text-gray-400',
  },
  {
    value: 'rename',
    label: 'Rename',
    icon: Copy,
    description: 'Create new with different name',
    color: 'text-blue-400',
  },
  {
    value: 'merge',
    label: 'Merge',
    icon: Merge,
    description: 'Combine both configurations',
    color: 'text-green-400',
  },
];

function getConflictTypeLabel(type: string): string {
  switch (type) {
    case 'duplicate':
      return 'Duplicate ID';
    case 'version_mismatch':
      return 'Version Mismatch';
    case 'missing_dependency':
      return 'Missing Dependency';
    case 'schema_changed':
      return 'Schema Changed';
    default:
      return type;
  }
}

function getEntityTypeLabel(type: string): string {
  switch (type) {
    case 'session':
      return 'Session';
    case 'service':
      return 'Service';
    case 'template':
      return 'Template';
    case 'trailer_rule':
      return 'Trailer Rule';
    default:
      return type;
  }
}

export function ConflictResolver({
  conflicts,
  resolutions,
  onResolutionChange,
}: ConflictResolverProps) {
  // Group conflicts by entity type
  const groupedConflicts = conflicts.reduce(
    (acc, conflict) => {
      const type = conflict.entity_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(conflict);
      return acc;
    },
    {} as Record<string, Conflict[]>
  );

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      <div className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg">
        <span className="text-sm text-gray-400">Apply to all:</span>
        <div className="flex gap-2">
          {RESOLUTION_OPTIONS.slice(0, 2).map((option) => (
            <button
              key={option.value}
              onClick={() => {
                conflicts.forEach((c) => {
                  onResolutionChange(`${c.entity_type}:${c.entity_id}`, option.value);
                });
              }}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {option.label} All
            </button>
          ))}
        </div>
      </div>

      {/* Conflicts by Type */}
      {Object.entries(groupedConflicts).map(([type, typeConflicts]) => (
        <div key={type}>
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {getEntityTypeLabel(type)} ({typeConflicts.length})
          </h3>
          <div className="space-y-3">
            {typeConflicts.map((conflict) => {
              const key = `${conflict.entity_type}:${conflict.entity_id}`;
              const currentResolution = resolutions[key] || 'overwrite';

              return (
                <div key={key} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-yellow-400" />
                        <span className="font-medium">{conflict.entity_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-700 rounded">
                          {getConflictTypeLabel(conflict.conflict_type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{conflict.details}</p>

                      {/* Show data comparison */}
                      {(conflict.existing_data || conflict.incoming_data) && (
                        <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                          {conflict.existing_data && (
                            <div className="bg-gray-700/50 p-2 rounded">
                              <div className="text-gray-500 mb-1">Existing:</div>
                              <pre className="text-gray-300 whitespace-pre-wrap">
                                {JSON.stringify(conflict.existing_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {conflict.incoming_data && (
                            <div className="bg-gray-700/50 p-2 rounded">
                              <div className="text-gray-500 mb-1">Incoming:</div>
                              <pre className="text-gray-300 whitespace-pre-wrap">
                                {JSON.stringify(conflict.incoming_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resolution Selector */}
                    <div className="flex flex-col gap-1">
                      {RESOLUTION_OPTIONS.slice(0, 2).map((option) => {
                        const Icon = option.icon;
                        const isSelected = currentResolution === option.value;

                        return (
                          <button
                            key={option.value}
                            onClick={() => onResolutionChange(key, option.value)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                              isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                            title={option.description}
                          >
                            <Icon size={14} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="text-sm font-medium mb-2">Resolution Summary</div>
        <div className="flex gap-4 text-sm">
          <div className="text-yellow-400">
            Overwrite:{' '}
            {Object.values(resolutions).filter((r) => r === 'overwrite').length}
          </div>
          <div className="text-gray-400">
            Skip: {Object.values(resolutions).filter((r) => r === 'skip').length}
          </div>
          <div className="text-blue-400">
            Rename: {Object.values(resolutions).filter((r) => r === 'rename').length}
          </div>
          <div className="text-green-400">
            Merge: {Object.values(resolutions).filter((r) => r === 'merge').length}
          </div>
        </div>
      </div>
    </div>
  );
}

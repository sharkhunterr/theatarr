import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent, CardHeader } from '../common';
import { apiClient } from '../../api/client';

interface Capability {
  name: string;
  parameters: string[];
  description?: string;
}

interface CapabilitiesResponse {
  service_id: string;
  adapter_type: string;
  capabilities: Capability[];
  discovered_at: string;
}

interface CapabilitiesDisplayProps {
  serviceId: string;
  initialCapabilities?: Capability[];
  onRefresh?: (capabilities: Capability[]) => void;
}

export function CapabilitiesDisplay({
  serviceId,
  initialCapabilities = [],
  onRefresh,
}: CapabilitiesDisplayProps) {
  const [capabilities, setCapabilities] = useState<Capability[]>(initialCapabilities);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [lastDiscovered, setLastDiscovered] = useState<string | null>(null);

  const handleDiscover = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<CapabilitiesResponse>(
        `/api/v1/services/${serviceId}/capabilities`
      );
      setCapabilities(response.capabilities);
      setLastDiscovered(response.discovered_at);
      onRefresh?.(response.capabilities);
    } catch (error) {
      console.error('Failed to discover capabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCapability = (name: string) => {
    const newExpanded = new Set(expandedCapabilities);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCapabilities(newExpanded);
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-theatarr-500" />
          <h3 className="font-medium text-dark-text">Capabilities</h3>
          <span className="text-sm text-dark-muted">({capabilities.length})</span>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDiscover} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="ml-1">Discover</span>
        </Button>
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <div className="text-center py-4 text-dark-muted text-sm">
            <p>No capabilities discovered yet.</p>
            <p className="mt-1">Click "Discover" to fetch capabilities from the service.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {capabilities.map((capability) => {
              const isExpanded = expandedCapabilities.has(capability.name);
              const hasDetails =
                capability.parameters.length > 0 || capability.description;

              return (
                <div key={capability.name} className="border border-dark-border rounded-lg">
                  <button
                    onClick={() => hasDetails && toggleCapability(capability.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                      hasDetails ? 'cursor-pointer hover:bg-dark-bg/50' : ''
                    }`}
                    disabled={!hasDetails}
                  >
                    {hasDetails ? (
                      isExpanded ? (
                        <ChevronDown size={14} className="text-dark-muted" />
                      ) : (
                        <ChevronRight size={14} className="text-dark-muted" />
                      )
                    ) : (
                      <div className="w-3.5" />
                    )}
                    <span className="font-mono text-sm text-dark-text">{capability.name}</span>
                    {capability.parameters.length > 0 && (
                      <span className="text-xs text-dark-muted">
                        ({capability.parameters.length} params)
                      </span>
                    )}
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="px-3 pb-3 pl-8">
                      {capability.description && (
                        <p className="text-sm text-dark-muted mb-2">{capability.description}</p>
                      )}
                      {capability.parameters.length > 0 && (
                        <div>
                          <div className="text-xs text-dark-muted mb-1">Parameters:</div>
                          <div className="flex flex-wrap gap-1">
                            {capability.parameters.map((param) => (
                              <span
                                key={param}
                                className="px-2 py-0.5 bg-dark-bg rounded text-xs font-mono text-dark-text"
                              >
                                {param}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {lastDiscovered && (
          <div className="mt-3 text-xs text-dark-muted">
            Last discovered: {new Date(lastDiscovered).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

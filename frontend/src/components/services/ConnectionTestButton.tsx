import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../common';
import { apiClient } from '../../api/client';

interface ConnectionTestResult {
  success: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  message?: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
}

interface ConnectionTestButtonProps {
  serviceId: string;
  onResult?: (result: ConnectionTestResult) => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ConnectionTestButton({
  serviceId,
  onResult,
  size = 'md',
  showLabel = true,
}: ConnectionTestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post<ConnectionTestResult>(
        `/services/${serviceId}/test`, {}
      );
      setResult(response);
      onResult?.(response);
    } catch (error) {
      const errorResult: ConnectionTestResult = {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
      setResult(errorResult);
      onResult?.(errorResult);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!result) return null;

    if (result.success) {
      return <CheckCircle size={16} className="text-green-500" />;
    } else if (result.status === 'error') {
      return <XCircle size={16} className="text-red-500" />;
    } else {
      return <AlertCircle size={16} className="text-yellow-500" />;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size={size}
        onClick={handleTest}
        disabled={isLoading}
      >
        <RefreshCw size={size === 'sm' ? 14 : 16} className={isLoading ? 'animate-spin' : ''} />
        {showLabel && <span className="ml-1">Test Connection</span>}
      </Button>

      {result && (
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div className="text-sm">
            <span
              className={
                result.success
                  ? 'text-green-400'
                  : result.status === 'error'
                  ? 'text-red-400'
                  : 'text-yellow-400'
              }
            >
              {result.success ? 'Connected' : result.message || 'Failed'}
            </span>
            {result.latency_ms !== undefined && result.success && (
              <span className="text-dark-muted ml-2">({result.latency_ms}ms)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

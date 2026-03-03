import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface SettingsData {
  settings: Record<string, unknown>;
}

export function useSetting<T = unknown>(key: string, defaultValue: T): T {
  const { data } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => apiClient.get<SettingsData>('/config/settings'),
    staleTime: 5 * 60 * 1000,
  });

  return (data?.settings?.[key] as T) ?? defaultValue;
}

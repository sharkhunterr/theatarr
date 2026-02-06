/**
 * API client for Theatarr backend.
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_URL = `${API_BASE}/api/v1`;

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Get the stored auth token.
 */
function getAuthToken(): string | null {
  return localStorage.getItem('theatarr_token');
}

/**
 * Set the auth token.
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('theatarr_token', token);
}

/**
 * Clear the auth token.
 */
export function clearAuthToken(): void {
  localStorage.removeItem('theatarr_token');
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Make an API request.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Add auth header if not skipping and token exists
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  // Handle no content response
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    // FastAPI returns {"detail": "message"} or {"detail": [...validation errors...]}
    // Our custom errors return {"error": {"code": "...", "message": "..."}}
    const error = data.error as ApiError | undefined;
    let message = 'An error occurred';

    if (data.detail) {
      // FastAPI error format
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Validation errors from Pydantic
        message = data.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
      }
    } else if (error?.message) {
      message = error.message;
    }

    throw new ApiClientError(
      response.status,
      error?.code || 'UNKNOWN_ERROR',
      message,
      error?.field
    );
  }

  return data as T;
}

/**
 * API client with typed methods.
 */
export const apiClient = {
  // Auth
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        data.error?.code || 'AUTH_FAILED',
        data.detail || 'Authentication failed'
      );
    }

    return data as { access_token: string; token_type: string; expires_in: number };
  },

  getMe: () => request<{ id: string; username: string; is_active: boolean }>('/auth/me'),

  refreshToken: () =>
    request<{ access_token: string; token_type: string; expires_in: number }>(
      '/auth/refresh',
      { method: 'POST' }
    ),

  // Info
  getInfo: () =>
    request<{
      name: string;
      version: string;
      description: string;
      features: Record<string, boolean>;
    }>('/info', { skipAuth: true }),

  // Generic CRUD helpers (will be expanded as APIs are implemented)
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

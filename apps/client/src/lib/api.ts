import type {
  ApiErrorPayload,
  ApiSuccessPayload,
  PaginationMeta,
} from '@cinemax/shared';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function rawApiFetch<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<ApiSuccessPayload<T>> {
  const headers = new Headers(init.headers);
  // Do not force global Content-Type when body is FormData or absent
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const json = (await response.json().catch(() => null)) as
    | ApiSuccessPayload<T>
    | ApiErrorPayload
    | null;

  if (!response.ok || !json || 'error' in json) {
    const errObj = json && 'error' in json ? json.error : null;
    throw new ApiClientError(
      response.status,
      errObj?.code ?? 'HTTP_ERROR',
      errObj?.message ?? `Request failed with status ${response.status}`,
      errObj?.details,
    );
  }

  return json;
}

export async function apiRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const payload = await rawApiFetch<T>(endpoint, init);
  return payload.data;
}

export async function apiRequestWithMeta<T, M = PaginationMeta>(
  endpoint: string,
  init: RequestInit = {},
): Promise<{ data: T; meta: M }> {
  const payload = await rawApiFetch<T>(endpoint, init);
  return { data: payload.data, meta: payload.meta as M };
}

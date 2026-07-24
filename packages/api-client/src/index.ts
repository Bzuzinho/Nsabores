export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  constructor(private readonly baseUrl: string) {}

  async request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (
      response.status === 401 &&
      retry &&
      !path.startsWith('/v1/auth/refresh') &&
      !path.startsWith('/v1/auth/login')
    ) {
      if (await this.refresh()) return this.request<T>(path, init, false);
    }
    if (!response.ok) {
      const details: unknown = await response.json().catch(() => null);
      const message =
        typeof details === 'object' &&
        details !== null &&
        'message' in details &&
        typeof details.message === 'string'
          ? details.message
          : 'Não foi possível concluir o pedido.';
      throw new ApiError(message, response.status, details);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private refresh() {
    this.refreshPromise ??= fetch(`${this.baseUrl}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }
}

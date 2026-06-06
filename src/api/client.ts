export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  mode: import.meta.env.VITE_API_MODE ?? "api",
  useMockFallback: import.meta.env.VITE_USE_MOCK_FALLBACK !== "false",
};

export async function apiJson<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? `API request failed: ${response.status}`,
      response.status,
      error?.code,
    );
  }

  return payload as TResponse;
}

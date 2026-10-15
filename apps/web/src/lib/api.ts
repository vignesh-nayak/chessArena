import type { ApiError } from "@chessarena/shared";
import { ApiErrorSchema } from "@chessarena/shared";
import { useAuthStore } from "../store/authStore";

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  "",
);

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiError["error"]["code"] | "UNKNOWN";

  constructor(
    status: number,
    code: ApiError["error"]["code"] | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export function getApiBase(): string {
  if (!apiBase) {
    throw new Error("VITE_API_URL is not configured");
  }
  return apiBase;
}

function parseErrorBody(json: unknown, fallback: string): ApiRequestError {
  const parsed = ApiErrorSchema.safeParse(json);
  if (parsed.success) {
    return new ApiRequestError(
      0,
      parsed.data.error.code,
      parsed.data.error.message,
    );
  }
  return new ApiRequestError(0, "UNKNOWN", fallback);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  retryOnUnauthorized?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const json: unknown = await res.json();
        if (
          typeof json !== "object" ||
          json === null ||
          typeof (json as { accessToken?: unknown }).accessToken !== "string"
        ) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const accessToken = (json as { accessToken: string }).accessToken;
        useAuthStore.getState().setAccessToken(accessToken);
        return accessToken;
      } catch {
        useAuthStore.getState().clearSession();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    accessToken = useAuthStore.getState().accessToken,
    retryOnUnauthorized = true,
  } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && retryOnUnauthorized && path !== "/api/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, {
        ...options,
        accessToken: newToken,
        retryOnUnauthorized: false,
      });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = parseErrorBody(json, `Request failed (${res.status})`);
    throw new ApiRequestError(res.status, err.code, err.message);
  }

  return json as T;
}

export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  store.setBootstrapping(true);
  try {
    const accessToken = await refreshAccessToken();
    if (!accessToken) {
      store.clearSession();
      return;
    }
    const me = await apiFetch<{
      id: string;
      username: string;
      email: string;
      stats: { wins: number; losses: number; draws: number };
      createdAt: string;
    }>("/api/users/me", {
      accessToken,
      retryOnUnauthorized: false,
    });
    store.setSession(accessToken, {
      id: me.id,
      username: me.username,
      email: me.email,
    });
  } catch {
    store.clearSession();
  } finally {
    store.setBootstrapping(false);
  }
}

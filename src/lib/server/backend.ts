export type BackendEnvelope<T> =
  | {
      success: true;
      data: T;
      meta: Record<string, unknown>;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      meta: Record<string, unknown>;
    };

export type BackendHttpResult<T> = {
  response: Response;
  payload: BackendEnvelope<T> | null;
};

type BackendRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  sessionId?: string | null;
};

function backendBaseUrl(): string {
  const value = process.env.ELECT_BACKEND_URL?.trim();

  if (!value) {
    throw new Error("ELECT_BACKEND_URL is not configured.");
  }

  return value.replace(/\/$/, "");
}

function backendGatewaySecret(): string {
  const value = process.env.ELECT_BFF_SECRET?.trim();

  if (!value) {
    throw new Error("ELECT_BFF_SECRET is not configured.");
  }

  return value;
}

function backendTimeout(): number {
  const configured = Number(process.env.ELECT_BACKEND_TIMEOUT_MS ?? "10000");
  return Number.isFinite(configured) && configured > 0 ? configured : 10000;
}

export async function backendRawRequest(
  path: string,
  options: BackendRequestOptions = {},
): Promise<Response> {
  if (!path.startsWith("/")) {
    throw new Error("Backend paths must start with '/'.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), backendTimeout());

  try {
    const headers = new Headers(options.headers);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    headers.set("X-Geniura-BFF-Key", backendGatewaySecret());

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (options.sessionId) {
      headers.set("Cookie", `session_id=${options.sessionId}`);
    }

    return await fetch(`${backendBaseUrl()}${path}`, {
      ...options,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function backendHttp<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<BackendHttpResult<T>> {
  const response = await backendRawRequest(path, options);
  const payload = (await response
    .json()
    .catch(() => null)) as BackendEnvelope<T> | null;

  return {
    response,
    payload,
  };
}

export async function backendRequest<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<T> {
  const { response, payload } = await backendHttp<T>(path, options);

  if (!response.ok || !payload || !payload.success) {
    const message =
      payload && !payload.success
        ? payload.error.message
        : `Backend request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload.data;
}

type BackendRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function backendBaseUrl(): string {
  const value = process.env.ELECT_BACKEND_URL?.trim();

  if (!value) {
    throw new Error("ELECT_BACKEND_URL is not configured.");
  }

  return value.replace(/\/$/, "");
}

function backendTimeout(): number {
  const configured = Number(process.env.ELECT_BACKEND_TIMEOUT_MS ?? "10000");
  return Number.isFinite(configured) && configured > 0 ? configured : 10000;
}

export async function backendRequest<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<T> {
  if (!path.startsWith("/")) {
    throw new Error("Backend paths must start with '/'.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), backendTimeout());

  try {
    const response = await fetch(`${backendBaseUrl()}${path}`, {
      ...options,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as T | null;

    if (!response.ok) {
      throw new Error(
        `Backend request failed with HTTP ${response.status}.`,
      );
    }

    if (payload === null) {
      throw new Error("Backend returned an invalid JSON response.");
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

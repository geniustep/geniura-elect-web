import { NextResponse } from "next/server";

import { backendHttp } from "@/lib/server/backend";
import { isSameOriginRequest } from "@/lib/server/same-origin";
import { readElectSessionId } from "@/lib/server/session";

type ProxyOptions = {
  method?: string;
  body?: unknown;
  requireSameOrigin?: boolean;
};

export async function proxyOperation<T>(
  request: Request,
  backendPath: string,
  options: ProxyOptions = {},
) {
  if (
    options.requireSameOrigin !== false &&
    options.method &&
    options.method !== "GET" &&
    !isSameOriginRequest(request)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "origin_forbidden",
          message: "Invalid request origin.",
        },
      },
      { status: 403 },
    );
  }

  const sessionId = await readElectSessionId();
  if (!sessionId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unauthorized",
          message: "Authentication required.",
        },
      },
      { status: 401 },
    );
  }

  try {
    const { response, payload } = await backendHttp<T>(backendPath, {
      method: options.method ?? "GET",
      body: options.body,
      sessionId,
    });

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "invalid_backend_response",
            message: "Invalid backend response.",
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json(payload, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "backend_unavailable",
          message: "Backend service is unavailable.",
        },
      },
      { status: 503 },
    );
  }
}

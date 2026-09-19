import { NextResponse } from "next/server";

import { backendHttp } from "@/lib/server/backend";
import { isSameOriginRequest } from "@/lib/server/same-origin";
import {
  ELECT_SESSION_COOKIE,
  extractOdooSessionId,
  type ElectUser,
} from "@/lib/server/session";

type LoginBackendPayload = {
  user: ElectUser;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "invalid_json",
          message: "Invalid request body.",
        },
      },
      { status: 400 },
    );
  }

  const input = body as { login?: unknown; password?: unknown };
  const login = typeof input.login === "string" ? input.login.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!login || !password) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "validation_error",
          message: "أدخل اسم الدخول وكلمة المرور.",
        },
      },
      { status: 422 },
    );
  }

  try {
    const { response, payload } = await backendHttp<LoginBackendPayload>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: { login, password },
      },
    );

    if (!response.ok || !payload?.success) {
      const message =
        payload && !payload.success
          ? payload.error.message
          : "تعذر تسجيل الدخول.";
      return NextResponse.json(
        {
          success: false,
          error: {
            code:
              payload && !payload.success
                ? payload.error.code
                : "login_failed",
            message,
          },
        },
        { status: response.status || 401 },
      );
    }

    const sessionId = extractOdooSessionId(response.headers.get("set-cookie"));

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "session_not_created",
            message: "تعذر إنشاء جلسة آمنة.",
          },
        },
        { status: 502 },
      );
    }

    const nextResponse = NextResponse.json({
      success: true,
      data: {
        user: payload.data.user,
      },
    });

    nextResponse.cookies.set(ELECT_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return nextResponse;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "backend_unavailable",
          message: "خدمة تسجيل الدخول غير متاحة حاليًا.",
        },
      },
      { status: 503 },
    );
  }
}

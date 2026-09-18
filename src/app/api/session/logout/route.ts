import { NextResponse } from "next/server";

import { backendHttp } from "@/lib/server/backend";
import { isSameOriginRequest } from "@/lib/server/same-origin";
import {
  ELECT_SESSION_COOKIE,
  readElectSessionId,
} from "@/lib/server/session";

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

  const sessionId = await readElectSessionId();

  if (sessionId) {
    try {
      await backendHttp("/api/v1/auth/logout", {
        method: "POST",
        sessionId,
      });
    } catch {
      // Local session invalidation still proceeds.
    }
  }

  const response = NextResponse.json({
    success: true,
    data: { logged_out: true },
  });
  response.cookies.set(ELECT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

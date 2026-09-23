import { NextResponse } from "next/server";

import { backendRawRequest } from "@/lib/server/backend";
import { readElectSessionId } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ partyId: string }> },
) {
  const { partyId } = await context.params;
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
    const response = await backendRawRequest(
      `/api/v1/parties/${encodeURIComponent(partyId)}/logo`,
      {
        method: "GET",
        headers: { Accept: "image/*" },
        sessionId,
      },
    );

    if (!response.ok) {
      return new Response(null, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream",
    );
    headers.set("Cache-Control", "private, max-age=3600");

    const disposition = response.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);

    return new Response(response.body, {
      status: 200,
      headers,
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

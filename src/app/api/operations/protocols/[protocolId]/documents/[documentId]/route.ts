import { NextResponse } from "next/server";

import { backendRawRequest } from "@/lib/server/backend";
import { readElectSessionId } from "@/lib/server/session";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ protocolId: string; documentId: string }>;
  },
) {
  const { protocolId, documentId } = await context.params;
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
      `/api/v1/protocols/${encodeURIComponent(protocolId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "GET",
        headers: { Accept: "*/*" },
        sessionId,
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return NextResponse.json(
        payload ?? {
          success: false,
          error: {
            code: "document_unavailable",
            message: "Protocol document is unavailable.",
          },
        },
        { status: response.status },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream",
    );
    headers.set("Cache-Control", "no-store");

    const disposition = response.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }

    return new Response(response.body, {
      status: response.status,
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

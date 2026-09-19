import { NextResponse } from "next/server";

import { proxyOperation } from "@/lib/server/operation-proxy";

const ACTIONS = new Set(["validate", "verify", "reject", "reopen"]);

export async function POST(
  request: Request,
  context: {
    params: Promise<{ protocolId: string; action: string }>;
  },
) {
  const { protocolId, action } = await context.params;

  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "not_found",
          message: "Unknown protocol action.",
        },
      },
      { status: 404 },
    );
  }

  let body: unknown = undefined;
  if (action === "reject" || action === "reopen") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  return proxyOperation(
    request,
    `/api/v1/protocols/${encodeURIComponent(protocolId)}/${action}`,
    { method: "POST", body },
  );
}

import { NextResponse } from "next/server";

import { proxyOperation } from "@/lib/server/operation-proxy";

type RouteContext = {
  params: Promise<{ electionId: string; path?: string[] }>;
};

function backendPath(electionId: string, path?: string[]) {
  const suffix = path?.length
    ? `/${path.map((item) => encodeURIComponent(item)).join("/")}`
    : "";
  return `/api/v1/elections/${encodeURIComponent(electionId)}/setup${suffix}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { electionId, path } = await context.params;
  return proxyOperation(request, backendPath(electionId, path), {
    method: "GET",
    requireSameOrigin: false,
  });
}

async function mutate(
  request: Request,
  context: RouteContext,
  method: "POST" | "PUT",
) {
  const { electionId, path } = await context.params;
  if (!path?.length) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "validation_error",
          message: "مسار الإعداد غير مكتمل.",
        },
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return proxyOperation(request, backendPath(electionId, path), {
    method,
    body,
  });
}

export async function POST(request: Request, context: RouteContext) {
  return mutate(request, context, "POST");
}

export async function PUT(request: Request, context: RouteContext) {
  return mutate(request, context, "PUT");
}

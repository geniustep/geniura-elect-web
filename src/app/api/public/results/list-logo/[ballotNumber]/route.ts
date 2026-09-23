import { NextResponse } from "next/server";

import { backendRawRequest } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ballotNumber: string }> },
) {
  const { ballotNumber } = await context.params;
  const normalized = Number.parseInt(ballotNumber, 10);

  if (!Number.isInteger(normalized) || normalized < 0) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const response = await backendRawRequest(
      `/api/v1/public/results/list-logo/${normalized}`,
      {
        method: "GET",
        headers: { Accept: "image/*" },
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
    headers.set("Cache-Control", "public, s-maxage=3600, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");

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
          code: "public_logo_unavailable",
          message: "تعذر تحميل الشعار مؤقتًا.",
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

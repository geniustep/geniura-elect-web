import { NextResponse } from "next/server";

import type { PublicResultsPayload } from "@/lib/elect/public-results";
import { backendHttp } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

const SUCCESS_CACHE_CONTROL =
  "public, s-maxage=2, max-age=0, must-revalidate";

function unavailable(status = 503) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "public_results_unavailable",
        message: "تعذر تحديث النتائج مؤقتًا.",
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET() {
  try {
    const { response, payload } = await backendHttp<PublicResultsPayload>(
      "/api/v1/public/results",
      {
        method: "GET",
      },
    );

    if (!response.ok || !payload || !payload.success) {
      return unavailable(response.status >= 500 ? 503 : response.status);
    }

    return NextResponse.json(
      {
        success: true,
        data: payload.data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": SUCCESS_CACHE_CONTROL,
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return unavailable();
  }
}

import { NextResponse } from "next/server";

import type { PublicResultsPayload } from "@/lib/elect/public-results";
import { backendHttp } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

const SUCCESS_CACHE_CONTROL =
  "public, s-maxage=2, max-age=0, must-revalidate";

const PUBLIC_RESULTS_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function normalizeCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || "";
  if (!normalized || normalized.length > 64) return null;
  return PUBLIC_RESULTS_CODE_PATTERN.test(normalized) ? normalized : null;
}

function codeError(
  code: "invalid_public_results_code" | "public_results_scope_unavailable",
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
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

export async function GET(request: Request) {
  const requestedRaw = new URL(request.url).searchParams.get("code");
  const requestedCode = requestedRaw === null ? null : normalizeCode(requestedRaw);
  const configuredCode = normalizeCode(
    process.env.ELECT_PUBLIC_RESULTS_CONSTITUENCY_CODE,
  );

  if (requestedRaw !== null && !requestedCode) {
    return codeError(
      "invalid_public_results_code",
      "كود الدائرة غير صالح.",
      400,
    );
  }

  if (requestedCode && !configuredCode) {
    return codeError(
      "public_results_scope_unavailable",
      "نطاق النتائج العامة غير مهيأ لهذا الكود.",
      503,
    );
  }

  if (requestedCode && configuredCode && requestedCode !== configuredCode) {
    return codeError(
      "public_results_scope_unavailable",
      "نطاق النتائج العامة غير متاح لهذا الكود.",
      404,
    );
  }

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

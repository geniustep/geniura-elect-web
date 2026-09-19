import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unauthorized",
          message: "Authentication required.",
        },
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: { user },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

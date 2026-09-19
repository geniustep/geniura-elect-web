import { cookies } from "next/headers";

import { backendHttp } from "@/lib/server/backend";

export const ELECT_SESSION_COOKIE = "geniura_elect_session";

export type ElectUser = {
  id: number;
  name: string;
  login: string;
  role: "observer" | "coordinator" | "manager";
  organization: {
    id: number;
    name: string;
    code: string;
  };
  organizations: Array<{
    id: number;
    name: string;
    code: string;
  }>;
};

type MePayload = {
  user: ElectUser;
};

export async function readElectSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ELECT_SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<ElectUser | null> {
  const sessionId = await readElectSessionId();

  if (!sessionId) {
    return null;
  }

  try {
    const { response, payload } = await backendHttp<MePayload>("/api/v1/me", {
      method: "GET",
      sessionId,
    });

    if (!response.ok || !payload?.success) {
      return null;
    }

    return payload.data.user;
  } catch {
    return null;
  }
}

export function extractOdooSessionId(setCookie: string | null): string | null {
  if (!setCookie) {
    return null;
  }

  const match = setCookie.match(/(?:^|[,;]\s*)session_id=([^;,]+)/i);
  return match?.[1] ?? null;
}

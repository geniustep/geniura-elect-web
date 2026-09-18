import { proxyOperation } from "@/lib/server/operation-proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ officeId: string }> },
) {
  const { officeId } = await context.params;
  return proxyOperation(
    request,
    `/api/v1/polling-offices/${encodeURIComponent(officeId)}/incidents`,
    { method: "GET", requireSameOrigin: false },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ officeId: string }> },
) {
  const { officeId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return proxyOperation(
    request,
    `/api/v1/polling-offices/${encodeURIComponent(officeId)}/incidents`,
    { method: "POST", body },
  );
}

import { proxyOperation } from "@/lib/server/operation-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ protocolId: string }> },
) {
  const { protocolId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return proxyOperation(
    request,
    `/api/v1/protocols/${encodeURIComponent(protocolId)}/documents`,
    { method: "POST", body },
  );
}

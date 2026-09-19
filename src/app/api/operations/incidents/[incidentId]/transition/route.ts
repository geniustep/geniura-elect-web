import { proxyOperation } from "@/lib/server/operation-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ incidentId: string }> },
) {
  const { incidentId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return proxyOperation(
    request,
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/transition`,
    { method: "POST", body },
  );
}

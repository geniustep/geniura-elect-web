import { proxyOperation } from "@/lib/server/operation-proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ officeId: string }> },
) {
  const { officeId } = await context.params;
  return proxyOperation(
    request,
    `/api/v1/polling-offices/${encodeURIComponent(officeId)}/check-in`,
    { method: "POST" },
  );
}

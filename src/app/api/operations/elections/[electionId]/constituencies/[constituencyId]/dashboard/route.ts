import { proxyOperation } from "@/lib/server/operation-proxy";

type RouteContext = {
  params: Promise<{ electionId: string; constituencyId: string }>;
};

function backendPath(electionId: string, constituencyId: string) {
  return `/api/v1/elections/${encodeURIComponent(electionId)}/constituencies/${encodeURIComponent(constituencyId)}/dashboard`;
}

export async function GET(request: Request, context: RouteContext) {
  const { electionId, constituencyId } = await context.params;
  return proxyOperation(
    request,
    backendPath(electionId, constituencyId),
    {
      method: "GET",
      requireSameOrigin: false,
    },
  );
}

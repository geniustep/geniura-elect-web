import type { ElectionSetupSnapshot } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";

export async function getElectionSetupSnapshot(
  electionId: string | number,
  sessionId: string | null,
): Promise<ElectionSetupSnapshot> {
  return backendRequest<ElectionSetupSnapshot>(
    `/api/v1/elections/${encodeURIComponent(String(electionId))}/setup`,
    {
      method: "GET",
      sessionId,
    },
  );
}

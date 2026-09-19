import type { ElectionSetupSnapshot } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";

export async function getElectionSetupSnapshot(
  electionId: string | number,
  sessionId: string | null,
): Promise<ElectionSetupSnapshot> {
  const snapshot = await backendRequest<ElectionSetupSnapshot>(
    `/api/v1/elections/${encodeURIComponent(String(electionId))}/setup`,
    {
      method: "GET",
      sessionId,
    },
  );

  return {
    ...snapshot,
    parties: snapshot.parties ?? [],
    candidates: snapshot.candidates ?? [],
    candidate_lists: snapshot.candidate_lists ?? [],
    list_members: snapshot.list_members ?? [],
  };
}

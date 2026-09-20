import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { PollingImportWorkspace } from "@/components/setup/polling-import-workspace";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function PollingImportPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;
  if (user.role !== "manager") {
    redirect(`/elections/${electionId}`);
  }

  const sessionId = await readElectSessionId();
  let snapshot;
  try {
    snapshot = await getElectionSetupSnapshot(electionId, sessionId);
  } catch {
    notFound();
  }

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <PollingImportWorkspace
          electionId={electionId}
          localConstituencies={snapshot.constituencies.filter(
            (item) => item.kind === "local",
          )}
          exportSnapshot={{
            areas: snapshot.areas,
            centralOffices: snapshot.central_offices,
            centers: snapshot.centers,
            offices: snapshot.offices,
          }}
        />
      </section>
    </main>
  );
}

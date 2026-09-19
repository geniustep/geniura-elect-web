import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { SetupEntityForm } from "@/components/setup/setup-entity-form";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function EditElectionSetupPage({
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
        <SetupEntityForm
          electionId={electionId}
          section="election"
          mode="edit"
          snapshot={snapshot}
        />
      </section>
    </main>
  );
}

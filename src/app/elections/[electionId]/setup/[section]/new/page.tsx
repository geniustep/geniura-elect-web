import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { SetupEntityForm } from "@/components/setup/setup-entity-form";
import type { ElectionSetupSection } from "@/lib/elect/types";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

const allowedSections = new Set<ElectionSetupSection>([
  "constituencies",
  "areas",
  "central-offices",
  "centers",
  "offices",
  "representatives",
  "assignments",
]);

export default async function NewSetupEntityPage({
  params,
}: {
  params: Promise<{ electionId: string; section: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId, section } = await params;
  if (user.role !== "manager") {
    redirect(`/elections/${electionId}`);
  }
  if (!allowedSections.has(section as ElectionSetupSection)) {
    notFound();
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
          section={section as ElectionSetupSection}
          mode="create"
          snapshot={snapshot}
        />
      </section>
    </main>
  );
}

import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import {
  CandidacySetupForm,
  type CandidacySetupSection,
} from "@/components/setup/candidacy-setup-form";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

const allowedSections = new Set<CandidacySetupSection>([
  "parties",
  "candidates",
  "candidate-lists",
  "list-members",
]);

export default async function NewCandidacySetupEntityPage({
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
  if (!allowedSections.has(section as CandidacySetupSection)) {
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
        <CandidacySetupForm
          electionId={electionId}
          section={section as CandidacySetupSection}
          mode="create"
          snapshot={snapshot}
        />
      </section>
    </main>
  );
}

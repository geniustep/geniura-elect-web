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

function recordExists(
  snapshot: Awaited<ReturnType<typeof getElectionSetupSnapshot>>,
  section: CandidacySetupSection,
  recordId: number,
) {
  if (section === "parties") {
    return snapshot.parties.some((item) => item.id === recordId);
  }
  if (section === "candidates") {
    return snapshot.candidates.some((item) => item.id === recordId);
  }
  if (section === "candidate-lists") {
    return snapshot.candidate_lists.some((item) => item.id === recordId);
  }
  return snapshot.list_members.some((item) => item.id === recordId);
}

export default async function EditCandidacySetupEntityPage({
  params,
}: {
  params: Promise<{
    electionId: string;
    section: string;
    recordId: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId, section, recordId } = await params;
  if (user.role !== "manager") {
    redirect(`/elections/${electionId}`);
  }
  if (!allowedSections.has(section as CandidacySetupSection)) {
    notFound();
  }

  const numericId = Number(recordId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }

  const sessionId = await readElectSessionId();
  let snapshot;
  try {
    snapshot = await getElectionSetupSnapshot(electionId, sessionId);
  } catch {
    notFound();
  }

  if (!recordExists(snapshot, section as CandidacySetupSection, numericId)) {
    notFound();
  }

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <CandidacySetupForm
          electionId={electionId}
          section={section as CandidacySetupSection}
          mode="edit"
          snapshot={snapshot}
          recordId={numericId}
        />
      </section>
    </main>
  );
}

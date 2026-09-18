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
  "centers",
  "offices",
  "representatives",
  "assignments",
]);

export default async function EditSetupEntityPage({
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
  if (!allowedSections.has(section as ElectionSetupSection)) {
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

  const items = snapshot[section as ElectionSetupSection];
  if (!items.some((item) => item.id === numericId)) {
    notFound();
  }

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <SetupEntityForm
          electionId={electionId}
          section={section as ElectionSetupSection}
          mode="edit"
          snapshot={snapshot}
          recordId={numericId}
        />
      </section>
    </main>
  );
}

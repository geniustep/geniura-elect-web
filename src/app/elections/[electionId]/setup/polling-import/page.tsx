import { redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { PollingImportWorkspace } from "@/components/setup/polling-import-workspace";
import { getCurrentUser } from "@/lib/server/session";

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

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <PollingImportWorkspace electionId={electionId} />
      </section>
    </main>
  );
}

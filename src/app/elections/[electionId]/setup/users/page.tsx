import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { ScopedUserManager } from "@/components/setup/scoped-user-manager";
import type { SetupScopedUser } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type UsersPayload = {
  items: SetupScopedUser[];
};

export default async function ScopedUsersPage({
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

  let setup;
  let users: UsersPayload;
  try {
    [setup, users] = await Promise.all([
      getElectionSetupSnapshot(electionId, sessionId),
      backendRequest<UsersPayload>(
        `/api/v1/elections/${encodeURIComponent(electionId)}/setup/users`,
        { method: "GET", sessionId },
      ),
    ]);
  } catch {
    notFound();
  }

  return (
    <main className="dashboard-shell scoped-users-page">
      <AppHeader user={user} />
      <section className="dashboard-content scoped-users-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}/setup`}>إعداد الاستحقاق</Link>
          <span>/</span>
          <strong>المستخدمون والصلاحيات</strong>
        </nav>

        <section className="scoped-users-hero">
          <div>
            <span>إدارة الوصول</span>
            <h1>المستخدمون والصلاحيات</h1>
            <p>
              يمكن منح المستخدم دائرة انتخابية كاملة، أو تقييده بجماعة /
              مقاطعة واحدة فقط داخل الدائرة.
            </p>
          </div>
        </section>

        <ScopedUserManager
          electionId={electionId}
          constituencies={setup.constituencies}
          pollingAreas={setup.areas}
          initialUsers={users.items}
        />
      </section>
    </main>
  );
}

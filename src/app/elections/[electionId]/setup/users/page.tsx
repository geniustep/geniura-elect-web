import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { ScopedUserManager } from "@/components/setup/scoped-user-manager";
import type {
  ConstituencySummary,
  SetupScopedUser,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ConstituenciesPayload = {
  items: ConstituencySummary[];
};

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

  let constituencies: ConstituenciesPayload;
  let users: UsersPayload;
  try {
    [constituencies, users] = await Promise.all([
      backendRequest<ConstituenciesPayload>(
        `/api/v1/elections/${encodeURIComponent(electionId)}/constituencies`,
        { method: "GET", sessionId },
      ),
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
                أنشئ المستخدمين وعدّل بياناتهم وصلاحياتهم أو احذفهم بأمان، مع تحديد الدائرة التي تفتح مباشرة بعد تسجيل الدخول.
              </p>
            </div>
          </section>

          <ScopedUserManager
            electionId={electionId}
            constituencies={constituencies.items}
            initialUsers={users.items}
          />
        </section>
      </main>
  );
}

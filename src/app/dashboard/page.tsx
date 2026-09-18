import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type { ElectionSummary } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionsPayload = {
  items: ElectionSummary[];
};

const roleNames = {
  observer: "موكل",
  coordinator: "منسق",
  manager: "إدارة العمليات",
} as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const sessionId = await readElectSessionId();
  let elections: ElectionSummary[] = [];
  let backendAvailable = true;

  try {
    const data = await backendRequest<ElectionsPayload>("/api/v1/elections", {
      method: "GET",
      sessionId,
    });
    elections = data.items;
  } catch {
    backendAvailable = false;
  }

  return (
    <main className="dashboard-shell">
      <AppHeader user={user} />

      <section className="dashboard-content">
        <div className="welcome">
          <div>
            <p className="eyebrow">{user.organization.name}</p>
            <h1>مركز العمليات</h1>
            <p>
              تابع التغطية الميدانية والحضور والمحاضر والنتائج ضمن نطاق
              صلاحياتك.
            </p>
          </div>
          <span className="role-badge">{roleNames[user.role]}</span>
        </div>

        {!backendAvailable ? (
          <div className="notice warning">
            تعذر تحميل بيانات الاستحقاقات حاليًا.
          </div>
        ) : elections.length === 0 ? (
          <div className="empty-state">
            لا يوجد استحقاق انتخابي متاح لهذا الحساب حاليًا.
          </div>
        ) : (
          <div className="election-grid">
            {elections.map((election) => (
              <Link
                className="election-card election-card-link"
                href={`/elections/${election.id}`}
                key={election.id}
              >
                <div className="card-heading">
                  <div>
                    <small>{election.code}</small>
                    <h2>{election.name}</h2>
                  </div>
                  <span className="state-pill">{election.state}</span>
                </div>

                <dl className="metric-grid">
                  <div>
                    <dt>مكاتب التصويت</dt>
                    <dd>{election.coverage.polling_office_count}</dd>
                  </div>
                  <div>
                    <dt>مغطاة</dt>
                    <dd>{election.coverage.covered_office_count}</dd>
                  </div>
                  <div>
                    <dt>نسبة التغطية</dt>
                    <dd>{election.coverage.percent.toFixed(1)}%</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

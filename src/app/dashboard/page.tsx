import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionSummary = {
  id: number;
  name: string;
  code: string;
  election_date: string;
  state: string;
  coverage: {
    polling_office_count: number;
    covered_office_count: number;
    percent: number;
  };
};

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
      <header className="topbar">
        <div>
          <p className="eyebrow">GENIURA ELECT</p>
          <strong>مركز العمليات</strong>
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span>{user.name}</span>
            <small>{roleNames[user.role]}</small>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="dashboard-content">
        <div className="welcome">
          <div>
            <p className="eyebrow">{user.organization.name}</p>
            <h1>صباح الخير، {user.name}</h1>
            <p>
              من هنا ستتابع التغطية الميدانية والمحاضر والنتائج ضمن نطاق
              صلاحياتك.
            </p>
          </div>
          <span className="role-badge">{roleNames[user.role]}</span>
        </div>

        {!backendAvailable ? (
          <div className="notice warning">
            تعذر تحميل بيانات الاستحقاقات حاليًا. الجلسة فعالة، ويمكن إعادة
            المحاولة بعد جاهزية خدمة البيانات.
          </div>
        ) : elections.length === 0 ? (
          <div className="empty-state">
            لا يوجد استحقاق انتخابي متاح لهذا الحساب حاليًا.
          </div>
        ) : (
          <div className="election-grid">
            {elections.map((election) => (
              <article className="election-card" key={election.id}>
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
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

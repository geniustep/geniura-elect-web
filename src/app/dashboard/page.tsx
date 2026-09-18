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
  manager: "مدير العمليات",
} as const;

const stateNames: Record<string, string> = {
  draft: "مسودة",
  setup: "الإعداد",
  ready: "جاهز",
  polling: "الاقتراع",
  counting: "الفرز",
  closed: "مغلق",
};

function formatElectionDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-MA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

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
        <div className="dashboard-hero">
          <div>
            <span className="organization-chip">{user.organization.name}</span>
            <h1>العمليات</h1>
          </div>

          <span className="role-badge">
            <span className="role-dot" aria-hidden="true" />
            {roleNames[user.role]}
          </span>
        </div>

        {!backendAvailable ? (
          <div className="notice warning">
            تعذر تحميل بيانات الاستحقاقات حاليًا.
          </div>
        ) : elections.length === 0 ? (
          <div className="empty-state">لا توجد استحقاقات متاحة.</div>
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
                    <div className="election-meta-row">
                      <span className="election-code">{election.code}</span>
                      <span className="election-date">
                        {formatElectionDate(election.election_date)}
                      </span>
                    </div>
                    <h2>{election.name}</h2>
                  </div>

                  <span className={`state-pill state-${election.state}`}>
                    {stateNames[election.state] ?? election.state}
                  </span>
                </div>

                <dl className="metric-grid">
                  <div className="metric-primary">
                    <dt>مكاتب التصويت</dt>
                    <dd>{election.coverage.polling_office_count}</dd>
                  </div>
                  <div>
                    <dt>المكاتب المغطاة</dt>
                    <dd>{election.coverage.covered_office_count}</dd>
                  </div>
                  <div>
                    <dt>نسبة التغطية</dt>
                    <dd className="metric-percent">
                      {election.coverage.percent.toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt>الدوائر المحلية</dt>
                    <dd>{election.constituencies.local_count}</dd>
                  </div>
                  <div>
                    <dt>الدوائر الجهوية</dt>
                    <dd>{election.constituencies.regional_count}</dd>
                  </div>
                </dl>

                <div className="election-card-footer">
                  <span>فتح الاستحقاق</span>
                  <span className="card-arrow" aria-hidden="true">
                    ←
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

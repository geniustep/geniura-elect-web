import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type {
  ElectionDashboard,
  PollingOffice,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type OfficesPayload = { items: PollingOffice[] };

function attentionReason(office: PollingOffice): string | null {
  if (office.coverage_state === "absent") return "الموكل مسجل كغائب";
  if (office.coverage_state === "uncovered") return "المكتب غير مغطى";
  if (!office.protocol) return "المحضر لم يُدخل بعد";
  if (office.protocol.state === "rejected") return "المحضر مرفوض";
  if (office.protocol.consistency.state === "inconsistent") {
    return "أرقام المحضر غير متوازنة";
  }
  return null;
}

export default async function CommandCenterPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;

  if (user.role === "observer") {
    redirect(`/elections/${electionId}`);
  }

  const sessionId = await readElectSessionId();

  let dashboard: ElectionDashboard;
  let offices: PollingOffice[];

  try {
    const [dashboardData, officeData] = await Promise.all([
      backendRequest<ElectionDashboard>(
        `/api/v1/elections/${electionId}/dashboard`,
        {
          method: "GET",
          sessionId,
        },
      ),
      backendRequest<OfficesPayload>(
        `/api/v1/elections/${electionId}/polling-offices`,
        {
          method: "GET",
          sessionId,
        },
      ),
    ]);
    dashboard = dashboardData;
    offices = officeData.items;
  } catch {
    notFound();
  }

  const attention = offices
    .map((office) => ({ office, reason: attentionReason(office) }))
    .filter(
      (
        item,
      ): item is {
        office: PollingOffice;
        reason: string;
      } => Boolean(item.reason),
    );

  const verified = dashboard.protocols.states.verified ?? 0;
  const verifiedPercent = dashboard.polling_offices.total
    ? (verified / dashboard.polling_offices.total) * 100
    : 0;

  return (
    <main className="dashboard-shell">
      <AppHeader user={user} />
      <section className="dashboard-content">
        <nav className="breadcrumbs">
          <Link href="/dashboard">الرئيسية</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>
            {dashboard.election.name}
          </Link>
          <span>/</span>
          <strong>غرفة القيادة</strong>
        </nav>

        <div className="page-heading">
          <div>
            <p className="eyebrow">COMMAND CENTER</p>
            <h1>غرفة القيادة</h1>
            <p>
              متابعة تشغيلية للتغطية والحضور والمحاضر ضمن البيانات المتاحة
              حاليًا.
            </p>
          </div>
          <span className="state-pill">{dashboard.election.state}</span>
        </div>

        <div className="command-grid">
          <article className="command-card">
            <span>مكاتب التصويت</span>
            <strong>{dashboard.polling_offices.total}</strong>
            <small>
              {dashboard.polling_offices.covered} مغطاة ·{" "}
              {dashboard.polling_offices.uncovered} غير مغطاة
            </small>
          </article>
          <article className="command-card">
            <span>المحاضر المستلمة</span>
            <strong>{dashboard.protocols.total}</strong>
            <small>{dashboard.protocols.missing} محضرًا مفقودًا</small>
          </article>
          <article className="command-card">
            <span>المحاضر المعتمدة</span>
            <strong>{verified}</strong>
            <small>{verifiedPercent.toFixed(1)}% من المكاتب</small>
          </article>
          <article className="command-card">
            <span>عدم الاتساق</span>
            <strong>{dashboard.protocols.inconsistent}</strong>
            <small>محاضر تحتاج مراجعة الأرقام</small>
          </article>
        </div>

        <section className="progress-panel">
          <div>
            <span>التغطية الميدانية</span>
            <strong>
              {dashboard.polling_offices.coverage_percent.toFixed(1)}%
            </strong>
          </div>
          <progress
            max={100}
            value={dashboard.polling_offices.coverage_percent}
          />
          <div>
            <span>اكتمال المحاضر المعتمدة</span>
            <strong>{verifiedPercent.toFixed(1)}%</strong>
          </div>
          <progress max={100} value={verifiedPercent} />
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ATTENTION</p>
              <h2>تحتاج متابعة</h2>
            </div>
            <span>{attention.length} مكتب</span>
          </div>

          {attention.length ? (
            <div className="attention-list">
              {attention.map(({ office, reason }) => (
                <Link
                  href={`/polling-offices/${office.id}`}
                  className="attention-row"
                  key={office.id}
                >
                  <div>
                    <strong>
                      مكتب {office.number} · {office.center.name}
                    </strong>
                    <span>{reason}</span>
                  </div>
                  <small>{office.constituency.name}</small>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              لا توجد حالات تشغيلية ظاهرة تحتاج متابعة في البيانات الحالية.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type { ElectionSummary, PollingOffice } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionPayload = { election: ElectionSummary };
type OfficesPayload = { items: PollingOffice[] };

export default async function ElectionPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;
  const sessionId = await readElectSessionId();

  try {
    const [electionData, officesData] = await Promise.all([
      backendRequest<ElectionPayload>(`/api/v1/elections/${electionId}`, {
        method: "GET",
        sessionId,
      }),
      backendRequest<OfficesPayload>(
        `/api/v1/elections/${electionId}/polling-offices`,
        {
          method: "GET",
          sessionId,
        },
      ),
    ]);

    const election = electionData.election;
    const offices = officesData.items;
    const present = offices.filter(
      (office) => office.coverage_state === "present",
    ).length;

    return (
      <main className="dashboard-shell">
        <AppHeader user={user} />
        <section className="dashboard-content">
          <nav className="breadcrumbs">
            <Link href="/dashboard">الرئيسية</Link>
            <span>/</span>
            <strong>{election.name}</strong>
          </nav>

          <div className="page-heading">
            <div>
              <p className="eyebrow">{election.code}</p>
              <h1>{election.name}</h1>
              <p>
                متابعة التغطية والحضور والمحاضر حسب نطاق صلاحيات هذا الحساب.
              </p>
            </div>
            <span className="state-pill">{election.state}</span>
          </div>

          <dl className="summary-grid">
            <div>
              <dt>مكاتب التصويت</dt>
              <dd>{offices.length}</dd>
            </div>
            <div>
              <dt>الحضور المؤكد</dt>
              <dd>{present}</dd>
            </div>
            <div>
              <dt>التغطية</dt>
              <dd>{election.coverage.percent.toFixed(1)}%</dd>
            </div>
          </dl>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">POLLING OFFICES</p>
                <h2>مكاتب التصويت</h2>
              </div>
              <span>{offices.length} مكتب</span>
            </div>

            <div className="office-list">
              {offices.map((office) => (
                <Link
                  className="office-row"
                  href={`/polling-offices/${office.id}`}
                  key={office.id}
                >
                  <div className="office-number">{office.number}</div>
                  <div className="office-main">
                    <strong>{office.center.name}</strong>
                    <span>
                      {office.constituency.name}
                      {office.center.commune
                        ? ` · ${office.center.commune}`
                        : ""}
                    </span>
                  </div>
                  <div className="office-meta">
                    <span className={`coverage-chip ${office.coverage_state}`}>
                      {office.coverage_state}
                    </span>
                    <small>
                      {office.protocol
                        ? `محضر: ${office.protocol.state}`
                        : "لا يوجد محضر"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type { ConstituencyCoverageDashboard } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

const missingLabels: Record<string, string> = {
  name: "الاسم",
  phone: "الهاتف",
  voter_number: "رقم الناخب",
  rbo: "ر ب و",
};

const reviewLabels: Record<string, string> = {
  duplicate_phone: "هاتف مكرر",
  duplicate_voter_number: "رقم ناخب مكرر",
  duplicate_rbo: "ر ب و مكرر",
};

export default async function ConstituencyDashboardPage({
  params,
}: {
  params: Promise<{ electionId: string; constituencyId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId, constituencyId } = await params;
  if (user.role === "observer") {
    redirect(`/elections/${electionId}`);
  }

  const sessionId = await readElectSessionId();
  let dashboard: ConstituencyCoverageDashboard;
  try {
    dashboard = await backendRequest<ConstituencyCoverageDashboard>(
      `/api/v1/elections/${encodeURIComponent(electionId)}/constituencies/${encodeURIComponent(constituencyId)}/dashboard`,
      {
        method: "GET",
        sessionId,
      },
    );
  } catch {
    notFound();
  }

  const attentionOffices = dashboard.offices.filter(
    (office) =>
      !office.assignment ||
      office.missing_fields.length > 0 ||
      office.review_flags.length > 0,
  );

  return (
    <main className="dashboard-shell constituency-dashboard-page">
      <AppHeader user={user} />

      <section className="dashboard-content constituency-dashboard-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <span>{dashboard.election.name}</span>
          <span>/</span>
          <strong>{dashboard.constituency.name}</strong>
        </nav>

        <section className="constituency-dashboard-hero">
          <div>
            <span className="constituency-dashboard-kicker">الدائرة المحلية</span>
            <h1>{dashboard.constituency.name}</h1>
            <div className="constituency-dashboard-meta">
              <span>{dashboard.constituency.region.name}</span>
              <span>{dashboard.constituency.code}</span>
              <span>{dashboard.constituency.seat_count} مقاعد</span>
            </div>
          </div>

          {user.role === "manager" ? (
            <div className="constituency-dashboard-actions">
              <Link href={`/elections/${electionId}/setup/users`}>
                المستخدمون والصلاحيات
              </Link>
              <Link href={`/elections/${electionId}/setup`}>
                إعداد الهيكلة
              </Link>
            </div>
          ) : null}
        </section>

        <section className="constituency-dashboard-kpis">
          <article>
            <span>مكاتب التصويت</span>
            <strong>{dashboard.coverage.total_offices}</strong>
            <small>إجمالي الدائرة</small>
          </article>
          <article className="is-success">
            <span>لديها مراقب</span>
            <strong>{dashboard.coverage.covered_offices}</strong>
            <small>{dashboard.coverage.coverage_percent.toFixed(1)}% تغطية</small>
          </article>
          <article className="is-danger">
            <span>بدون مراقب</span>
            <strong>{dashboard.coverage.uncovered_offices}</strong>
            <small>تحتاج تعيينًا</small>
          </article>
          <article className="is-warning">
            <span>بيانات المراقب ناقصة</span>
            <strong>{dashboard.coverage.missing_representative_info}</strong>
            <small>هاتف / رقم ناخب / ر ب و</small>
          </article>
          <article className="is-review">
            <span>تحتاج مراجعة</span>
            <strong>{dashboard.coverage.needs_review}</strong>
            <small>تكرارات أو تعارضات جودة</small>
          </article>
          <article>
            <span>مراقبون في المصدر فقط</span>
            <strong>{dashboard.coverage.source_candidates_unassigned}</strong>
            <small>لم يتحولوا بعد إلى تعيينات</small>
          </article>
        </section>

        <section className="constituency-dashboard-section">
          <div className="constituency-dashboard-section-head">
            <div>
              <span>التغطية حسب النطاق</span>
              <h2>أين توجد الفجوات؟</h2>
            </div>
          </div>

          <div className="constituency-area-grid">
            {dashboard.areas.map((area) => {
              const percentage = area.total
                ? (100 * area.covered) / area.total
                : 0;
              return (
                <article className="constituency-area-card" key={area.id ?? area.name}>
                  <div className="constituency-area-card-head">
                    <h3>{area.name}</h3>
                    <strong>{percentage.toFixed(0)}%</strong>
                  </div>
                  <div className="constituency-area-progress" aria-hidden="true">
                    <span style={{ width: `${percentage}%` }} />
                  </div>
                  <dl>
                    <div>
                      <dt>المكاتب</dt>
                      <dd>{area.total}</dd>
                    </div>
                    <div>
                      <dt>بدون مراقب</dt>
                      <dd>{area.uncovered}</dd>
                    </div>
                    <div>
                      <dt>بيانات ناقصة</dt>
                      <dd>{area.missing_representative_info}</dd>
                    </div>
                    <div>
                      <dt>مراجعة</dt>
                      <dd>{area.needs_review}</dd>
                    </div>
                  </dl>
                  {area.source_candidates_unassigned ? (
                    <p>
                      {area.source_candidates_unassigned} مراقب موجود في بيانات المصدر
                      ولم يُعيَّن بعد.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="constituency-dashboard-section">
          <div className="constituency-dashboard-section-head">
            <div>
              <span>قائمة العمل</span>
              <h2>المكاتب التي تحتاج تدخلاً</h2>
            </div>
            <strong>{attentionOffices.length}</strong>
          </div>

          {attentionOffices.length ? (
            <div className="constituency-attention-list">
              {attentionOffices.map((office) => {
                const missing = office.missing_fields.map(
                  (field) => missingLabels[field] ?? field,
                );
                const reviews = office.review_flags.map(
                  (flag) => reviewLabels[flag] ?? flag,
                );
                return (
                  <article className="constituency-attention-row" key={office.id}>
                    <div className="constituency-attention-number">
                      {office.number}
                    </div>
                    <div className="constituency-attention-main">
                      <strong>{office.center.name}</strong>
                      <span>
                        {office.area?.name ?? "بدون نطاق"}
                        {office.central_office
                          ? ` · مركزي ${office.central_office.number}`
                          : ""}
                      </span>
                      {office.representative ? (
                        <small>
                          {office.representative.name}
                          {office.representative.phone
                            ? ` · ${office.representative.phone}`
                            : ""}
                        </small>
                      ) : office.source_observer ? (
                        <small className="is-source">
                          من اللائحة: {office.source_observer.name ?? "بدون اسم"}
                          {office.source_observer.phone
                            ? ` · ${office.source_observer.phone}`
                            : ""}
                        </small>
                      ) : (
                        <small>لا يوجد مراقب مرتبط بهذا المكتب.</small>
                      )}
                    </div>
                    <div className="constituency-attention-flags">
                      {!office.assignment ? (
                        <span className="is-danger">بدون مراقب</span>
                      ) : null}
                      {missing.length ? (
                        <span className="is-warning">
                          ناقص: {missing.join("، ")}
                        </span>
                      ) : null}
                      {reviews.map((label) => (
                        <span className="is-review" key={label}>
                          {label}
                        </span>
                      ))}
                      {!office.assignment && office.source_observer ? (
                        <span className="is-source">جاهز للربط من المصدر</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="setup-empty">
              جميع مكاتب الدائرة مغطاة ولا توجد نواقص أو حالات مراجعة.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

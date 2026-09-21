import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { RepresentativeImportWorkspace } from "@/components/setup/representative-import-workspace";
import type {
  ConstituencyCoverageArea,
  ConstituencyCoverageDashboard,
  ConstituencyCoverageOffice,
} from "@/lib/elect/types";
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

function areaPriority(area: ConstituencyCoverageArea) {
  return (
    area.uncovered * 4 +
    area.needs_review * 3 +
    area.missing_representative_info * 2 +
    area.source_candidates_unassigned
  );
}

function officePriority(office: ConstituencyCoverageOffice) {
  return (
    (office.assignment ? 0 : 10) +
    office.review_flags.length * 4 +
    office.missing_fields.length * 2 +
    (!office.assignment && office.source_observer ? 1 : 0)
  );
}

function AreaCard({
  area,
  electionId,
  constituencyId,
}: {
  area: ConstituencyCoverageArea;
  electionId: string;
  constituencyId: string;
}) {
  const percentage = area.total ? (100 * area.covered) / area.total : 0;

  if (!area.id) {
    return (
      <article className="constituency-area-card constituency-area-card--compact">
        <div className="constituency-area-card-head">
          <h3>{area.name}</h3>
          <strong>{percentage.toFixed(0)}%</strong>
        </div>
      </article>
    );
  }

  return (
    <Link
      className="constituency-area-card constituency-area-card--link constituency-area-card--compact"
      href={`/elections/${electionId}/constituencies/${constituencyId}/areas/${area.id}`}
    >
      <div className="constituency-area-card-head">
        <h3>{area.name}</h3>
        <strong>{percentage.toFixed(0)}%</strong>
      </div>

      <div className="constituency-area-progress" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="constituency-area-compact-stats">
        <span>
          <b>{area.total}</b>
          مكتب
        </span>
        <span className={area.uncovered ? "is-danger" : undefined}>
          <b>{area.uncovered}</b>
          بدون مراقب
        </span>
        <span>
          <b>{area.missing_representative_info + area.needs_review}</b>
          معالجة
        </span>
      </div>

      <span className="constituency-area-open">
        فتح الجماعة
        <span aria-hidden="true">←</span>
      </span>
    </Link>
  );
}

function AttentionRow({ office }: { office: ConstituencyCoverageOffice }) {
  const missing = office.missing_fields.map(
    (field) => missingLabels[field] ?? field,
  );
  const reviews = office.review_flags.map(
    (flag) => reviewLabels[flag] ?? flag,
  );

  return (
    <article className="constituency-attention-row constituency-attention-row--compact">
      <div className="constituency-attention-number">{office.number}</div>

      <div className="constituency-attention-main">
        <strong>{office.center.name}</strong>
        <span>
          {office.area?.name ?? "غير محدد"}
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
          <span className="is-warning">ناقص: {missing.join("، ")}</span>
        ) : null}
        {reviews.slice(0, 1).map((label) => (
          <span className="is-review" key={label}>
            {label}
          </span>
        ))}
        {!office.assignment && office.source_observer ? (
          <span className="is-source">جاهز للربط</span>
        ) : null}
      </div>
    </article>
  );
}

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

  const attentionOffices = dashboard.offices
    .filter(
      (office) =>
        !office.assignment ||
        office.missing_fields.length > 0 ||
        office.review_flags.length > 0,
    )
    .sort((a, b) => officePriority(b) - officePriority(a));

  const priorityAreas = [...dashboard.areas].sort(
    (a, b) => areaPriority(b) - areaPriority(a),
  );
  const visibleAreas = priorityAreas.slice(0, 6);
  const remainingAreas = priorityAreas.slice(6);
  const visibleAttention = attentionOffices.slice(0, 6);
  const remainingAttention = attentionOffices.slice(6);
  const needsDataAttention =
    dashboard.coverage.missing_representative_info +
    dashboard.coverage.needs_review;

  return (
    <main className="dashboard-shell constituency-dashboard-page">
      <AppHeader user={user} />

      <section className="dashboard-content constituency-dashboard-content constituency-dashboard-content--compact">
        <nav className="pjd-election-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>
            {dashboard.election.name}
          </Link>
          <span>/</span>
          <strong>{dashboard.constituency.name}</strong>
        </nav>

        <section className="constituency-dashboard-hero constituency-dashboard-hero--compact">
          <div>
            <span className="constituency-dashboard-kicker">
              دائرة انتخابية محلية
            </span>
            <h1>{dashboard.constituency.name}</h1>
            <div className="constituency-dashboard-meta">
              <span>{dashboard.constituency.region.name}</span>
              <span>{dashboard.constituency.seat_count} مقاعد</span>
              <span>{dashboard.areas.length} جماعات / مقاطعات</span>
            </div>
          </div>

        </section>

        <section className="constituency-dashboard-kpis constituency-dashboard-kpis--compact">
          <article>
            <span>مكاتب التصويت</span>
            <strong>{dashboard.coverage.total_offices}</strong>
            <small>إجمالي الدائرة</small>
          </article>

          <article className="is-success">
            <span>التغطية</span>
            <strong>{dashboard.coverage.coverage_percent.toFixed(0)}%</strong>
            <small>{dashboard.coverage.covered_offices} مكتبًا مغطى</small>
          </article>

          <article className="is-danger">
            <span>بدون مراقب</span>
            <strong>{dashboard.coverage.uncovered_offices}</strong>
            <small>أولوية التعيين</small>
          </article>

          <article className="is-warning">
            <span>تحتاج معالجة</span>
            <strong>{needsDataAttention}</strong>
            <small>بيانات ناقصة أو مراجعة</small>
          </article>
        </section>

        <section className="constituency-dashboard-section constituency-dashboard-section--compact">
          <div className="constituency-dashboard-section-head">
            <div>
              <span>الأولوية حسب الجماعة / المقاطعة</span>
              <h2>أين نبدأ؟</h2>
            </div>
            <strong>{dashboard.areas.length}</strong>
          </div>

          {visibleAreas.length ? (
            <div className="constituency-area-grid constituency-area-grid--priority">
              {visibleAreas.map((area) => (
                <AreaCard
                  area={area}
                  electionId={electionId}
                  constituencyId={constituencyId}
                  key={area.id ?? area.name}
                />
              ))}
            </div>
          ) : (
            <div className="setup-empty">لا توجد جماعات مرتبطة بهذه الدائرة.</div>
          )}

          {remainingAreas.length ? (
            <details className="constituency-dashboard-more">
              <summary>
                <span>عرض باقي الجماعات / المقاطعات</span>
                <strong>{remainingAreas.length}</strong>
              </summary>
              <div className="constituency-area-grid">
                {remainingAreas.map((area) => (
                  <AreaCard
                    area={area}
                    electionId={electionId}
                    constituencyId={constituencyId}
                    key={area.id ?? area.name}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        {user.role === "manager" ? (
          <details className="constituency-tool-drawer">
            <summary>
              <div>
                <span>أداة عند الحاجة</span>
                <strong>استيراد ومطابقة المراقبين</strong>
              </div>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="constituency-tool-drawer-body">
              <RepresentativeImportWorkspace
                electionId={electionId}
                constituencyId={dashboard.constituency.id}
                areas={dashboard.areas}
              />
            </div>
          </details>
        ) : null}

        <section className="constituency-dashboard-section constituency-dashboard-section--compact">
          <div className="constituency-dashboard-section-head">
            <div>
              <span>قائمة الأولوية</span>
              <h2>المكاتب التي تحتاج تدخلاً</h2>
            </div>
            <strong>{attentionOffices.length}</strong>
          </div>

          {visibleAttention.length ? (
            <div className="constituency-attention-list">
              {visibleAttention.map((office) => (
                <AttentionRow office={office} key={office.id} />
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              جميع مكاتب الدائرة مغطاة ولا توجد نواقص أو حالات مراجعة.
            </div>
          )}

          {remainingAttention.length ? (
            <details className="constituency-dashboard-more">
              <summary>
                <span>عرض باقي حالات التدخل</span>
                <strong>{remainingAttention.length}</strong>
              </summary>
              <div className="constituency-attention-list">
                {remainingAttention.map((office) => (
                  <AttentionRow office={office} key={office.id} />
                ))}
              </div>
            </details>
          ) : null}

          {dashboard.coverage.source_candidates_unassigned ? (
            <div className="constituency-source-note">
              <span>{dashboard.coverage.source_candidates_unassigned}</span>
              مراقبون موجودون في المصدر ولم يتحولوا بعد إلى تعيينات.
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

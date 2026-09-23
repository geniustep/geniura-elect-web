import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type {
  ElectionDashboard,
  PollingOffice,
} from "@/lib/elect/types";
import { backendHttp, type BackendHttpResult } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type OfficesPayload = { items: PollingOffice[] };

const stateNames: Record<string, string> = {
  draft: "مسودة",
  setup: "مرحلة الإعداد",
  ready: "جاهز",
  polling: "يوم الاقتراع",
  counting: "الفرز والتجميع",
  closed: "مغلق",
};

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

  let dashboardResult: BackendHttpResult<ElectionDashboard>;
  try {
    dashboardResult = await backendHttp<ElectionDashboard>(
      `/api/v1/elections/${electionId}/dashboard`,
      {
        method: "GET",
        sessionId,
      },
    );
  } catch {
    return (
      <main className="dashboard-shell presentation-dashboard">
        <AppHeader user={user} />
        <section className="dashboard-content presentation-content">
          <nav className="breadcrumbs presentation-breadcrumbs">
            <Link href="/dashboard">مركز العمليات</Link>
            <span>/</span>
            <Link href={`/elections/${electionId}`}>الاستحقاق</Link>
            <span>/</span>
            <strong>غرفة القيادة</strong>
          </nav>
          <div className="empty-state">
            تعذر الاتصال بخدمة الانتخابات لتحميل غرفة القيادة. أعد المحاولة بعد
            قليل.
          </div>
        </section>
      </main>
    );
  }

  if (dashboardResult.response.status === 401) {
    redirect("/login");
  }
  if (dashboardResult.response.status === 404) {
    notFound();
  }
  if (
    !dashboardResult.response.ok ||
    !dashboardResult.payload ||
    !dashboardResult.payload.success
  ) {
    return (
      <main className="dashboard-shell presentation-dashboard">
        <AppHeader user={user} />
        <section className="dashboard-content presentation-content">
          <nav className="breadcrumbs presentation-breadcrumbs">
            <Link href="/dashboard">مركز العمليات</Link>
            <span>/</span>
            <Link href={`/elections/${electionId}`}>الاستحقاق</Link>
            <span>/</span>
            <strong>غرفة القيادة</strong>
          </nav>
          <div className="empty-state">
            تعذر تحميل بيانات غرفة القيادة من الخدمة حاليًا.
          </div>
        </section>
      </main>
    );
  }

  const dashboard = dashboardResult.payload.data;
  let offices: PollingOffice[] = [];
  let officesAvailable = true;
  let officeResult: BackendHttpResult<OfficesPayload> | null = null;

  try {
    officeResult = await backendHttp<OfficesPayload>(
      `/api/v1/elections/${electionId}/polling-offices`,
      {
        method: "GET",
        sessionId,
      },
    );
  } catch {
    officesAvailable = false;
  }

  if (officeResult) {
    if (officeResult.response.status === 401) {
      redirect("/login");
    }

    if (
      !officeResult.response.ok ||
      !officeResult.payload ||
      !officeResult.payload.success
    ) {
      officesAvailable = false;
    } else {
      offices = officeResult.payload.data.items;
    }
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
  const structureReady = dashboard.election.constituencies.local_count > 0;
  const officesLoaded = dashboard.polling_offices.total > 0;

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">مركز العمليات</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>
            {dashboard.election.name}
          </Link>
          <span>/</span>
          <strong>غرفة القيادة</strong>
        </nav>

        <section className="command-center-hero">
          <div>
            <div className="presentation-kicker">
              <span className="status-orb" aria-hidden="true" />
              المتابعة التشغيلية
            </div>
            <h1>غرفة القيادة</h1>
            <p>
              رؤية واحدة للتغطية، المحاضر والحالات التي تتطلب تدخلاً خلال
              العملية الانتخابية.
            </p>
            <div className="presentation-action-row">
              <Link
                className="presentation-primary-action"
                href={`/elections/${electionId}/protocols`}
              >
                إدخال المحاضر
                <span aria-hidden="true">←</span>
              </Link>
            </div>
          </div>
          <span className="presentation-state state-pill">
            {stateNames[dashboard.election.state] ?? dashboard.election.state}
          </span>
        </section>

        {!officesLoaded ? (
          <>
            <div className="command-readiness-grid">
              <article className="command-readiness-card is-ready">
                <span>01</span>
                <div>
                  <strong>الهيكلة الانتخابية</strong>
                  <small>
                    {structureReady
                      ? `${dashboard.election.constituencies.local_count} دوائر محلية جاهزة`
                      : "بانتظار إعداد الدوائر"}
                  </small>
                </div>
              </article>
              <article className="command-readiness-card is-waiting">
                <span>02</span>
                <div>
                  <strong>مكاتب التصويت</strong>
                  <small>بانتظار تحميل المصدر الرسمي</small>
                </div>
              </article>
              <article className="command-readiness-card is-waiting">
                <span>03</span>
                <div>
                  <strong>التغطية الميدانية</strong>
                  <small>تبدأ بعد توزيع الموكلين على المكاتب</small>
                </div>
              </article>
              <article className="command-readiness-card is-waiting">
                <span>04</span>
                <div>
                  <strong>المحاضر والنتائج</strong>
                  <small>تفعّل تلقائيًا مع بدء ورود المحاضر</small>
                </div>
              </article>
            </div>

            <div className="structured-empty-state command-empty-state">
              <div className="structured-empty-icon" aria-hidden="true">
                ◌
              </div>
              <div>
                <span>غرفة القيادة جاهزة</span>
                <h3>بانتظار تشغيل البنية الميدانية</h3>
                <p>
                  بمجرد تحميل مراكز ومكاتب التصويت، ستتحول هذه الصفحة تلقائيًا
                  إلى لوحة متابعة آنية للتغطية والمحاضر والحوادث.
                </p>
              </div>
              <div className="structured-empty-status">
                <span className="status-orb status-orb--waiting" />
                بانتظار المكاتب
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="command-grid presentation-command-grid">
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
                <span>بلاغات مفتوحة</span>
                <strong>{dashboard.incidents?.open ?? 0}</strong>
                <small>
                  {dashboard.incidents?.high_open ?? 0} منها عاجلة
                </small>
              </article>
            </div>

            <section className="progress-panel presentation-progress-panel">
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

            <section className="presentation-section-block">
              <div className="presentation-section-heading">
                <div>
                  <span>المتابعة الفورية</span>
                  <h2>تحتاج متابعة</h2>
                </div>
                <small>
                  {officesAvailable ? `${attention.length} مكتب` : "التفاصيل غير متاحة"}
                </small>
              </div>

              {!officesAvailable ? (
                <div className="empty-state">
                  تعذر تحميل تفاصيل المكاتب مؤقتًا. مؤشرات غرفة القيادة أعلاه
                  ما زالت متاحة.
                </div>
              ) : attention.length ? (
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
                  لا توجد حالات تشغيلية تحتاج متابعة في البيانات الحالية.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type {
  ConstituencySummary,
  ElectionSummary,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionsPayload = {
  items: ElectionSummary[];
};

type ConstituenciesPayload = {
  items: ConstituencySummary[];
};

const roleNames = {
  observer: "موكل",
  coordinator: "منسق",
  manager: "مدير العمليات",
} as const;

const stateNames: Record<string, string> = {
  draft: "مسودة",
  setup: "مرحلة الإعداد",
  ready: "جاهز",
  polling: "يوم الاقتراع",
  counting: "الفرز والتجميع",
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
  const structureByElection = new Map<number, ConstituencySummary[]>();

  try {
    const data = await backendRequest<ElectionsPayload>("/api/v1/elections", {
      method: "GET",
      sessionId,
    });
    elections = data.items;
  } catch {
    backendAvailable = false;
  }

  if (backendAvailable && user.role !== "observer") {
    await Promise.all(
      elections.map(async (election) => {
        try {
          const data = await backendRequest<ConstituenciesPayload>(
            `/api/v1/elections/${election.id}/constituencies`,
            {
              method: "GET",
              sessionId,
            },
          );
          structureByElection.set(election.id, data.items);
        } catch {
          structureByElection.set(election.id, []);
        }
      }),
    );
  }

  const firstStructure = elections[0]
    ? structureByElection.get(elections[0].id) ?? []
    : [];
  const regionName = firstStructure[0]?.region.name;

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />

      <section className="dashboard-content presentation-content">
        <section className="presentation-hero">
          <div className="presentation-hero-copy">
            <div className="presentation-kicker">
              <span className="status-orb" aria-hidden="true" />
              منصة المتابعة الميدانية
            </div>
            <h1>مركز العمليات الانتخابية</h1>
            <p>
              متابعة جاهزية الهيكلة، التغطية، المحاضر والنتائج من نقطة قيادة
              واحدة.
            </p>
            <div className="presentation-hero-meta">
              <span>{user.organization.name}</span>
              {regionName ? <span>{regionName}</span> : null}
              <span>{roleNames[user.role]}</span>
            </div>
          </div>

          <div className="presentation-signal-card">
            <span>حالة المنصة</span>
            <strong>{backendAvailable ? "متصلة وجاهزة" : "الاتصال متعذر"}</strong>
            <small>
              {backendAvailable
                ? "البيانات المعروضة متزامنة مع النظام المركزي"
                : "تعذر الوصول إلى خدمة البيانات حاليًا"}
            </small>
          </div>
        </section>

        {!backendAvailable ? (
          <div className="notice warning">
            تعذر تحميل بيانات الاستحقاقات حاليًا.
          </div>
        ) : elections.length === 0 ? (
          <div className="empty-state">لا توجد استحقاقات متاحة.</div>
        ) : (
          <div className="presentation-election-stack">
            {elections.map((election) => {
              const constituencies =
                structureByElection.get(election.id) ?? [];
              const local = constituencies.filter(
                (item) => item.kind === "local",
              );
              const regional = constituencies.filter(
                (item) => item.kind === "regional",
              );
              const localSeats = local.reduce(
                (total, item) => total + item.seat_count,
                0,
              );
              const regionalSeats = regional.reduce(
                (total, item) => total + item.seat_count,
                0,
              );
              const electionRegion = constituencies[0]?.region.name;
              const officesLoaded = election.coverage.polling_office_count > 0;

              return (
                <article
                  className="presentation-election-card"
                  key={election.id}
                >
                  <div className="presentation-election-heading">
                    <div>
                      <div className="presentation-heading-meta">
                        <span>{formatElectionDate(election.election_date)}</span>
                        {electionRegion ? <span>{electionRegion}</span> : null}
                      </div>
                      <h2>{election.name}</h2>
                      <p>
                        بنية تشغيلية موحدة لمتابعة الدوائر، التغطية الميدانية،
                        المحاضر والنتائج.
                      </p>
                    </div>
                    <span
                      className={`state-pill state-${election.state} presentation-state`}
                    >
                      {stateNames[election.state] ?? election.state}
                    </span>
                  </div>

                  <div className="presentation-metric-grid">
                    <div>
                      <span>الدوائر المحلية</span>
                      <strong>{election.constituencies.local_count}</strong>
                      <small>
                        {local.length
                          ? `${localSeats} مقعدًا`
                          : "الهيكلة المسجلة"}
                      </small>
                    </div>
                    <div>
                      <span>الدائرة الجهوية</span>
                      <strong>{election.constituencies.regional_count}</strong>
                      <small>
                        {regional.length
                          ? `${regionalSeats} مقاعد`
                          : "الهيكلة الجهوية"}
                      </small>
                    </div>
                    <div>
                      <span>مكاتب التصويت</span>
                      <strong>
                        {officesLoaded
                          ? election.coverage.polling_office_count
                          : "—"}
                      </strong>
                      <small>
                        {officesLoaded ? "مكتب محمل" : "بانتظار المصدر الرسمي"}
                      </small>
                    </div>
                    <div>
                      <span>التغطية الميدانية</span>
                      <strong>
                        {officesLoaded
                          ? `${election.coverage.percent.toFixed(0)}%`
                          : "—"}
                      </strong>
                      <small>
                        {officesLoaded
                          ? `${election.coverage.covered_office_count} مكتب مغطى`
                          : "تبدأ بعد تحميل المكاتب"}
                      </small>
                    </div>
                  </div>

                  {!officesLoaded ? (
                    <div className="presentation-waiting-strip">
                      <div>
                        <span className="waiting-icon" aria-hidden="true">
                          ◌
                        </span>
                        <div>
                          <strong>الهيكلة الأساسية جاهزة</strong>
                          <p>
                            مراكز ومكاتب التصويت بانتظار تحميل المصدر الرسمي؛
                            لن تعرض المنصة أرقامًا تقديرية.
                          </p>
                        </div>
                      </div>
                      <span className="waiting-badge">بانتظار المصدر</span>
                    </div>
                  ) : (
                    <div className="presentation-coverage-strip">
                      <div>
                        <span>نسبة التغطية الحالية</span>
                        <strong>{election.coverage.percent.toFixed(1)}%</strong>
                      </div>
                      <progress
                        max={100}
                        value={election.coverage.percent}
                      />
                    </div>
                  )}

                  <div className="presentation-section-heading">
                    <div>
                      <span>مساحات العمل</span>
                      <h3>الوصول السريع للعمليات</h3>
                    </div>
                    <Link
                      className="presentation-text-link"
                      href={`/elections/${election.id}`}
                    >
                      فتح الاستحقاق
                      <span aria-hidden="true">←</span>
                    </Link>
                  </div>

                  <div className="operations-grid">
                    <Link
                      className="operation-tile"
                      href={`/elections/${election.id}`}
                    >
                      <span className="operation-index">01</span>
                      <div>
                        <strong>الدوائر والهيكلة</strong>
                        <small>استعراض النطاق الانتخابي والجاهزية</small>
                      </div>
                      <span className="operation-arrow" aria-hidden="true">
                        ←
                      </span>
                    </Link>

                    {user.role !== "observer" ? (
                      <>
                        <Link
                          className="operation-tile"
                          href={`/elections/${election.id}/command-center`}
                        >
                          <span className="operation-index">02</span>
                          <div>
                            <strong>غرفة القيادة</strong>
                            <small>التغطية والمحاضر والحالات العاجلة</small>
                          </div>
                          <span className="operation-arrow" aria-hidden="true">
                            ←
                          </span>
                        </Link>
                        <Link
                          className="operation-tile"
                          href={`/elections/${election.id}/results`}
                        >
                          <span className="operation-index">03</span>
                          <div>
                            <strong>النتائج والتجميع</strong>
                            <small>تجميع داخلي مرتبط بالمحاضر المعتمدة</small>
                          </div>
                          <span className="operation-arrow" aria-hidden="true">
                            ←
                          </span>
                        </Link>
                      </>
                    ) : null}

                    <Link
                      className="operation-tile"
                      href={`/elections/${election.id}`}
                    >
                      <span className="operation-index">
                        {user.role === "observer" ? "02" : "04"}
                      </span>
                      <div>
                        <strong>المحاضر والمتابعة</strong>
                        <small>
                          {officesLoaded
                            ? "متابعة حالة كل مكتب ومحضره"
                            : "تفعّل تلقائيًا بعد تحميل المكاتب"}
                        </small>
                      </div>
                      <span className="operation-arrow" aria-hidden="true">
                        ←
                      </span>
                    </Link>
                  </div>

                  <div className="readiness-panel">
                    <div className="readiness-heading">
                      <div>
                        <span>جاهزية يوم الاقتراع</span>
                        <strong>مسار التحضير</strong>
                      </div>
                      <small>حالة آنية حسب البيانات المحملة</small>
                    </div>
                    <div className="readiness-steps">
                      <div className="readiness-step is-done">
                        <span className="readiness-dot" />
                        <div>
                          <strong>الانتخابات والجهة</strong>
                          <small>تم إعداد الأساس التشغيلي</small>
                        </div>
                      </div>
                      <div
                        className={`readiness-step ${
                          election.constituencies.local_count > 0
                            ? "is-done"
                            : ""
                        }`}
                      >
                        <span className="readiness-dot" />
                        <div>
                          <strong>الدوائر الانتخابية</strong>
                          <small>
                            {election.constituencies.local_count > 0
                              ? `${election.constituencies.local_count} دوائر محلية جاهزة`
                              : "بانتظار الإعداد"}
                          </small>
                        </div>
                      </div>
                      <div
                        className={`readiness-step ${
                          officesLoaded ? "is-done" : "is-waiting"
                        }`}
                      >
                        <span className="readiness-dot" />
                        <div>
                          <strong>مراكز ومكاتب التصويت</strong>
                          <small>
                            {officesLoaded
                              ? `${election.coverage.polling_office_count} مكتب محمل`
                              : "بانتظار المصدر الرسمي"}
                          </small>
                        </div>
                      </div>
                      <div
                        className={`readiness-step ${
                          election.coverage.covered_office_count > 0
                            ? "is-done"
                            : "is-waiting"
                        }`}
                      >
                        <span className="readiness-dot" />
                        <div>
                          <strong>توزيع الموكلين</strong>
                          <small>
                            {election.coverage.covered_office_count > 0
                              ? `${election.coverage.covered_office_count} مكتب مغطى`
                              : officesLoaded
                                ? "لم يبدأ التوزيع بعد"
                                : "يبدأ بعد تحميل المكاتب"}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type {
  ConstituencySummary,
  ElectionSummary,
  PollingOffice,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionPayload = { election: ElectionSummary };
type OfficesPayload = { items: PollingOffice[] };
type ConstituenciesPayload = { items: ConstituencySummary[] };

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
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-MA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function ElectionPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;
  const sessionId = await readElectSessionId();

  let electionData: ElectionPayload;
  let officesData: OfficesPayload;

  try {
    [electionData, officesData] = await Promise.all([
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
  } catch {
    notFound();
  }

  let constituencies: ConstituencySummary[] = [];
  if (user.role !== "observer") {
    try {
      const data = await backendRequest<ConstituenciesPayload>(
        `/api/v1/elections/${electionId}/constituencies`,
        {
          method: "GET",
          sessionId,
        },
      );
      constituencies = data.items;
    } catch {
      constituencies = [];
    }
  }

  const election = electionData.election;
  const offices = officesData.items;
  const local = constituencies.filter((item) => item.kind === "local");
  const regional = constituencies.filter((item) => item.kind === "regional");
  const localSeats = local.reduce((total, item) => total + item.seat_count, 0);
  const regionalSeats = regional.reduce(
    (total, item) => total + item.seat_count,
    0,
  );
  const regionName = constituencies[0]?.region.name;
  const present = offices.filter(
    (office) => office.coverage_state === "present",
  ).length;
  const officesLoaded = offices.length > 0;

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">مركز العمليات</Link>
          <span>/</span>
          <strong>{election.name}</strong>
        </nav>

        <section className="election-overview-hero">
          <div>
            <div className="presentation-heading-meta">
              <span>{formatElectionDate(election.election_date)}</span>
              {regionName ? <span>{regionName}</span> : null}
            </div>
            <h1>{election.name}</h1>
            <p>
              لوحة تشغيل موحدة لمتابعة الهيكلة والتغطية الميدانية والمحاضر
              والنتائج.
            </p>
          </div>
          <span
            className={`state-pill state-${election.state} presentation-state`}
          >
            {stateNames[election.state] ?? election.state}
          </span>
        </section>

        {user.role !== "observer" ? (
          <div className="presentation-action-row">
            <Link
              className="presentation-primary-action"
              href={`/elections/${election.id}/command-center`}
            >
              غرفة القيادة
              <span aria-hidden="true">←</span>
            </Link>
            <Link
              className="presentation-secondary-action"
              href={`/elections/${election.id}/results`}
            >
              النتائج والتجميع
            </Link>
          </div>
        ) : null}

        <div className="election-kpi-grid">
          <div>
            <span>الدوائر المحلية</span>
            <strong>{election.constituencies.local_count}</strong>
            <small>{local.length ? `${localSeats} مقعدًا` : "ضمن نطاق الحساب"}</small>
          </div>
          <div>
            <span>الدائرة الجهوية</span>
            <strong>{election.constituencies.regional_count}</strong>
            <small>{regional.length ? `${regionalSeats} مقاعد` : "ضمن نطاق الحساب"}</small>
          </div>
          <div>
            <span>مكاتب التصويت</span>
            <strong>{officesLoaded ? offices.length : "—"}</strong>
            <small>{officesLoaded ? "مكتب محمل" : "بانتظار المصدر الرسمي"}</small>
          </div>
          <div>
            <span>الحضور الميداني</span>
            <strong>{officesLoaded ? present : "—"}</strong>
            <small>{officesLoaded ? "موكل حاضر" : "يبدأ بعد التوزيع"}</small>
          </div>
          <div>
            <span>التغطية</span>
            <strong>
              {officesLoaded ? `${election.coverage.percent.toFixed(0)}%` : "—"}
            </strong>
            <small>{officesLoaded ? "من المكاتب" : "غير قابلة للحساب بعد"}</small>
          </div>
        </div>

        {user.role !== "observer" && constituencies.length ? (
          <section className="presentation-section-block">
            <div className="presentation-section-heading">
              <div>
                <span>الهيكلة الانتخابية</span>
                <h2>الدوائر الجاهزة للتشغيل</h2>
              </div>
              <small>
                {local.length} محلية · {regional.length} جهوية
              </small>
            </div>

            <div className="constituency-catalog">
              {local.map((constituency) => (
                <article className="constituency-card" key={constituency.id}>
                  <div className="constituency-card-top">
                    <span className="constituency-kind">دائرة محلية</span>
                    <span className="structure-status">جاهزة للربط</span>
                  </div>
                  <h3>{constituency.name}</h3>
                  <div className="constituency-card-foot">
                    <span>{constituency.seat_count} مقاعد</span>
                    <span>
                      {constituency.coverage.polling_office_count
                        ? `${constituency.coverage.polling_office_count} مكتب`
                        : "المكاتب بانتظار التحميل"}
                    </span>
                  </div>
                </article>
              ))}
              {regional.map((constituency) => (
                <article
                  className="constituency-card constituency-card--regional"
                  key={constituency.id}
                >
                  <div className="constituency-card-top">
                    <span className="constituency-kind">دائرة جهوية</span>
                    <span className="structure-status">مهيأة</span>
                  </div>
                  <h3>{constituency.name}</h3>
                  <div className="constituency-card-foot">
                    <span>{constituency.seat_count} مقاعد</span>
                    <span>مرتبطة بمحاضر المكاتب المحلية</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="presentation-section-block">
          <div className="presentation-section-heading">
            <div>
              <span>التغطية الميدانية</span>
              <h2>مراكز ومكاتب التصويت</h2>
            </div>
            <small>{officesLoaded ? `${offices.length} مكتب` : "بانتظار المصدر الرسمي"}</small>
          </div>

          {officesLoaded ? (
            <div className="office-list presentation-office-list">
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
          ) : (
            <div className="structured-empty-state">
              <div className="structured-empty-icon" aria-hidden="true">
                ◌
              </div>
              <div>
                <span>المرحلة التالية</span>
                <h3>تحميل بنية مراكز ومكاتب التصويت</h3>
                <p>
                  الدوائر الانتخابية جاهزة. ستظهر المراكز والمكاتب هنا فور
                  اعتماد المصدر الرسمي، دون استخدام أرقام تقديرية.
                </p>
              </div>
              <div className="structured-empty-status">
                <span className="status-orb status-orb--waiting" />
                بانتظار المصدر الرسمي
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

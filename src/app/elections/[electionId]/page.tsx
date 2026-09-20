import { Tajawal } from "next/font/google";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
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

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

type ElectionPayload = { election: ElectionSummary };
type OfficesPayload = { items: PollingOffice[] };
type ConstituenciesPayload = { items: ConstituencySummary[] };

const stateNames: Record<string, string> = {
  draft: "مسودة",
  setup: "الإعداد",
  ready: "جاهز",
  polling: "الاقتراع",
  counting: "الفرز",
  closed: "مغلق",
};

const coverageNames: Record<string, string> = {
  uncovered: "غير مغطى",
  planned: "مبرمج",
  confirmed: "مؤكد",
  present: "حاضر",
  absent: "غائب",
  replaced: "مستبدل",
  cancelled: "ملغى",
  closed: "مغلق",
};

const protocolNames: Record<string, string> = {
  draft: "مسودة",
  entered: "مدخل",
  document_attached: "مرفق",
  validated: "مصادق",
  verified: "متحقق",
  rejected: "مرفوض",
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
  const protocols = offices.filter((office) => office.protocol).length;
  const officesLoaded = offices.length > 0;

  return (
    <main
      className={`dashboard-shell pjd-dashboard pjd-election-page ${tajawal.className}`}
    >
      <AppHeader user={user} />

      <section className="dashboard-content pjd-election-content">
        <nav className="pjd-election-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <strong>{election.name}</strong>
        </nav>

        <section className="pjd-election-hero">
          <div className="pjd-election-hero-copy">
            <div className="pjd-election-hero-meta">
              <span>{formatElectionDate(election.election_date)}</span>
              {regionName ? <span>{regionName}</span> : null}
            </div>

            <h1>{election.name}</h1>

            <div className="pjd-election-hero-actions">
              {user.role === "manager" ? (
                <Link
                  className="pjd-election-primary-action"
                  href={`/elections/${election.id}/setup`}
                >
                  الإعداد
                  <span aria-hidden="true">←</span>
                </Link>
              ) : null}

              {user.role !== "observer" ? (
                <>
                  <Link
                    className="pjd-election-secondary-action"
                    href={`/elections/${election.id}/command-center`}
                  >
                    المتابعة
                  </Link>
                  <Link
                    className="pjd-election-secondary-action"
                    href={`/elections/${election.id}/results`}
                  >
                    النتائج
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          <div className="pjd-election-hero-side">
            <div className="pjd-election-emblem">
              <BrandLogo priority />
            </div>
            <span
              className={`pjd-election-state pjd-election-state--hero state-${election.state}`}
            >
              {stateNames[election.state] ?? election.state}
            </span>
          </div>
        </section>

        <div className="pjd-election-kpis">
          <div>
            <span>الدوائر المحلية</span>
            <strong>{election.constituencies.local_count}</strong>
            <small>{local.length ? `${localSeats} مقعدًا` : "—"}</small>
          </div>
          <div>
            <span>الدائرة الجهوية</span>
            <strong>{election.constituencies.regional_count}</strong>
            <small>{regional.length ? `${regionalSeats} مقاعد` : "—"}</small>
          </div>
          <div>
            <span>مكاتب التصويت</span>
            <strong>{officesLoaded ? offices.length : "—"}</strong>
            <small>{officesLoaded ? `${present} حاضر` : "—"}</small>
          </div>
          <div>
            <span>المحاضر</span>
            <strong>{officesLoaded ? protocols : "—"}</strong>
            <small>{officesLoaded ? `${offices.length} مكتب` : "—"}</small>
          </div>
          <div>
            <span>التغطية</span>
            <strong>
              {officesLoaded ? `${election.coverage.percent.toFixed(0)}%` : "—"}
            </strong>
            <small>
              {officesLoaded
                ? `${election.coverage.covered_office_count}/${election.coverage.polling_office_count}`
                : "—"}
            </small>
          </div>
        </div>

        {user.role !== "observer" ? (
          <section className="pjd-election-section">
            <div className="pjd-election-section-head">
              <div>
                <span>الهيكلة</span>
                <h2>الدوائر الانتخابية</h2>
              </div>
              <span className="pjd-election-count">
                {local.length} محلية
                {regional.length ? ` · ${regional.length} جهوية` : ""}
              </span>
            </div>

            {constituencies.length ? (
              <div className="pjd-constituency-grid">
                {local.map((constituency) => (
                  <Link
                    className="pjd-constituency-card"
                    href={`/elections/${election.id}/constituencies/${constituency.id}`}
                    key={constituency.id}
                  >
                    <div className="pjd-constituency-card-top">
                      <span>محلية</span>
                      <b>{constituency.seat_count}</b>
                    </div>
                    <h3>{constituency.name}</h3>
                    <div className="pjd-constituency-card-foot">
                      <span>
                        {constituency.coverage.polling_office_count
                          ? `${constituency.coverage.polling_office_count} مكتب`
                          : "لا مكاتب بعد"}
                      </span>
                      <span className="pjd-constituency-open">
                        فتح الدائرة
                        <span aria-hidden="true">←</span>
                      </span>
                    </div>
                  </Link>
                ))}

                {regional.map((constituency) => (
                  <article
                    className="pjd-constituency-card pjd-constituency-card--regional"
                    key={constituency.id}
                  >
                    <div className="pjd-constituency-card-top">
                      <span>جهوية</span>
                      <b>{constituency.seat_count}</b>
                    </div>
                    <h3>{constituency.name}</h3>
                    <div className="pjd-constituency-card-foot">
                      <span>دائرة جهوية</span>
                      <i className="is-ready" aria-hidden="true" />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="pjd-election-empty">لا توجد دوائر.</div>
            )}
          </section>
        ) : null}

        <section className="pjd-election-section">
          <div className="pjd-election-section-head">
            <div>
              <span>التصويت</span>
              <h2>مراكز ومكاتب التصويت</h2>
            </div>

            <div className="pjd-election-section-actions">
              {user.role === "manager" ? (
                <Link
                  href={`/elections/${election.id}/setup/polling-import`}
                >
                  استيراد
                </Link>
              ) : null}
              <span className="pjd-election-count">
                {officesLoaded ? `${offices.length} مكتب` : "—"}
              </span>
            </div>
          </div>

          {officesLoaded ? (
            <div className="pjd-office-grid">
              {offices.map((office) => (
                <Link
                  className="pjd-office-card"
                  href={`/polling-offices/${office.id}`}
                  key={office.id}
                >
                  <div className="pjd-office-number">{office.number}</div>

                  <div className="pjd-office-main">
                    <strong>{office.center.name}</strong>
                    <span>
                      {office.constituency.name}
                      {office.center.commune
                        ? ` · ${office.center.commune}`
                        : ""}
                    </span>
                  </div>

                  <div className="pjd-office-status">
                    <span
                      className={`pjd-office-coverage ${office.coverage_state}`}
                    >
                      {coverageNames[office.coverage_state] ??
                        office.coverage_state}
                    </span>
                    <small>
                      {office.protocol
                        ? protocolNames[office.protocol.state] ??
                          office.protocol.state
                        : "بدون محضر"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="pjd-polling-empty">
              <div className="pjd-polling-empty-icon" aria-hidden="true">
                ◌
              </div>
              <div>
                <h3>لم تُحمّل المراكز والمكاتب بعد</h3>
              </div>
              {user.role === "manager" ? (
                <Link
                  href={`/elections/${election.id}/setup/polling-import`}
                >
                  استيراد
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

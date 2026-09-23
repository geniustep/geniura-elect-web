import { Tajawal } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
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

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

type ElectionsPayload = {
  items: ElectionSummary[];
};

type ConstituenciesPayload = {
  items: ConstituencySummary[];
};

const roleNames = {
  observer: "موكل",
  coordinator: "منسق",
  manager: "مدير",
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

  const preferredConstituency =
    user.default_constituency ??
    (user.constituencies?.length === 1 ? user.constituencies[0] : null);

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

  if (
    backendAvailable &&
    user.role !== "observer" &&
    preferredConstituency
  ) {
    const accessibleConstituencies =
      structureByElection.get(preferredConstituency.election_id) ?? [];
    const preferredIsAccessible = accessibleConstituencies.some(
      (item) => item.id === preferredConstituency.id,
    );

    if (preferredIsAccessible) {
      redirect(
        `/elections/${preferredConstituency.election_id}/constituencies/${preferredConstituency.id}`,
      );
    }
  }

  const firstStructure = elections[0]
    ? structureByElection.get(elections[0].id) ?? []
    : [];
  const regionName = firstStructure[0]?.region.name;

  return (
    <main
      className={`dashboard-shell pjd-dashboard ${tajawal.className}`}
    >
      <AppHeader user={user} />

      <section className="dashboard-content pjd-dashboard-content">
        <section className="pjd-dashboard-hero">
          <div className="pjd-dashboard-hero-copy">
            <span className="pjd-dashboard-party">
              حزب العدالة والتنمية
            </span>
            <h1>لوحة المتابعة</h1>
            <div className="pjd-dashboard-meta">
              <span>{user.organization.name}</span>
              {regionName ? <span>{regionName}</span> : null}
              <span>{roleNames[user.role]}</span>
            </div>
          </div>

          <div className="pjd-dashboard-hero-side">
            <div className="pjd-dashboard-emblem">
              <BrandLogo priority />
            </div>
            <span
              className={
                backendAvailable
                  ? "pjd-dashboard-connection is-online"
                  : "pjd-dashboard-connection is-offline"
              }
            >
              <i aria-hidden="true" />
              {backendAvailable ? "متصل" : "غير متصل"}
            </span>
          </div>
        </section>

        {!backendAvailable ? (
          <div className="pjd-dashboard-alert">
            تعذر تحميل البيانات حاليًا.
          </div>
        ) : elections.length === 0 ? (
          <div className="pjd-dashboard-empty">لا توجد استحقاقات.</div>
        ) : (
          <div className="pjd-election-stack">
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

              const actions = [
                {
                  href: `/elections/${election.id}`,
                  index: "01",
                  label: "الهيكلة",
                },
                ...(user.role !== "observer"
                  ? [
                      {
                        href: `/elections/${election.id}/command-center`,
                        index: "02",
                        label: "المتابعة",
                      },
                      {
                        href: `/elections/${election.id}/results`,
                        index: "03",
                        label: "النتائج",
                      },
                    ]
                  : []),
                {
                  href: `/polling-offices?election=${election.id}`,
                  index: user.role === "observer" ? "02" : "04",
                  label: "مكاتب التصويت",
                },
              ];

              return (
                <article className="pjd-election-card" key={election.id}>
                  <div className="pjd-election-card-head">
                    <div>
                      <div className="pjd-election-meta">
                        <span>{formatElectionDate(election.election_date)}</span>
                        {electionRegion ? <span>{electionRegion}</span> : null}
                      </div>
                      <h2>{election.name}</h2>
                    </div>

                    <span
                      className={`pjd-election-state state-${election.state}`}
                    >
                      {stateNames[election.state] ?? election.state}
                    </span>
                  </div>

                  <div className="pjd-dashboard-metrics">
                    <div>
                      <span>الدوائر المحلية</span>
                      <strong>{election.constituencies.local_count}</strong>
                      <small>{local.length ? localSeats : "—"}</small>
                    </div>
                    <div>
                      <span>الدائرة الجهوية</span>
                      <strong>{election.constituencies.regional_count}</strong>
                      <small>{regional.length ? regionalSeats : "—"}</small>
                    </div>
                    <div>
                      <span>مكاتب التصويت</span>
                      <strong>
                        {officesLoaded
                          ? election.coverage.polling_office_count
                          : "—"}
                      </strong>
                      <small>
                        {officesLoaded
                          ? election.coverage.covered_office_count
                          : "—"}
                      </small>
                    </div>
                    <div>
                      <span>التغطية</span>
                      <strong>
                        {officesLoaded
                          ? `${election.coverage.percent.toFixed(0)}%`
                          : "—"}
                      </strong>
                      <small>
                        {officesLoaded
                          ? `${election.coverage.covered_office_count}/${election.coverage.polling_office_count}`
                          : "—"}
                      </small>
                    </div>
                  </div>

                  {officesLoaded ? (
                    <div className="pjd-coverage-bar">
                      <div>
                        <span>التغطية</span>
                        <strong>{election.coverage.percent.toFixed(1)}%</strong>
                      </div>
                      <progress
                        max={100}
                        value={election.coverage.percent}
                      />
                    </div>
                  ) : (
                    <div className="pjd-dashboard-waiting">
                      <span aria-hidden="true">◌</span>
                      <strong>بانتظار مراكز ومكاتب التصويت</strong>
                    </div>
                  )}

                  <div className="pjd-dashboard-section-head">
                    <h3>الوصول السريع</h3>
                    <Link href={`/elections/${election.id}`}>
                      فتح الاستحقاق
                      <span aria-hidden="true">←</span>
                    </Link>
                  </div>

                  <div className="pjd-dashboard-actions">
                    {actions.map((action) => (
                      <Link
                        key={`${action.index}-${action.label}`}
                        className="pjd-dashboard-action"
                        href={action.href}
                      >
                        <span>{action.index}</span>
                        <strong>{action.label}</strong>
                        <b aria-hidden="true">←</b>
                      </Link>
                    ))}
                  </div>

                  <div className="pjd-readiness">
                    <div className="pjd-readiness-head">
                      <h3>الجاهزية</h3>
                    </div>

                    <div className="pjd-readiness-grid">
                      <div className="pjd-readiness-item is-ready">
                        <span />
                        <strong>الاستحقاق والجهة</strong>
                      </div>
                      <div
                        className={
                          election.constituencies.local_count > 0
                            ? "pjd-readiness-item is-ready"
                            : "pjd-readiness-item"
                        }
                      >
                        <span />
                        <strong>الدوائر</strong>
                      </div>
                      <div
                        className={
                          officesLoaded
                            ? "pjd-readiness-item is-ready"
                            : "pjd-readiness-item is-waiting"
                        }
                      >
                        <span />
                        <strong>مراكز ومكاتب التصويت</strong>
                      </div>
                      <div
                        className={
                          election.coverage.covered_office_count > 0
                            ? "pjd-readiness-item is-ready"
                            : "pjd-readiness-item is-waiting"
                        }
                      >
                        <span />
                        <strong>الموكلون</strong>
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

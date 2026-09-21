import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { AppHeader } from "@/components/navigation/app-header";
import type {
  ConstituencySummary,
  ElectionSummary,
} from "@/lib/elect/types";
import { backendHttp, backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionPayload = { election: ElectionSummary };
type ConstituenciesPayload = { items: ConstituencySummary[] };

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
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-MA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ConstituencyCard({
  constituency,
  electionId,
}: {
  constituency: ConstituencySummary;
  electionId: number;
}) {
  return (
    <Link
      className="pjd-constituency-card"
      href={`/elections/${electionId}/constituencies/${constituency.id}`}
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
  );
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

  const electionResult = await backendHttp<ElectionPayload>(
    `/api/v1/elections/${electionId}`,
    {
      method: "GET",
      sessionId,
    },
  );

  if (electionResult.response.status === 401) {
    redirect("/login");
  }
  if (electionResult.response.status === 404) {
    notFound();
  }
  if (
    !electionResult.response.ok ||
    !electionResult.payload ||
    !electionResult.payload.success
  ) {
    throw new Error("تعذر تحميل بيانات الانتخابات من الخدمة.");
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

  const election = electionResult.payload.data.election;
  const local = constituencies.filter((item) => item.kind === "local");
  const regional = constituencies.filter((item) => item.kind === "regional");
  const localSeats = local.reduce((total, item) => total + item.seat_count, 0);
  const regionalSeats = regional.reduce(
    (total, item) => total + item.seat_count,
    0,
  );
  const totalSeats = localSeats + regionalSeats;
  const regionName = constituencies[0]?.region.name;
  const quickLocal = local.slice(0, 6);
  const remainingLocal = local.slice(6);

  return (
    <main className="dashboard-shell pjd-dashboard pjd-election-page">
      <AppHeader user={user} />

      <section className="dashboard-content pjd-election-content pjd-election-content--compact">
        <nav className="pjd-election-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <strong>{election.name}</strong>
        </nav>

        <section className="pjd-election-hero pjd-election-hero--compact">
          <div className="pjd-election-hero-copy">
            <div className="pjd-election-hero-meta">
              <span>{formatElectionDate(election.election_date)}</span>
              {regionName ? <span>{regionName}</span> : null}
            </div>

            <h1>{election.name}</h1>

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

        <div className="pjd-election-kpis pjd-election-kpis--compact">
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
            <span>إجمالي المقاعد</span>
            <strong>{totalSeats || "—"}</strong>
            <small>ضمن النطاق الحالي</small>
          </div>
          <div>
            <span>التغطية</span>
            <strong>{`${election.coverage.percent.toFixed(0)}%`}</strong>
            <small>
              {election.coverage.polling_office_count
                ? `${election.coverage.covered_office_count}/${election.coverage.polling_office_count} مكتب`
                : "لا مكاتب بعد"}
            </small>
          </div>
        </div>

        {user.role !== "observer" ? (
          <section className="pjd-election-section pjd-election-section--compact">
            <div className="pjd-election-section-head">
              <div>
                <span>وصول سريع</span>
                <h2>الدوائر الانتخابية</h2>
              </div>
              <span className="pjd-election-count">
                {local.length} محلية
                {regional.length ? ` · ${regional.length} جهوية` : ""}
              </span>
            </div>

            {constituencies.length ? (
              <>
                {quickLocal.length ? (
                  <div className="pjd-constituency-grid pjd-constituency-grid--quick">
                    {quickLocal.map((constituency) => (
                      <ConstituencyCard
                        constituency={constituency}
                        electionId={election.id}
                        key={constituency.id}
                      />
                    ))}
                  </div>
                ) : null}

                {remainingLocal.length ? (
                  <details className="pjd-constituency-more">
                    <summary>
                      <span>عرض باقي الدوائر</span>
                      <strong>{remainingLocal.length}</strong>
                    </summary>
                    <div className="pjd-constituency-grid">
                      {remainingLocal.map((constituency) => (
                        <ConstituencyCard
                          constituency={constituency}
                          electionId={election.id}
                          key={constituency.id}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}

                {regional.length ? (
                  <div className="pjd-regional-strip">
                    <div>
                      <span>الدائرة الجهوية</span>
                      <strong>{regional.map((item) => item.name).join(" · ")}</strong>
                    </div>
                    <span>{regionalSeats} مقاعد</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="pjd-election-empty">لا توجد دوائر.</div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

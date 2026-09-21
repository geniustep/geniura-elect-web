import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { AppHeader } from "@/components/navigation/app-header";
import type {
  ConstituencyResult,
  ConstituencySummary,
} from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ConstituenciesPayload = { items: ConstituencySummary[] };

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-MA").format(value);
}

export default async function ElectionResultsPage({
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

  let constituencies: ConstituencySummary[];
  let results: ConstituencyResult[];

  try {
    const data = await backendRequest<ConstituenciesPayload>(
      `/api/v1/elections/${electionId}/constituencies`,
      {
        method: "GET",
        sessionId,
      },
    );
    constituencies = data.items;

    results = await Promise.all(
      constituencies.map((constituency) =>
        backendRequest<ConstituencyResult>(
          `/api/v1/constituencies/${constituency.id}/results?trust_level=verified`,
          {
            method: "GET",
            sessionId,
          },
        ),
      ),
    );
  } catch {
    notFound();
  }

  const resultByConstituency = new Map(
    results.map((result) => [result.constituency_id, result]),
  );
  const hasVerifiedMaterial = results.some(
    (result) => result.trusted_office_count > 0,
  );
  const localCount = constituencies.filter(
    (item) => item.kind === "local",
  ).length;
  const regionalCount = constituencies.filter(
    (item) => item.kind === "regional",
  ).length;
  const localSeats = constituencies
    .filter((item) => item.kind === "local")
    .reduce((total, item) => total + item.seat_count, 0);
  const regionalSeats = constituencies
    .filter((item) => item.kind === "regional")
    .reduce((total, item) => total + item.seat_count, 0);
  const totalTrustedOffices = results.reduce(
    (total, result) => total + result.trusted_office_count,
    0,
  );
  const totalOffices = results.reduce(
    (total, result) => total + result.office_count,
    0,
  );
  const totalVoters = results.reduce(
    (total, result) => total + result.totals.voters,
    0,
  );
  const totalValidVotes = results.reduce(
    (total, result) => total + result.totals.valid_votes,
    0,
  );
  const overallCompleteness = totalOffices
    ? (totalTrustedOffices / totalOffices) * 100
    : 0;

  return (
    <main className="dashboard-shell pjd-dashboard ge-results-page">
      <AppHeader user={user} />

      <section className="dashboard-content ge-results-content">
        <nav className="pjd-election-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>الاستحقاق</Link>
          <span>/</span>
          <strong>النتائج</strong>
        </nav>

        <section className="ge-results-hero">
          <div className="ge-results-hero-copy">
            <div className="ge-results-kicker">
              <span aria-hidden="true" />
              مركز النتائج
            </div>
            <h1>النتائج والتجميع</h1>
            <p>
              قراءة تشغيلية موحدة للمحاضر المعتمدة، مع إبراز نسبة الاكتمال
              والأصوات والتوزيع داخل كل دائرة.
            </p>

            <div className="ge-results-hero-meta">
              <span>{localCount} دوائر محلية</span>
              <span>{regionalCount} جهوية</span>
              <span>{localSeats + regionalSeats} مقعدًا</span>
            </div>
          </div>

          <div className="ge-results-hero-side">
            <div className="ge-results-emblem">
              <BrandLogo priority />
            </div>
            <div className="ge-results-completeness-card">
              <span>اكتمال المحاضر</span>
              <strong>{overallCompleteness.toFixed(1)}%</strong>
              <div className="ge-results-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, overallCompleteness))}%`,
                  }}
                />
              </div>
              <small>
                {formatNumber(totalTrustedOffices)} من {formatNumber(totalOffices)}
              </small>
            </div>
          </div>
        </section>

        <div className="ge-results-kpis">
          <div className="is-primary">
            <span>محاضر معتمدة</span>
            <strong>{formatNumber(totalTrustedOffices)}</strong>
            <small>من أصل {formatNumber(totalOffices)} مكتب</small>
          </div>
          <div>
            <span>المصوتون</span>
            <strong>{formatNumber(totalVoters)}</strong>
            <small>وفق المحاضر المعتمدة</small>
          </div>
          <div>
            <span>الأصوات الصحيحة</span>
            <strong>{formatNumber(totalValidVotes)}</strong>
            <small>ضمن نطاق التجميع الحالي</small>
          </div>
          <div>
            <span>الدوائر</span>
            <strong>{formatNumber(constituencies.length)}</strong>
            <small>{localSeats + regionalSeats} مقعدًا</small>
          </div>
        </div>

        <div className="ge-results-note">
          <span>متابعة داخلية</span>
          <p>
            المعطيات المعروضة هنا مبنية على المحاضر المعتمدة داخل المنصة ولا
            تمثل إعلانًا رسميًا للنتائج.
          </p>
        </div>

        {!hasVerifiedMaterial ? (
          <section className="ge-results-empty">
            <div className="ge-results-empty-main">
              <div className="ge-results-empty-icon" aria-hidden="true">
                ◌
              </div>
              <div>
                <span>محرك التجميع جاهز</span>
                <h2>بانتظار أول محضر معتمد</h2>
                <p>
                  ستظهر المؤشرات والنتائج تلقائيًا عند اعتماد المحاضر، مع نسبة
                  اكتمال واضحة لكل دائرة.
                </p>
              </div>
            </div>

            <div className="ge-results-ready-head">
              <div>
                <span>نطاق التجميع</span>
                <h3>الدوائر المهيأة</h3>
              </div>
              <strong>{constituencies.length}</strong>
            </div>

            <div className="results-ready-grid">
              {constituencies.map((constituency) => (
                <article className="results-ready-card" key={constituency.id}>
                  <span>
                    {constituency.kind === "local"
                      ? "دائرة محلية"
                      : "دائرة جهوية"}
                  </span>
                  <strong>{constituency.name}</strong>
                  <small>{constituency.seat_count} مقاعد</small>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="ge-results-stack">
            <div className="ge-results-section-head">
              <div>
                <span>التفاصيل</span>
                <h2>النتائج حسب الدائرة</h2>
              </div>
              <strong>{constituencies.length} دوائر</strong>
            </div>

            <div className="constituency-results">
              {constituencies.map((constituency) => {
                const result = resultByConstituency.get(constituency.id);
                if (!result) return null;

                return (
                  <article className="result-card ge-result-card" key={constituency.id}>
                    <div className="result-card-heading">
                      <div>
                        <p className="eyebrow">
                          {constituency.kind === "local"
                            ? "دائرة محلية"
                            : "دائرة جهوية"}
                        </p>
                        <h2>{constituency.name}</h2>
                        <span>{constituency.region.name}</span>
                      </div>

                      <div className="result-completeness">
                        <strong>{result.completeness_percent.toFixed(1)}%</strong>
                        <small>
                          {result.trusted_office_count}/{result.office_count} محاضر
                          معتمدة
                        </small>
                        <div className="ge-result-card-progress" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, result.completeness_percent),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <dl className="result-totals">
                      <div>
                        <dt>المصوتون</dt>
                        <dd>{formatNumber(result.totals.voters)}</dd>
                      </div>
                      <div>
                        <dt>الأصوات الصحيحة</dt>
                        <dd>{formatNumber(result.totals.valid_votes)}</dd>
                      </div>
                      <div>
                        <dt>الأوراق الملغاة</dt>
                        <dd>{formatNumber(result.totals.invalid_votes)}</dd>
                      </div>
                      <div>
                        <dt>المقاعد</dt>
                        <dd>{constituency.seat_count}</dd>
                      </div>
                    </dl>

                    <div className="result-list-table">
                      <div className="result-list-head">
                        <span>اللائحة</span>
                        <span>الأصوات</span>
                        <span>المقاعد المحسوبة</span>
                      </div>

                      {constituency.candidate_lists.map((candidateList) => {
                        const votes =
                          result.votes_by_list[String(candidateList.id)] ?? 0;
                        const seats =
                          result.allocation?.seats_by_list[
                            String(candidateList.id)
                          ] ?? 0;

                        return (
                          <div
                            className="result-list-row"
                            key={candidateList.id}
                          >
                            <span>
                              <b>{candidateList.ballot_number ?? "—"}</b>
                              <span>
                                {candidateList.name}
                                {candidateList.party?.short_name
                                  ? ` · ${candidateList.party.short_name}`
                                  : ""}
                              </span>
                            </span>
                            <strong>{formatNumber(votes)}</strong>
                            <strong>{result.allocation ? seats : "—"}</strong>
                          </div>
                        );
                      })}
                    </div>

                    <div className="result-foot">
                      <span>
                        {result.nature === "projection"
                          ? "تجميع جزئي"
                          : "حساب داخلي مكتمل للمحاضر المعتمدة"}
                      </span>
                      {result.allocation_error ? (
                        <span>تعذر حساب المقاعد: {result.allocation_error}</span>
                      ) : result.allocation &&
                        !result.allocation.allocation_complete ? (
                        <span>توجد حالة تحتاج حسمًا رسميًا/يدويًا.</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

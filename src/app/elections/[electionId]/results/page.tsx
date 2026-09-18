import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
  const localSeats = constituencies
    .filter((item) => item.kind === "local")
    .reduce((total, item) => total + item.seat_count, 0);
  const regionalSeats = constituencies
    .filter((item) => item.kind === "regional")
    .reduce((total, item) => total + item.seat_count, 0);

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">مركز العمليات</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>الاستحقاق</Link>
          <span>/</span>
          <strong>النتائج</strong>
        </nav>

        <section className="results-hero">
          <div>
            <div className="presentation-kicker">
              <span className="status-orb" aria-hidden="true" />
              مركز التجميع
            </div>
            <h1>النتائج والتجميع</h1>
            <p>
              تجميع داخلي قابل للتتبع مبني حصريًا على المحاضر المعتمدة داخل
              المنصة.
            </p>
          </div>
          <div className="results-scope-chip">
            <span>النطاق الحالي</span>
            <strong>{constituencies.length} دوائر</strong>
          </div>
        </section>

        <div className="results-structure-grid">
          <div>
            <span>الدوائر المحلية</span>
            <strong>
              {constituencies.filter((item) => item.kind === "local").length}
            </strong>
            <small>{localSeats} مقعدًا</small>
          </div>
          <div>
            <span>الدوائر الجهوية</span>
            <strong>
              {constituencies.filter((item) => item.kind === "regional").length}
            </strong>
            <small>{regionalSeats} مقاعد</small>
          </div>
          <div>
            <span>محاضر معتمدة</span>
            <strong>
              {results.reduce(
                (total, result) => total + result.trusted_office_count,
                0,
              )}
            </strong>
            <small>مصدر التجميع الحالي</small>
          </div>
        </div>

        <div className="presentation-disclaimer">
          <span>تنبيه منهجي</span>
          <p>
            هذه الصفحة مخصصة للمتابعة الداخلية. أي تجميع أو إسقاط يظهر هنا لا
            يمثل إعلانًا رسميًا للنتائج.
          </p>
        </div>

        {!hasVerifiedMaterial ? (
          <>
            <div className="structured-empty-state results-empty-state">
              <div className="structured-empty-icon" aria-hidden="true">
                ◌
              </div>
              <div>
                <span>محرك التجميع جاهز</span>
                <h3>لم تبدأ المحاضر المعتمدة بالوصول بعد</h3>
                <p>
                  ستظهر النتائج هنا تلقائيًا لكل دائرة فور اعتماد محاضر مكاتب
                  التصويت، مع نسبة اكتمال واضحة وقابلية تتبع للمصدر.
                </p>
              </div>
              <div className="structured-empty-status">
                <span className="status-orb status-orb--waiting" />
                بانتظار المحاضر
              </div>
            </div>

            <section className="presentation-section-block">
              <div className="presentation-section-heading">
                <div>
                  <span>نطاق التجميع</span>
                  <h2>الدوائر المهيأة</h2>
                </div>
                <small>{constituencies.length} دوائر</small>
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
          </>
        ) : (
          <div className="constituency-results">
            {constituencies.map((constituency) => {
              const result = resultByConstituency.get(constituency.id);
              if (!result) return null;

              return (
                <article className="result-card" key={constituency.id}>
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
                    </div>
                  </div>

                  <dl className="result-totals">
                    <div>
                      <dt>المصوتون</dt>
                      <dd>{result.totals.voters}</dd>
                    </div>
                    <div>
                      <dt>الأصوات الصحيحة</dt>
                      <dd>{result.totals.valid_votes}</dd>
                    </div>
                    <div>
                      <dt>الأوراق الملغاة</dt>
                      <dd>{result.totals.invalid_votes}</dd>
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
                          <strong>{votes}</strong>
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
        )}
      </section>
    </main>
  );
}

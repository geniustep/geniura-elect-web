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

  return (
    <main className="dashboard-shell">
      <AppHeader user={user} />
      <section className="dashboard-content">
        <nav className="breadcrumbs">
          <Link href="/dashboard">الرئيسية</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>الاستحقاق</Link>
          <span>/</span>
          <strong>النتائج</strong>
        </nav>

        <div className="page-heading">
          <div>
            <p className="eyebrow">RESULTS</p>
            <h1>النتائج والتجميع</h1>
            <p>
              الأرقام المعروضة مبنية على المحاضر المعتمدة داخل المنصة، وليست
              إعلانًا للنتيجة الرسمية.
            </p>
          </div>
        </div>

        <div className="notice warning">
          هذه حسابات داخلية للمراقبة والمتابعة. نسبة اكتمال المحاضر تظهر مع
          كل دائرة، ولا تُعامل هذه الصفحة كمصدر للنتيجة الرسمية.
        </div>

        <div className="constituency-results">
          {constituencies.map((constituency) => {
            const result = resultByConstituency.get(constituency.id);
            if (!result) return null;

            return (
              <article className="result-card" key={constituency.id}>
                <div className="result-card-heading">
                  <div>
                    <p className="eyebrow">
                      {constituency.kind === "local" ? "LOCAL" : "REGIONAL"}
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
                        <strong>
                          {result.allocation ? seats : "—"}
                        </strong>
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
    </main>
  );
}

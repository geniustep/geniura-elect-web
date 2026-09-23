import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type { ElectionSummary, PollingOffice } from "@/lib/elect/types";
import { backendHttp } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionPayload = { election: ElectionSummary };
type OfficesPayload = { items: PollingOffice[] };

const PAGE_SIZE = 50;

const protocolStateNames: Record<string, string> = {
  draft: "مسودة",
  entered: "تم الإدخال",
  document_attached: "الوثيقة مرفقة",
  validated: "تم التحقق",
  verified: "معتمد",
  rejected: "مرفوض",
};

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("ar");
}

function protocolLabel(office: PollingOffice) {
  if (!office.protocol) return "لم يُدخل";
  return protocolStateNames[office.protocol.state] ?? office.protocol.state;
}

function matchesOffice(office: PollingOffice, query: string) {
  if (!query) return true;

  const haystack = [
    office.number,
    office.code,
    office.center.name,
    office.center.address,
    office.center.commune,
    office.area?.name,
    office.central_office?.number,
    office.central_office?.name,
    office.constituency.name,
    office.primary_representative?.name,
    protocolLabel(office),
  ]
    .map((value) => normalize(value == null ? "" : String(value)))
    .join(" ");

  return haystack.includes(query);
}

export default async function ProtocolsPage({
  params,
  searchParams,
}: {
  params: Promise<{ electionId: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;
  if (user.role === "observer") {
    redirect(`/elections/${electionId}`);
  }

  const { q = "", page = "1" } = await searchParams;
  const sessionId = await readElectSessionId();

  const [electionResult, officesResult] = await Promise.all([
    backendHttp<ElectionPayload>(
      `/api/v1/elections/${encodeURIComponent(electionId)}`,
      { method: "GET", sessionId },
    ),
    backendHttp<OfficesPayload>(
      `/api/v1/elections/${encodeURIComponent(electionId)}/polling-offices`,
      { method: "GET", sessionId },
    ),
  ]);

  if (
    electionResult.response.status === 401 ||
    officesResult.response.status === 401
  ) {
    redirect("/login");
  }

  if (
    electionResult.response.status === 404 ||
    officesResult.response.status === 404
  ) {
    notFound();
  }

  if (
    !electionResult.response.ok ||
    !electionResult.payload?.success ||
    !officesResult.response.ok ||
    !officesResult.payload?.success
  ) {
    throw new Error("تعذر تحميل مساحة المحاضر.");
  }

  const election = electionResult.payload.data.election;
  const offices = [...officesResult.payload.data.items].sort((a, b) => {
    const area = (a.area?.name ?? "").localeCompare(b.area?.name ?? "", "ar");
    if (area !== 0) return area;
    const central =
      (a.central_office?.number ?? Number.MAX_SAFE_INTEGER) -
      (b.central_office?.number ?? Number.MAX_SAFE_INTEGER);
    if (central !== 0) return central;
    return a.number - b.number;
  });

  const query = normalize(q);
  const filtered = offices.filter((office) => matchesOffice(office, query));
  const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const entered = offices.filter((office) => Boolean(office.protocol)).length;
  const verified = offices.filter(
    (office) => office.protocol?.state === "verified",
  ).length;
  const missing = Math.max(offices.length - entered, 0);
  const querySuffix = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <main className="dashboard-shell protocols-hub-page">
      <AppHeader user={user} />
      <section className="dashboard-content protocols-hub-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>{election.name}</Link>
          <span>/</span>
          <strong>المحاضر</strong>
        </nav>

        <section className="protocols-hub-hero">
          <div>
            <span className="presentation-kicker">إدخال محاضر مكاتب التصويت</span>
            <h1>المحاضر</h1>
            <p>
              اختر المكتب مباشرة ثم ابدأ إدخال المحضر. لا حاجة للمرور عبر
              غرفة القيادة أو صفحة المكتب.
            </p>
          </div>
          <div className="protocols-hub-hero-badge">
            <span>إجمالي المكاتب</span>
            <strong>{offices.length}</strong>
          </div>
        </section>

        <section className="protocols-hub-kpis" aria-label="حالة المحاضر">
          <article><span>لم تُدخل بعد</span><strong>{missing}</strong></article>
          <article><span>بدأ إدخالها</span><strong>{entered}</strong></article>
          <article><span>معتمدة</span><strong>{verified}</strong></article>
        </section>

        <form className="protocols-search" method="GET">
          <label htmlFor="protocol-office-search">البحث عن مكتب</label>
          <div>
            <input
              id="protocol-office-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="رقم المكتب، المركز، المقاطعة أو الجماعة…"
            />
            <button type="submit">بحث</button>
            {q ? (
              <Link href={`/elections/${electionId}/protocols`}>إلغاء البحث</Link>
            ) : null}
          </div>
        </form>

        <section className="protocols-office-section">
          <div className="presentation-section-heading">
            <div>
              <span>مكاتب التصويت</span>
              <h2>{q ? `نتائج البحث (${filtered.length})` : "اختر المكتب"}</h2>
            </div>
            <small>
              {filtered.length
                ? `عرض ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} من ${filtered.length}`
                : "لا توجد نتائج"}
            </small>
          </div>

          {visible.length ? (
            <div className="protocols-office-list">
              {visible.map((office) => {
                const state = office.protocol?.state ?? "missing";
                return (
                  <article className="protocols-office-row" key={office.id}>
                    <div className="protocols-office-number">
                      <small>مكتب</small>
                      <strong>{office.number}</strong>
                    </div>
                    <div className="protocols-office-main">
                      <strong>{office.center.name}</strong>
                      <span>
                        {office.area?.name ?? office.center.commune ?? "—"}
                        {office.central_office
                          ? ` · مركزي ${office.central_office.number}`
                          : ""}
                      </span>
                      <small>{office.constituency.name}</small>
                    </div>
                    <span className={`protocols-office-state state-${state}`}>
                      {protocolLabel(office)}
                    </span>
                    <Link
                      className="protocols-office-action"
                      href={`/polling-offices/${office.id}/protocol`}
                    >
                      {office.protocol ? "متابعة المحضر" : "إدخال المحضر"}
                      <span aria-hidden="true">←</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">لا يوجد مكتب يطابق البحث الحالي.</div>
          )}

          {pageCount > 1 ? (
            <nav className="protocols-pagination" aria-label="صفحات المكاتب">
              {currentPage > 1 ? (
                <Link href={`/elections/${electionId}/protocols?page=${currentPage - 1}${querySuffix}`}>السابق</Link>
              ) : <span />}
              <strong>صفحة {currentPage} من {pageCount}</strong>
              {currentPage < pageCount ? (
                <Link href={`/elections/${electionId}/protocols?page=${currentPage + 1}${querySuffix}`}>التالي</Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      </section>
    </main>
  );
}

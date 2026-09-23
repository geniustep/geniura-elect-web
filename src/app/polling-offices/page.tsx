import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type {
  ConstituencyCoverageDashboard,
  ConstituencySummary,
  ElectionSummary,
  PollingOffice,
} from "@/lib/elect/types";
import { backendHttp } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionsPayload = { items: ElectionSummary[] };
type ConstituenciesPayload = { items: ConstituencySummary[] };
type OfficesPayload = { items: PollingOffice[] };

type OfficeView = {
  id: number;
  number: number;
  code: string;
  coverageState: string;
  areaName: string;
  centerName: string;
  centralNumber: number | null;
  constituencyName: string;
  representativeName: string | null;
};

const PAGE_SIZE = 50;

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ar");
}

function matchesOffice(office: OfficeView, query: string) {
  if (!query) return true;

  return [
    office.number,
    office.code,
    office.areaName,
    office.centerName,
    office.centralNumber,
    office.constituencyName,
    office.representativeName,
  ]
    .map(normalize)
    .join(" ")
    .includes(query);
}

function renderLoadError(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null;

  return (
    <main className="dashboard-shell polling-offices-index-page">
      <AppHeader user={user} />
      <section className="dashboard-content polling-offices-index-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <strong>مكاتب التصويت</strong>
        </nav>

        <div className="empty-state">
          تعذر تحميل مكاتب التصويت حاليًا. أعد المحاولة بعد قليل.
        </div>
      </section>
    </main>
  );
}

export default async function PollingOfficesPage({
  searchParams,
}: {
  searchParams: Promise<{
    election?: string;
    q?: string;
    area?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const sessionId = await readElectSessionId();

  let elections: ElectionSummary[] = [];

  try {
    const electionResult = await backendHttp<ElectionsPayload>(
      "/api/v1/elections",
      { method: "GET", sessionId },
    );

    if (
      !electionResult.response.ok ||
      !electionResult.payload?.success
    ) {
      return renderLoadError(user);
    }

    elections = electionResult.payload.data.items;
  } catch (error) {
    console.error("polling-offices:elections-load-failed", error);
    return renderLoadError(user);
  }

  if (!elections.length) {
    return (
      <main className="dashboard-shell polling-offices-index-page">
        <AppHeader user={user} />
        <section className="dashboard-content polling-offices-index-content">
          <div className="empty-state">لا توجد استحقاقات متاحة لهذا الحساب.</div>
        </section>
      </main>
    );
  }

  const requestedElectionId = Number.parseInt(params.election ?? "", 10);
  const preferredElectionId =
    user.default_constituency?.election_id ??
    user.constituencies?.[0]?.election_id ??
    null;

  const selectedElection =
    elections.find((item) => item.id === requestedElectionId) ??
    elections.find((item) => item.id === preferredElectionId) ??
    elections[0];

  let offices: OfficeView[] = [];

  try {
    if (user.role === "observer") {
      const officeResult = await backendHttp<OfficesPayload>(
        `/api/v1/elections/${selectedElection.id}/polling-offices`,
        { method: "GET", sessionId },
      );

      if (!officeResult.response.ok || !officeResult.payload?.success) {
        return renderLoadError(user);
      }

      offices = officeResult.payload.data.items.map((office) => ({
        id: office.id,
        number: office.number,
        code: office.code,
        coverageState: office.coverage_state,
        areaName: office.area?.name ?? office.center.commune ?? "—",
        centerName: office.center.name,
        centralNumber: office.central_office?.number ?? null,
        constituencyName: office.constituency.name,
        representativeName: office.primary_representative?.name ?? null,
      }));
    } else {
      const constituencyResult = await backendHttp<ConstituenciesPayload>(
        `/api/v1/elections/${selectedElection.id}/constituencies`,
        { method: "GET", sessionId },
      );

      if (
        !constituencyResult.response.ok ||
        !constituencyResult.payload?.success
      ) {
        return renderLoadError(user);
      }

      const localConstituencies =
        constituencyResult.payload.data.items.filter(
          (item) => item.kind === "local",
        );

      const dashboardResults = await Promise.allSettled(
        localConstituencies.map((constituency) =>
          backendHttp<ConstituencyCoverageDashboard>(
            `/api/v1/elections/${selectedElection.id}/constituencies/${constituency.id}/dashboard`,
            { method: "GET", sessionId },
          ),
        ),
      );

      const dashboards = dashboardResults.flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        if (
          !result.value.response.ok ||
          !result.value.payload?.success
        ) {
          return [];
        }
        return [result.value.payload.data];
      });

      if (localConstituencies.length && !dashboards.length) {
        return renderLoadError(user);
      }

      offices = dashboards.flatMap((dashboard) =>
        dashboard.offices.map((office) => ({
          id: office.id,
          number: office.number,
          code: office.code,
          coverageState: office.coverage_state,
          areaName: office.area?.name ?? "—",
          centerName: office.center.name,
          centralNumber: office.central_office?.number ?? null,
          constituencyName: dashboard.constituency.name,
          representativeName: office.representative?.name ?? null,
        })),
      );
    }
  } catch (error) {
    console.error("polling-offices:office-load-failed", error);
    return renderLoadError(user);
  }

  offices.sort((a, b) => {
    const areaCompare = a.areaName.localeCompare(b.areaName, "ar");
    if (areaCompare !== 0) return areaCompare;

    const centralCompare =
      (a.centralNumber ?? Number.MAX_SAFE_INTEGER) -
      (b.centralNumber ?? Number.MAX_SAFE_INTEGER);
    if (centralCompare !== 0) return centralCompare;

    return a.number - b.number;
  });

  const areaNames = Array.from(
    new Set(offices.map((office) => office.areaName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "ar"));

  const query = normalize(params.q);
  const selectedArea = params.area ?? "";

  const filtered = offices.filter((office) => {
    if (!matchesOffice(office, query)) return false;
    if (selectedArea && office.areaName !== selectedArea) return false;
    return true;
  });

  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const covered = offices.filter(
    (office) => office.coverageState !== "uncovered",
  ).length;
  const uncovered = Math.max(offices.length - covered, 0);
  const represented = offices.filter(
    (office) => Boolean(office.representativeName),
  ).length;

  const persistentParams = new URLSearchParams();
  persistentParams.set("election", String(selectedElection.id));
  if (params.q) persistentParams.set("q", params.q);
  if (selectedArea) persistentParams.set("area", selectedArea);

  function pageHref(page: number) {
    const next = new URLSearchParams(persistentParams);
    next.set("page", String(page));
    return `/polling-offices?${next.toString()}`;
  }

  return (
    <main className="dashboard-shell polling-offices-index-page">
      <AppHeader user={user} />

      <section className="dashboard-content polling-offices-index-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">لوحة المتابعة</Link>
          <span>/</span>
          <strong>مكاتب التصويت</strong>
        </nav>

        <section className="polling-offices-index-hero">
          <div>
            <span className="presentation-kicker">POLLING OFFICES</span>
            <h1>مكاتب التصويت</h1>
            <p>
              اختر المكتب ثم اضغط «إدخال المحضر» للانتقال مباشرة إلى نموذج
              المحضر.
            </p>
          </div>

          <div className="polling-offices-index-election">
            <span>الاستحقاق</span>
            <strong>{selectedElection.name}</strong>
            <small>{offices.length} مكتبًا</small>
          </div>
        </section>

        <section className="polling-offices-index-kpis">
          <article>
            <span>إجمالي المكاتب</span>
            <strong>{offices.length}</strong>
          </article>
          <article>
            <span>مغطاة</span>
            <strong>{covered}</strong>
          </article>
          <article>
            <span>بدون تغطية</span>
            <strong>{uncovered}</strong>
          </article>
          <article>
            <span>بموكل معيّن</span>
            <strong>{represented}</strong>
          </article>
        </section>

        <form className="polling-offices-index-filters" method="GET">
          <label>
            <span>الاستحقاق</span>
            <select
              name="election"
              defaultValue={String(selectedElection.id)}
            >
              {elections.map((election) => (
                <option value={String(election.id)} key={election.id}>
                  {election.name}
                </option>
              ))}
            </select>
          </label>

          <label className="is-search">
            <span>البحث</span>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="رقم المكتب، المركز، المقاطعة، الموكل…"
            />
          </label>

          <label>
            <span>المقاطعة / الجماعة</span>
            <select name="area" defaultValue={selectedArea}>
              <option value="">الكل</option>
              {areaNames.map((area) => (
                <option value={area} key={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">تطبيق</button>

          {(params.q || selectedArea) ? (
            <Link
              className="polling-offices-clear"
              href={`/polling-offices?election=${selectedElection.id}`}
            >
              مسح الفلاتر
            </Link>
          ) : null}
        </form>

        <section className="polling-offices-index-section">
          <div className="presentation-section-heading">
            <div>
              <span>القائمة التشغيلية</span>
              <h2>اختر المكتب</h2>
            </div>
            <small>
              {filtered.length
                ? `عرض ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} من ${filtered.length}`
                : "لا توجد نتائج"}
            </small>
          </div>

          {visible.length ? (
            <div className="polling-offices-index-list">
              {visible.map((office) => (
                <article className="polling-office-index-card" key={office.id}>
                  <div className="polling-office-index-number">
                    <span>مكتب</span>
                    <strong>{office.number}</strong>
                  </div>

                  <div className="polling-office-index-main">
                    <strong>{office.centerName}</strong>
                    <span>
                      {office.areaName}
                      {office.centralNumber
                        ? ` · المكتب المركزي ${office.centralNumber}`
                        : ""}
                    </span>
                    <small>{office.constituencyName}</small>
                  </div>

                  <div className="polling-office-index-representative">
                    <span>الموكل</span>
                    <strong>{office.representativeName ?? "غير معيّن"}</strong>
                  </div>

                  <span
                    className={`polling-office-index-protocol state-${office.coverageState}`}
                  >
                    {office.coverageState === "uncovered"
                      ? "غير مغطى"
                      : "مغطى"}
                  </span>

                  <div className="polling-office-index-actions">
                    <Link
                      className="polling-office-index-details"
                      href={`/polling-offices/${office.id}`}
                    >
                      تفاصيل المكتب
                    </Link>
                    <Link
                      className="polling-office-index-enter"
                      href={`/polling-offices/${office.id}/protocol`}
                    >
                      إدخال المحضر
                      <span aria-hidden="true">←</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              لا يوجد مكتب يطابق الفلاتر الحالية.
            </div>
          )}

          {pageCount > 1 ? (
            <nav className="protocols-pagination" aria-label="صفحات مكاتب التصويت">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)}>السابق</Link>
              ) : (
                <span />
              )}

              <strong>
                صفحة {currentPage} من {pageCount}
              </strong>

              {currentPage < pageCount ? (
                <Link href={pageHref(currentPage + 1)}>التالي</Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </section>
    </main>
  );
}

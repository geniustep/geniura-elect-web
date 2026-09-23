import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import type { ElectionSummary, PollingOffice } from "@/lib/elect/types";
import { backendRequest } from "@/lib/server/backend";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ElectionsPayload = { items: ElectionSummary[] };
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

function protocolLabel(office: PollingOffice) {
  if (!office.protocol) return "لم يُدخل";
  return protocolStateNames[office.protocol.state] ?? office.protocol.state;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ar");
}

function matchesOffice(office: PollingOffice, query: string) {
  if (!query) return true;

  return [
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
    .map(normalize)
    .join(" ")
    .includes(query);
}

export default async function PollingOfficesPage({
  searchParams,
}: {
  searchParams: Promise<{
    election?: string;
    q?: string;
    area?: string;
    protocol?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const sessionId = await readElectSessionId();

  const electionsData = await backendRequest<ElectionsPayload>(
    "/api/v1/elections",
    { method: "GET", sessionId },
  );
  const elections = electionsData.items;

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

  const officesData = await backendRequest<OfficesPayload>(
    `/api/v1/elections/${selectedElection.id}/polling-offices`,
    { method: "GET", sessionId },
  );

  const offices = [...officesData.items].sort((a, b) => {
    const areaCompare = (a.area?.name ?? "").localeCompare(
      b.area?.name ?? "",
      "ar",
    );
    if (areaCompare !== 0) return areaCompare;

    const centralCompare =
      (a.central_office?.number ?? Number.MAX_SAFE_INTEGER) -
      (b.central_office?.number ?? Number.MAX_SAFE_INTEGER);
    if (centralCompare !== 0) return centralCompare;

    return a.number - b.number;
  });

  const areaNames = Array.from(
    new Set(
      offices
        .map((office) => office.area?.name ?? office.center.commune ?? "")
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ar"));

  const query = normalize(params.q);
  const selectedArea = params.area ?? "";
  const selectedProtocol = params.protocol ?? "";

  const filtered = offices.filter((office) => {
    if (!matchesOffice(office, query)) return false;

    const officeArea = office.area?.name ?? office.center.commune ?? "";
    if (selectedArea && officeArea !== selectedArea) return false;

    if (selectedProtocol === "missing" && office.protocol) return false;
    if (selectedProtocol === "entered" && !office.protocol) return false;
    if (
      selectedProtocol === "verified" &&
      office.protocol?.state !== "verified"
    ) {
      return false;
    }

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

  const entered = offices.filter((office) => Boolean(office.protocol)).length;
  const verified = offices.filter(
    (office) => office.protocol?.state === "verified",
  ).length;
  const missing = Math.max(offices.length - entered, 0);

  const persistentParams = new URLSearchParams();
  persistentParams.set("election", String(selectedElection.id));
  if (params.q) persistentParams.set("q", params.q);
  if (selectedArea) persistentParams.set("area", selectedArea);
  if (selectedProtocol) persistentParams.set("protocol", selectedProtocol);

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
              اختر مكتب التصويت ثم ادخل مباشرة إلى صفحة إدخال المحضر.
            </p>
          </div>

          <div className="polling-offices-index-election">
            <span>الاستحقاق</span>
            <strong>{selectedElection.name}</strong>
            <small>{offices.length} مكتبًا</small>
          </div>
        </section>

        <section className="polling-offices-index-kpis" aria-label="حالة المحاضر">
          <article>
            <span>إجمالي المكاتب</span>
            <strong>{offices.length}</strong>
          </article>
          <article>
            <span>لم يُدخل محضرها</span>
            <strong>{missing}</strong>
          </article>
          <article>
            <span>بدأ إدخال المحضر</span>
            <strong>{entered}</strong>
          </article>
          <article>
            <span>محاضر معتمدة</span>
            <strong>{verified}</strong>
          </article>
        </section>

        <form className="polling-offices-index-filters" method="GET">
          <label>
            <span>الاستحقاق</span>
            <select name="election" defaultValue={selectedElection.id}>
              {elections.map((election) => (
                <option value={election.id} key={election.id}>
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

          <label>
            <span>حالة المحضر</span>
            <select name="protocol" defaultValue={selectedProtocol}>
              <option value="">كل الحالات</option>
              <option value="missing">لم يُدخل</option>
              <option value="entered">بدأ الإدخال</option>
              <option value="verified">معتمد</option>
            </select>
          </label>

          <button type="submit">تطبيق</button>

          {(params.q || selectedArea || selectedProtocol) ? (
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
              {visible.map((office) => {
                const protocolState = office.protocol?.state ?? "missing";

                return (
                  <article className="polling-office-index-card" key={office.id}>
                    <div className="polling-office-index-number">
                      <span>مكتب</span>
                      <strong>{office.number}</strong>
                    </div>

                    <div className="polling-office-index-main">
                      <strong>{office.center.name}</strong>
                      <span>
                        {office.area?.name ??
                          office.center.commune ??
                          "المقاطعة غير محددة"}
                        {office.central_office
                          ? ` · المكتب المركزي ${office.central_office.number}`
                          : ""}
                      </span>
                      <small>
                        {office.constituency.name}
                        {office.registered_voters_known
                          ? ` · ${office.registered_voters ?? 0} مسجلًا`
                          : ""}
                      </small>
                    </div>

                    <div className="polling-office-index-representative">
                      <span>الموكل</span>
                      <strong>
                        {office.primary_representative?.name ?? "غير معيّن"}
                      </strong>
                    </div>

                    <span
                      className={`polling-office-index-protocol state-${protocolState}`}
                    >
                      {protocolLabel(office)}
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
                        {office.protocol ? "فتح المحضر" : "إدخال المحضر"}
                        <span aria-hidden="true">←</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function ElectionCandidacySetupPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { electionId } = await params;
  if (user.role !== "manager") {
    redirect(`/elections/${electionId}`);
  }

  const sessionId = await readElectSessionId();
  let setup;
  try {
    setup = await getElectionSetupSnapshot(electionId, sessionId);
  } catch {
    notFound();
  }

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">مركز العمليات</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}/setup`}>إعداد الاستحقاق</Link>
          <span>/</span>
          <strong>اللوائح والمرشحون</strong>
        </nav>

        <section className="setup-hero">
          <div>
            <div className="presentation-kicker">
              <span className="status-orb" aria-hidden="true" />
              بيانات الترشيحات
            </div>
            <h1>اللوائح والمرشحون</h1>
            <p>
              ضبط اللوائح بحسب الدائرة، وإدارة المرشحين وترتيب أعضاء كل
              لائحة، مع فصل هذه البيانات عن تشغيل يوم الاقتراع.
            </p>
          </div>
          <div className="setup-hero-actions">
            <Link
              className="setup-edit-link"
              href={`/elections/${electionId}/setup`}
            >
              العودة إلى الإعداد
            </Link>
          </div>
        </section>

        <div className="setup-summary-grid">
          <div>
            <span>اللوائح</span>
            <strong>{setup.candidate_lists.length}</strong>
            <small>لائحة مضبوطة</small>
          </div>
          <div>
            <span>المرشحون</span>
            <strong>{setup.candidates.length}</strong>
            <small>مرشح مسجل</small>
          </div>
          <div>
            <span>أعضاء اللوائح</span>
            <strong>{setup.list_members.length}</strong>
            <small>ترتيب مسجل</small>
          </div>
          <div>
            <span>الهيئات</span>
            <strong>{setup.parties.length}</strong>
            <small>هيئة مرتبطة</small>
          </div>
        </div>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>01 · اللوائح</span>
              <h2>اللوائح الانتخابية</h2>
              <p>ربط كل لائحة بدائرتها وبياناتها المرجعية والهيئة المرتبطة بها.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/candidacy/candidate-lists/new`}
            >
              + إضافة لائحة
            </Link>
          </div>

          {setup.candidate_lists.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>اللائحة</span>
                <span>الدائرة</span>
                <span>الأعضاء</span>
                <span />
              </div>
              {setup.candidate_lists.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-row-main setup-party-identity">
                    {item.party?.has_logo ? (
                      <img
                        className="setup-party-logo"
                        src={`/api/operations/parties/${item.party.id}/logo`}
                        alt={`شعار ${item.party.name}`}
                        loading="lazy"
                      />
                    ) : null}
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.party?.short_name ||
                          item.party?.name ||
                          "بدون هيئة محددة"}
                        {item.party?.symbol_name
                          ? ` · ${item.party.symbol_name}`
                          : ""}
                        {item.ballot_number !== null &&
                        item.ballot_number !== undefined
                          ? ` · رقم ${item.ballot_number}`
                          : ""}
                      </small>
                    </span>
                  </div>
                  <div className="setup-row-main">
                    <strong>{item.constituency.name}</strong>
                    <small>
                      {item.constituency.kind === "local" ? "محلية" : "جهوية"}
                    </small>
                  </div>
                  <span>{item.member_count}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/candidacy/candidate-lists/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">لم تتم إضافة أي لائحة بعد.</div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>02 · المرشحون</span>
              <h2>سجل المرشحين</h2>
              <p>سجل موحد للمرشحين يمكن ربطه بترتيب أعضاء اللوائح.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/candidacy/candidates/new`}
            >
              + إضافة مرشح
            </Link>
          </div>

          {setup.candidates.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>المرشح</span>
                <span>تاريخ الميلاد</span>
                <span>العضويات</span>
                <span />
              </div>
              {setup.candidates.map((item) => {
                const membershipCount = setup.list_members.filter(
                  (member) => member.candidate.id === item.id,
                ).length;

                return (
                  <div className="setup-row" key={item.id}>
                    <strong>{item.name}</strong>
                    <span>{item.birth_date || "—"}</span>
                    <span>{membershipCount}</span>
                    <Link
                      className="setup-edit-link"
                      href={`/elections/${electionId}/setup/candidacy/candidates/${item.id}/edit`}
                    >
                      تعديل
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="setup-empty">لا يوجد مرشحون بعد.</div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>03 · الترتيب</span>
              <h2>تكوين اللوائح</h2>
              <p>ربط المرشحين باللوائح وتحديد ترتيب كل مرشح داخل لائحته.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/candidacy/list-members/new`}
            >
              + إضافة عضو
            </Link>
          </div>

          {setup.list_members.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>اللائحة</span>
                <span>الترتيب</span>
                <span>المرشح</span>
                <span />
              </div>
              {setup.list_members.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-row-main">
                    <strong>{item.candidate_list.name}</strong>
                    <small>{item.candidate_list.code}</small>
                  </div>
                  <strong>{item.sequence}</strong>
                  <span>{item.candidate.name}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/candidacy/list-members/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              لم يتم تكوين أعضاء أي لائحة بعد.
            </div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>04 · بيانات مساعدة</span>
              <h2>الهيئات والأحزاب</h2>
              <p>سجل مرجعي اختياري لربط كل لائحة بالهيئة التي تمثلها.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/candidacy/parties/new`}
            >
              + إضافة هيئة
            </Link>
          </div>

          {setup.parties.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>الاسم</span>
                <span>الاختصار</span>
                <span>الرمز الانتخابي</span>
                <span />
              </div>
              {setup.parties.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-party-identity">
                    {item.has_logo ? (
                      <img
                        className="setup-party-logo"
                        src={`/api/operations/parties/${item.id}/logo`}
                        alt={`شعار ${item.name}`}
                        loading="lazy"
                      />
                    ) : null}
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.code}</small>
                    </span>
                  </div>
                  <span>{item.short_name || "—"}</span>
                  <span>{item.symbol_name || "—"}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/candidacy/parties/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">لا توجد هيئات مرتبطة بعد.</div>
          )}
        </section>

        <div className="setup-note">
          لا يوجد حذف نهائي في هذه المرحلة. الإنشاء والتعديل فقط، مع الحفاظ
          على العلاقات التي يعتمد عليها إدخال النتائج والحسابات اللاحقة.
        </div>
      </section>
    </main>
  );
}

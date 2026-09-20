import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/navigation/app-header";
import { getElectionSetupSnapshot } from "@/lib/server/election-setup";
import {
  getCurrentUser,
  readElectSessionId,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

const roleNames: Record<string, string> = {
  primary: "موكل أساسي",
  backup: "موكل احتياطي",
  coordinator: "منسق مركز",
};

const statusNames: Record<string, string> = {
  planned: "مخطط",
  notified: "تم الإشعار",
  confirmed: "مؤكد",
  present: "حاضر",
  absent: "غائب",
  replaced: "تم الاستبدال",
  cancelled: "ملغى",
  closed: "مغلق",
};

const stateNames: Record<string, string> = {
  draft: "مسودة",
  setup: "مرحلة الإعداد",
  ready: "جاهز",
  polling: "يوم الاقتراع",
  counting: "الفرز والتجميع",
  closed: "مغلق",
};

export default async function ElectionSetupPage({
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

  const localCount = setup.constituencies.filter(
    (item) => item.kind === "local",
  ).length;

  return (
    <main className="dashboard-shell presentation-dashboard">
      <AppHeader user={user} />
      <section className="dashboard-content presentation-content">
        <nav className="breadcrumbs presentation-breadcrumbs">
          <Link href="/dashboard">مركز العمليات</Link>
          <span>/</span>
          <Link href={`/elections/${electionId}`}>
            {setup.election.name}
          </Link>
          <span>/</span>
          <strong>إعداد الاستحقاق</strong>
        </nav>

        <section className="setup-hero">
          <div>
            <div className="presentation-kicker">
              <span className="status-orb" aria-hidden="true" />
              مساحة الإدارة
            </div>
            <h1>إعداد الاستحقاق</h1>
            <p>
              إدارة الهيكلة الميدانية من الدوائر إلى المكاتب والموكلين، مع
              إبقاء العمليات اليومية والمحاضر في مساراتها التشغيلية المستقلة.
            </p>
          </div>
          <div className="setup-hero-actions">
            <span className="state-pill presentation-state">
              {stateNames[setup.election.state] ?? setup.election.state}
            </span>
            <Link
              className="setup-edit-link"
              href={`/elections/${electionId}/setup/election/edit`}
            >
              تعديل بيانات الاستحقاق
            </Link>
          </div>
        </section>

        <div className="setup-summary-grid">
          <div>
            <span>الدوائر المحلية</span>
            <strong>{localCount}</strong>
            <small>جاهزة للربط بالمراكز</small>
          </div>
          <div>
            <span>مراكز التصويت</span>
            <strong>{setup.centers.length}</strong>
            <small>مركز محمل</small>
          </div>
          <div>
            <span>مكاتب التصويت</span>
            <strong>{setup.offices.length}</strong>
            <small>مكتب محمل</small>
          </div>
          <div>
            <span>الموكلون</span>
            <strong>{setup.representatives.length}</strong>
            <small>شخص مسجل</small>
          </div>
          <div>
            <span>التعيينات</span>
            <strong>{setup.assignments.length}</strong>
            <small>ربط ميداني</small>
          </div>
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
        </div>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>01 · الهيكلة</span>
              <h2>الدوائر الانتخابية</h2>
              <p>إضافة الدوائر وتعديل أسمائها ومقاعدها وربطها بالجهة.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/constituencies/new`}
            >
              + إضافة دائرة
            </Link>
          </div>

          {setup.constituencies.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>الدائرة</span>
                <span>النوع</span>
                <span>المقاعد</span>
                <span />
              </div>
              {setup.constituencies.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-row-main">
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </div>
                  <span>{item.kind === "local" ? "محلية" : "جهوية"}</span>
                  <span>{item.seat_count}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/constituencies/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">لا توجد دوائر بعد.</div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>02 · الميدان</span>
              <h2>مراكز التصويت</h2>
              <p>ربط كل مركز بدائرته المحلية وتثبيت الجماعة والعنوان.</p>
            </div>
            <div className="setup-hero-actions">
              <Link
                className="setup-edit-link"
                href={`/elections/${electionId}/setup/polling-import`}
              >
                استيراد المراكز والمكاتب
              </Link>
              <Link
                className="setup-create-button"
                href={`/elections/${electionId}/setup/centers/new`}
              >
                + إضافة مركز
              </Link>
            </div>
          </div>

          {setup.centers.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>المركز</span>
                <span>الدائرة</span>
                <span>المكاتب</span>
                <span />
              </div>
              {setup.centers.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-row-main">
                    <strong>{item.name}</strong>
                    <small>
                      {item.commune || "الجماعة غير محددة"}
                      {item.code ? ` · ${item.code}` : ""}
                    </small>
                  </div>
                  <span>{item.constituency.name}</span>
                  <span>{item.office_count}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/centers/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              لم يتم تحميل مراكز التصويت بعد.
            </div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>03 · الميدان</span>
              <h2>مكاتب التصويت</h2>
              <p>إنشاء المكاتب داخل المراكز وإدارة أرقامها وعدد المسجلين.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/offices/new`}
            >
              + إضافة مكتب
            </Link>
          </div>

          {setup.offices.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--offices setup-row--header">
                <span>الرقم</span>
                <span>المركز</span>
                <span>الدائرة</span>
                <span>المسجلون</span>
                <span />
              </div>
              {setup.offices.map((item) => (
                <div className="setup-row setup-row--offices" key={item.id}>
                  <strong>مكتب {item.number}</strong>
                  <div className="setup-row-main">
                    <strong>{item.center.name}</strong>
                    <small>{item.code}</small>
                  </div>
                  <span>{item.constituency.name}</span>
                  <span>{item.registered_voters || "—"}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/offices/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              لم يتم تحميل مكاتب التصويت بعد.
            </div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>04 · الفريق</span>
              <h2>الموكلون والمنسقون</h2>
              <p>إدارة بيانات الأشخاص الذين سيغطون البنية الميدانية.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/representatives/new`}
            >
              + إضافة شخص
            </Link>
          </div>

          {setup.representatives.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--header">
                <span>الاسم</span>
                <span>الهاتف</span>
                <span>الحساب</span>
                <span />
              </div>
              {setup.representatives.map((item) => (
                <div className="setup-row" key={item.id}>
                  <div className="setup-row-main">
                    <strong>{item.name}</strong>
                    <small>{item.email || "بدون بريد إلكتروني"}</small>
                  </div>
                  <span>{item.phone || "—"}</span>
                  <span>{item.has_user_account ? "مرتبط" : "غير مرتبط"}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/representatives/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">لا يوجد موكلون أو منسقون بعد.</div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>05 · التغطية</span>
              <h2>التعيينات الميدانية</h2>
              <p>ربط كل موكل بالمكتب ودوره وحالة تأكيد التعيين.</p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/assignments/new`}
            >
              + إضافة تعيين
            </Link>
          </div>

          {setup.assignments.length ? (
            <div className="setup-table">
              <div className="setup-row setup-row--assignments setup-row--header">
                <span>المكتب</span>
                <span>الشخص</span>
                <span>الدور</span>
                <span>الحالة</span>
                <span />
              </div>
              {setup.assignments.map((item) => (
                <div className="setup-row setup-row--assignments" key={item.id}>
                  <div className="setup-row-main">
                    <strong>
                      مكتب {item.office.number} · {item.office.center_name}
                    </strong>
                    <small>{item.office.code}</small>
                  </div>
                  <div className="setup-row-main">
                    <strong>{item.representative.name}</strong>
                    <small>{item.representative.phone || "بدون هاتف"}</small>
                  </div>
                  <span>{roleNames[item.role] ?? item.role}</span>
                  <span>{statusNames[item.status] ?? item.status}</span>
                  <Link
                    className="setup-edit-link"
                    href={`/elections/${electionId}/setup/assignments/${item.id}/edit`}
                  >
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              لا توجد تعيينات بعد. أنشئ المكاتب والأشخاص أولًا.
            </div>
          )}
        </section>

        <section className="setup-management-section">
          <div className="setup-section-heading">
            <div>
              <span>06 · الترشيحات</span>
              <h2>اللوائح والمرشحون</h2>
              <p>
                إدارة اللوائح داخل الدوائر، والمرشحين، وترتيب أعضاء كل لائحة،
                والهيئات المرتبطة بها.
              </p>
            </div>
            <Link
              className="setup-create-button"
              href={`/elections/${electionId}/setup/candidacy`}
            >
              إدارة الترشيحات
            </Link>
          </div>

          <div className="setup-table">
            <div className="setup-row setup-row--header">
              <span>اللوائح</span>
              <span>المرشحون</span>
              <span>أعضاء اللوائح</span>
              <span>الهيئات</span>
            </div>
            <div className="setup-row">
              <strong>{setup.candidate_lists.length}</strong>
              <strong>{setup.candidates.length}</strong>
              <strong>{setup.list_members.length}</strong>
              <strong>{setup.parties.length}</strong>
            </div>
          </div>
        </section>

        <div className="setup-note">
          هذه المرحلة لا توفر حذفًا نهائيًا للسجلات. الإنشاء والتعديل فقط،
          حفاظًا على سلامة العلاقات قبل تشغيل المحاضر والنتائج.
        </div>
      </section>
    </main>
  );
}

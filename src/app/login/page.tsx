import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/branding/brand-logo";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="pjd-auth-shell">
      <section className="pjd-auth-visual" aria-label="هوية مركز العمليات">
        <div className="pjd-auth-grid" aria-hidden="true" />
        <div className="pjd-auth-glow pjd-auth-glow--one" aria-hidden="true" />
        <div className="pjd-auth-glow pjd-auth-glow--two" aria-hidden="true" />
        <div className="pjd-auth-orange-cut" aria-hidden="true" />

        <header className="pjd-auth-brand">
          <span className="pjd-auth-logo-wrap">
            <BrandLogo priority />
          </span>
          <div>
            <strong>Geniura Elect</strong>
            <span>Election Operations</span>
          </div>
        </header>

        <div className="pjd-auth-visual-content">
          <span className="pjd-auth-party-chip">
            PJD · جهة طنجة–تطوان–الحسيمة
          </span>

          <p className="pjd-auth-kicker">مركز القيادة الميدانية</p>

          <h1>
            العمليات الانتخابية
            <span>في واجهة واحدة.</span>
          </h1>

          <p className="pjd-auth-description">
            متابعة التغطية، المراكز والمكاتب، المحاضر والنتائج من مساحة عمل
            موحدة ومؤمّنة لفريق العمليات.
          </p>

          <div className="pjd-auth-capabilities" aria-label="وظائف المنصة">
            <div>
              <span>01</span>
              <strong>التغطية الميدانية</strong>
              <small>الموكلون · المراكز · المكاتب</small>
            </div>
            <div>
              <span>02</span>
              <strong>المحاضر</strong>
              <small>الإدخال · التحقق · الأثر</small>
            </div>
            <div>
              <span>03</span>
              <strong>النتائج</strong>
              <small>التجميع · الاكتمال · المتابعة</small>
            </div>
          </div>
        </div>

        <footer className="pjd-auth-visual-footer">
          <span className="pjd-auth-status-dot" aria-hidden="true" />
          <span>Geniura Elect · Operations Console</span>
        </footer>
      </section>

      <section className="pjd-auth-panel">
        <div className="pjd-auth-mobile-brand">
          <BrandLogo priority />
          <div>
            <strong>Geniura Elect</strong>
            <span>مركز العمليات الانتخابية</span>
          </div>
        </div>

        <div className="pjd-auth-form-wrap">
          <div className="pjd-auth-form-heading">
            <span className="pjd-auth-form-mark" aria-hidden="true">
              <span />
            </span>
            <p>ولوج فريق العمليات</p>
            <h2>تسجيل الدخول</h2>
            <span>
              استخدم بيانات حسابك للوصول إلى مساحة العمل المخصصة لك.
            </span>
          </div>

          <LoginForm />

          <div className="pjd-auth-security-note">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z" />
              <path d="m9.5 12 1.6 1.6 3.7-3.8" />
            </svg>
            <span>اتصال آمن · الجلسة محمية ومخصصة لفريق العمليات فقط</span>
          </div>
        </div>

        <footer className="pjd-auth-panel-footer">
          <span>Geniura Elect</span>
          <span>2026</span>
        </footer>
      </section>
    </main>
  );
}

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
      <section className="pjd-auth-visual" aria-label="حزب العدالة والتنمية">
        <div className="pjd-auth-grid" aria-hidden="true" />
        <div className="pjd-auth-glow pjd-auth-glow--one" aria-hidden="true" />
        <div className="pjd-auth-glow pjd-auth-glow--two" aria-hidden="true" />
        <div className="pjd-auth-orange-cut" aria-hidden="true" />

        <div className="pjd-auth-identity">
          <span className="pjd-auth-emblem">
            <BrandLogo priority />
          </span>
          <h1>حزب العدالة والتنمية</h1>
          <span className="pjd-auth-region">جهة طنجة–تطوان–الحسيمة</span>
        </div>
      </section>

      <section className="pjd-auth-panel">
        <div className="pjd-auth-form-wrap">
          <div className="pjd-auth-form-logo">
            <BrandLogo priority />
          </div>

          <div className="pjd-auth-form-heading">
            <span className="pjd-auth-form-mark" aria-hidden="true">
              <span />
            </span>
            <h2>تسجيل الدخول</h2>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}

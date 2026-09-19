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
    <main className="auth-shell">
      <div className="auth-scene" aria-hidden="true">
        <span className="auth-scene-core" />
      </div>

      <section className="auth-panel">
        <div className="auth-panel-top">
          <BrandLogo priority />
          <span className="auth-brand-name">مركز العمليات</span>
        </div>

        <div className="auth-heading">
          <h1 className="auth-title">تسجيل الدخول</h1>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

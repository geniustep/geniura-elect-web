import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark" aria-hidden="true">
          G
        </div>
        <p className="eyebrow">GENIURA ELECT</p>
        <h1 className="auth-title">الدخول إلى مركز العمليات</h1>
        <p className="auth-copy">
          استخدم حسابك المخصص للوصول إلى نطاق العمل الانتخابي المخول لك.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

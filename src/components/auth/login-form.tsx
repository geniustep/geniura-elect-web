"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const login = String(form.get("login") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login, password }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setError(payload?.error?.message ?? "تعذر تسجيل الدخول.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة. حاول مرة أخرى.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label>
        <span>اسم الدخول</span>
        <input
          name="login"
          autoComplete="username"
          required
          dir="ltr"
          disabled={pending}
        />
      </label>

      <label>
        <span>كلمة المرور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          disabled={pending}
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "جارٍ الدخول..." : "دخول"}
      </button>
    </form>
  );
}

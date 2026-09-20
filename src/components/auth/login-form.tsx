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
    <form className="pjd-login-form" onSubmit={onSubmit}>
      <label className="pjd-login-field">
        <span className="pjd-login-label">اسم الدخول</span>
        <div className="pjd-login-control">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            name="login"
            autoComplete="username"
            placeholder="اسم المستخدم"
            required
            dir="ltr"
            disabled={pending}
          />
        </div>
      </label>

      <label className="pjd-login-field">
        <span className="pjd-login-label">كلمة المرور</span>
        <div className="pjd-login-control">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            dir="ltr"
            disabled={pending}
          />
        </div>
      </label>

      {error ? (
        <div className="pjd-login-error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      ) : null}

      <button className="pjd-login-submit" type="submit" disabled={pending}>
        <span>{pending ? "جارٍ الدخول..." : "دخول"}</span>
        {pending ? (
          <span className="pjd-login-loader" aria-hidden="true" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        )}
      </button>
    </form>
  );
}

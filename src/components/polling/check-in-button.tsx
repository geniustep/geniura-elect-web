"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckInButton({ officeId }: { officeId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkIn() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/operations/polling-offices/${officeId}/check-in`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload?.error?.message ?? "تعذر تسجيل الحضور.");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-action">
      <button
        className="primary-button"
        type="button"
        onClick={checkIn}
        disabled={pending}
      >
        {pending ? "جارٍ التسجيل..." : "تأكيد الحضور في المكتب"}
      </button>
      {error ? <small className="inline-error">{error}</small> : null}
    </div>
  );
}

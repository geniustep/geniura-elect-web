"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/session/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      className="ghost-button"
      type="button"
      onClick={logout}
      disabled={pending}
    >
      {pending ? "..." : "تسجيل الخروج"}
    </button>
  );
}

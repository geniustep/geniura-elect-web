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
      className="ghost-button logout-button"
      type="button"
      onClick={logout}
      disabled={pending}
    >
      <span>{pending ? "..." : "خروج"}</span>
      {!pending ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        </svg>
      ) : null}
    </button>
  );
}

import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandLogo } from "@/components/branding/brand-logo";
import type { ElectUser } from "@/lib/server/session";

const roleNames = {
  observer: "موكل",
  coordinator: "منسق",
  manager: "مدير العمليات",
} as const;

export function AppHeader({ user }: { user: ElectUser }) {
  const initial = user.name.trim().slice(0, 1) || "م";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link
          className="brand-link"
          href="/dashboard"
          aria-label="العودة إلى لوحة العمليات"
        >
          <BrandLogo compact />
          <strong>مركز العمليات</strong>
        </Link>

        <div className="topbar-actions">
          <div className="user-chip">
            <span className="user-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="user-meta">
              <strong>{user.name}</strong>
              <small>{roleNames[user.role]}</small>
            </span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

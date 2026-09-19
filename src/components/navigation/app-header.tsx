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
    <header className="topbar presentation-topbar">
      <div className="topbar-inner presentation-topbar-inner">
        <Link
          className="brand-link presentation-brand-link"
          href="/dashboard"
          aria-label="العودة إلى مركز العمليات الانتخابية"
        >
          <BrandLogo compact />
          <span className="presentation-brand-copy">
            <small>GENIURA ELECT</small>
            <strong>مركز العمليات الانتخابية</strong>
          </span>
        </Link>

        <div className="topbar-actions presentation-topbar-actions">
          <div className="presentation-org-chip">
            <small>التنظيم</small>
            <strong>{user.organization.name}</strong>
          </div>

          <div className="user-chip presentation-user-chip">
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

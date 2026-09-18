import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import type { ElectUser } from "@/lib/server/session";

const roleNames = {
  observer: "موكل",
  coordinator: "منسق",
  manager: "إدارة العمليات",
} as const;

export function AppHeader({ user }: { user: ElectUser }) {
  return (
    <header className="topbar">
      <Link className="brand-link" href="/dashboard">
        <span className="mini-brand" aria-hidden="true">
          G
        </span>
        <span>
          <small>GENIURA ELECT</small>
          <strong>مركز العمليات</strong>
        </span>
      </Link>
      <div className="topbar-actions">
        <div className="user-chip">
          <span>{user.name}</span>
          <small>{roleNames[user.role]}</small>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}

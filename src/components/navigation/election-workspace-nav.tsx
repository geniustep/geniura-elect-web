"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ElectRole = "observer" | "coordinator" | "manager";
type NavIconName = "overview" | "command" | "results" | "setup" | "users" | "back";

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    );
  }

  if (name === "command") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12h4l2.2-5 4.1 10 2.2-5H21" />
      </svg>
    );
  }

  if (name === "results") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 20V11" />
        <path d="M12 20V4" />
        <path d="M19 20v-6" />
      </svg>
    );
  }

  if (name === "setup") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10" />
        <path d="M18 7h2" />
        <circle cx="16" cy="7" r="2" />
        <path d="M4 17h2" />
        <path d="M10 17h10" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3 2.5-5 5.5-5s4.9 2 5.5 5" />
        <circle cx="17.5" cy="9" r="2.2" />
        <path d="M15.5 14.5c2.8-.6 4.8.9 5.3 3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

export function ElectionWorkspaceNav({ role }: { role: ElectRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const match = pathname.match(/^\/elections\/([^/]+)/);
  const electionId = match?.[1] ?? null;
  const workspaceEnabled = Boolean(electionId) && role !== "observer";

  useEffect(() => {
    // Mount detection is intentionally driven by an effect to avoid SSR-only rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // Closing the mobile workspace after route changes is intentional UI synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!workspaceEnabled) return;

    document.body.classList.add("has-election-workspace");
    return () => {
      document.body.classList.remove("has-election-workspace");
    };
  }, [workspaceEnabled]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!workspaceEnabled || !electionId) {
    return null;
  }

  const base = `/elections/${electionId}`;
  const isUsers = pathname.startsWith(`${base}/setup/users`);

  const primaryItems: Array<{
    label: string;
    description: string;
    href: string;
    icon: NavIconName;
    active: boolean;
  }> = [
    {
      label: "نظرة عامة",
      description: "الدوائر والتغطية",
      href: base,
      icon: "overview",
      active:
        pathname === base ||
        pathname.startsWith(`${base}/constituencies/`),
    },
    {
      label: "غرفة القيادة",
      description: "المتابعة التشغيلية",
      href: `${base}/command-center`,
      icon: "command",
      active: pathname.startsWith(`${base}/command-center`),
    },
    {
      label: "النتائج",
      description: "المحاضر والتجميع",
      href: `${base}/results`,
      icon: "results",
      active: pathname.startsWith(`${base}/results`),
    },
  ];

  const adminItems =
    role === "manager"
      ? [
          {
            label: "الإعداد",
            description: "الهيكلة والبيانات",
            href: `${base}/setup`,
            icon: "setup" as NavIconName,
            active: pathname.startsWith(`${base}/setup`) && !isUsers,
          },
          {
            label: "المستخدمون",
            description: "النطاق والصلاحيات",
            href: `${base}/setup/users`,
            icon: "users" as NavIconName,
            active: isUsers,
          },
        ]
      : [];

  const renderItems = (items: typeof primaryItems) =>
    items.map((item) => (
      <Link
        className={item.active ? "is-active" : undefined}
        href={item.href}
        aria-current={item.active ? "page" : undefined}
        key={item.href}
        onClick={() => setOpen(false)}
      >
        <span className="election-workspace-icon">
          <NavIcon name={item.icon} />
        </span>
        <span className="election-workspace-link-copy">
          <strong>{item.label}</strong>
          <small>{item.description}</small>
        </span>
        <span className="election-workspace-arrow" aria-hidden="true">
          ←
        </span>
      </Link>
    ));

  const renderNav = () => (
    <>
      <div className="election-workspace-head">
        <div className="election-workspace-mark" aria-hidden="true">
          <span>#{electionId}</span>
        </div>
        <div className="election-workspace-head-copy">
          <span className="election-workspace-eyebrow">الاستحقاق الحالي</span>
          <strong>مركز الاستحقاق</strong>
          <small>تنقل سريع بين مساحات العمل</small>
        </div>
      </div>

      <div className="election-workspace-section-label">التشغيل</div>
      <nav className="election-workspace-links" aria-label="التنقل داخل الاستحقاق">
        {renderItems(primaryItems)}
      </nav>

      {adminItems.length ? (
        <>
          <div className="election-workspace-section-label election-workspace-section-label--admin">
            الإدارة
          </div>
          <nav
            className="election-workspace-links election-workspace-links--admin"
            aria-label="إدارة الاستحقاق"
          >
            {renderItems(adminItems)}
          </nav>
        </>
      ) : null}

      <Link
        className="election-workspace-back"
        href="/dashboard"
        onClick={() => setOpen(false)}
      >
        <NavIcon name="back" />
        <span>كل الاستحقاقات</span>
      </Link>
    </>
  );

  const workspaceLayer =
    mounted &&
    createPortal(
      <>
        <aside className="election-workspace-sidebar">{renderNav()}</aside>

        <button
          className={`election-workspace-overlay${open ? " is-open" : ""}`}
          type="button"
          aria-label="إغلاق قائمة الاستحقاق"
          onClick={() => setOpen(false)}
        />

        <aside
          className={`election-workspace-drawer${open ? " is-open" : ""}`}
          aria-hidden={!open}
        >
          <div className="election-workspace-drawer-top">
            <span>مساحة الاستحقاق</span>
            <button
              type="button"
              aria-label="إغلاق القائمة"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {renderNav()}
        </aside>
      </>,
      document.body,
    );

  return (
    <>
      <button
        className="election-workspace-mobile-trigger"
        type="button"
        aria-label="فتح قائمة الاستحقاق"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="election-workspace-mobile-trigger-icon" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>القائمة</span>
      </button>
      {workspaceLayer}
    </>
  );
}

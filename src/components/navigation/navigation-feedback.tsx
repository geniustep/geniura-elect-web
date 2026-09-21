"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const FAILSAFE_MS = 12000;

export function NavigationFeedback() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  const stopPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (activeLinkRef.current) {
      activeLinkRef.current.classList.remove("is-navigation-pending");
      activeLinkRef.current.removeAttribute("aria-busy");
      activeLinkRef.current = null;
    }

    document.body.classList.remove("is-route-pending");
    setPending(false);
  }, []);

  const startPending = useCallback(
    (link: HTMLAnchorElement) => {
      if (activeLinkRef.current && activeLinkRef.current !== link) {
        activeLinkRef.current.classList.remove("is-navigation-pending");
        activeLinkRef.current.removeAttribute("aria-busy");
      }

      activeLinkRef.current = link;
      link.classList.add("is-navigation-pending");
      link.setAttribute("aria-busy", "true");
      document.body.classList.add("is-route-pending");
      setPending(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(stopPending, FAILSAFE_MS);
    },
    [stopPending],
  );

  useEffect(() => {
    stopPending();
  }, [pathname, stopPending]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const samePathAndQuery =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search;

      if (
        samePathAndQuery &&
        (nextUrl.hash === currentUrl.hash || Boolean(nextUrl.hash))
      ) {
        return;
      }

      startPending(link);
    };

    const handlePopState = () => {
      document.body.classList.add("is-route-pending");
      setPending(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(stopPending, FAILSAFE_MS);
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      stopPending();
    };
  }, [startPending, stopPending]);

  return (
    <div
      className={`route-feedback${pending ? " is-visible" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="route-feedback-bar" aria-hidden="true">
        <span />
      </div>
      <div className="route-feedback-pill" role="status">
        <span className="route-feedback-spinner" aria-hidden="true" />
        <span>جاري فتح الصفحة…</span>
      </div>
    </div>
  );
}

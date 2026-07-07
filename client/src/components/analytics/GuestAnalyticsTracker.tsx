"use client";

import {
    flushGuestEvents,
    getGuestId,
    isGuest,
    trackGuest,
} from "@/modules/analytics/guestTracking";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

function readUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value.slice(0, 100);
  }
  return utm;
}

/** Short, non-identifying label for a clicked element. */
function labelFor(el: Element): string {
  const tracked = el.getAttribute("data-track");
  if (tracked) return tracked.slice(0, 80);
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 80);
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 80) || el.tagName.toLowerCase();
}

/**
 * Mounts anonymous activity listeners (page views, clicks, scroll depth,
 * time-on-page) for not-signed-in visitors. Renders nothing.
 */
export function GuestAnalyticsTracker() {
  const pathname = usePathname();
  const currentPath = useRef<string>("");
  const pageStart = useRef<number>(0);
  const maxScroll = useRef<number>(0);

  const recordExit = useCallback(() => {
    if (!currentPath.current) return;
    const durationMs = pageStart.current ? Date.now() - pageStart.current : 0;
    trackGuest({
      eventName: "page_exit",
      entityType: "PAGE",
      entityId: currentPath.current,
      metadata: { durationMs, scrollDepthPct: maxScroll.current },
    });
  }, []);

  // Page view on first load and every route change.
  useEffect(() => {
    if (!isGuest()) return;

    // Close out the previous page before recording the new one.
    recordExit();

    currentPath.current = pathname;
    pageStart.current = Date.now();
    maxScroll.current = 0;

    const utm = readUtm(window.location.search);
    trackGuest({
      eventName: "page_view",
      entityType: "PAGE",
      entityId: pathname,
      metadata: {
        ...(document.referrer
          ? { referrer: document.referrer.slice(0, 200) }
          : {}),
        ...(Object.keys(utm).length ? { utm } : {}),
        ...(document.title ? { title: document.title.slice(0, 120) } : {}),
      },
    });
  }, [pathname, recordExit]);

  // Scroll depth, clicks, and unload handling (mounted once).
  useEffect(() => {
    if (!isGuest()) return;
    getGuestId();

    const onScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        scrollable > 0
          ? Math.min(100, Math.round((window.scrollY / scrollable) * 100))
          : 100;
      if (pct > maxScroll.current) maxScroll.current = pct;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest("a, button, [data-track]");
      if (!el) return;
      const href = el.getAttribute("href");
      trackGuest({
        eventName: "click",
        entityType: "CLICK",
        entityId: labelFor(el),
        metadata: {
          path: currentPath.current,
          ...(href ? { href: href.slice(0, 200) } : {}),
        },
      });
    };

    const onHide = () => {
      recordExit();
      flushGuestEvents(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [recordExit]);

  return null;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getMainAppUrl } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import { communityService } from "@/modules/community/services/community";
import { getCommunitySocket } from "@/lib/realtime/socket";
import {
  Bell,
  Menu,
  MessageSquare,
  Shield,
  FileWarning,
  House,
  Trophy,
  UserX,
  ExternalLink,
  ChevronDown,
  MessagesSquare,
  Heart,
  Compass,
  Newspaper,
} from "lucide-react";

// ─── Additional Settings dropdown items ────────────────────────────────────
/** The "More" menu. Following lives here rather than in the main bar, which is
 *  already carrying seven items — but it has to be somewhere on desktop: it was
 *  only in the mobile drawer, so /following was unreachable on a large screen. */
const SETTINGS_ITEMS = [
  { href: "/following", icon: Heart, label: "Following" },
  { href: "/reports", icon: FileWarning, label: "Reports" },
  { href: "/safety", icon: UserX, label: "Safety" },
  { href: "/privacy", icon: Shield, label: "Privacy" },
];

export default function CommunityTopNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const isMounted = typeof document !== "undefined";
  const settingsRef = useRef<HTMLDivElement>(null);

  // ── load / refresh unread badge ──────────────────────────────────────────
  // This nav renders on every page, including public ones (blog/Q&A posts,
  // writer profiles, home) — these two counts are personal, so skip them
  // entirely for guests rather than let a 401 trip the global axios
  // interceptor and bounce a guest reader to login.
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!hasAuthToken()) {
        setUnreadCount(0);
        return;
      }
      try {
        const count = await communityService.getCommunityUnreadNotificationCount();
        setUnreadCount(count);
      } catch {
        setUnreadCount(0);
      }
    };

    const loadUnreadChatsCount = async () => {
      if (!hasAuthToken()) {
        setUnreadChatsCount(0);
        return;
      }
      try {
        const count = await communityService.getUnreadConversationCount();
        setUnreadChatsCount(count);
      } catch {
        setUnreadChatsCount(0);
      }
    };

    void loadUnreadCount();
    void loadUnreadChatsCount();

    const socket = getCommunitySocket();
    const handleNewNotification = () => {
      void communityService.clearNotificationCache();
      void loadUnreadCount();
    };
    const handleChatsChanged = () => {
      void loadUnreadChatsCount();
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("community:newMessage", handleChatsChanged);
    socket.on("community:messagesRead", handleChatsChanged);
    if (!socket.connected) socket.connect();

    // Also update badge when notifications are marked read locally
    const handleLocalRead = () => {
      void loadUnreadCount();
    };
    window.addEventListener("community:notificationsRead", handleLocalRead);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("community:newMessage", handleChatsChanged);
      socket.off("community:messagesRead", handleChatsChanged);
      window.removeEventListener("community:notificationsRead", handleLocalRead);
    };
  }, []);

  // ── close settings dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isSettingsOpen]);

  // ── hide on join pages ────────────────────────────────────────────────────
  if (pathname.startsWith("/join/")) return null;

  const isSettingsActive = SETTINGS_ITEMS.some((item) => pathname.startsWith(item.href));

  // ── primary nav-link style helper (center) ───────────────────────────────
  const navLinkCls = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 xl:px-3 ${
      active
        ? "text-power-orange-solid bg-paper-deep"
        : "text-ink-body hover:bg-paper-deep hover:text-ink"
    }`;

  return (
    <header className="z-120 border-hairline bg-paper/90 sticky top-0 border-b">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-2 lg:gap-3">
          {/* Left section: Back button & Logo */}
          <div className="flex flex-shrink-0 items-center">
            {/* ── Logo ──────────────────────────────────────────────────────── */}
            {/* Goes to the main site's home, not this app's own "/" — that
             * destination is a separate app/origin, so a plain anchor is used
             * rather than next/link's same-app client-side Link. */}
            <a
              href={getMainAppUrl()}
              className="inline-flex h-full flex-col items-start justify-center"
            >
              <span className="font-editorial text-[27px] font-medium leading-none">
                <span className="text-ink">Power</span>
                <span className="text-power-orange">My</span>
                <span className="text-ink">Sport</span>
              </span>
              <span className="text-ink-muted mt-1 text-xs font-medium leading-none">
                Community
              </span>
            </a>
          </div>

          {/* ── Desktop Center Nav ────────────────────────────────────────── */}
          <div className="hidden flex-1 items-center justify-center gap-0.5 lg:mx-1 lg:flex xl:mx-2">
            <Link href="/" className={navLinkCls(pathname === "/")}>
              <House size={16} />
              Home
            </Link>

            <Link href="/discover" className={navLinkCls(pathname.startsWith("/discover"))}>
              <Compass size={16} />
              Discover
            </Link>

            <Link
              href="/chats?sidebar=conversations"
              className={`relative ${navLinkCls(pathname.startsWith("/chats"))}`}
            >
              <MessagesSquare size={16} />
              Chats
              {unreadChatsCount > 0 && (
                <span className="bg-power-orange-solid ring-paper absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-semibold text-white ring-2">
                  {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                </span>
              )}
            </Link>

            <Link href="/experiences" className={navLinkCls(pathname.startsWith("/experiences"))}>
              <Newspaper size={16} />
              Experiences
            </Link>

            <Link href="/questions" className={navLinkCls(pathname.startsWith("/questions"))}>
              <MessageSquare size={16} />
              Questions
            </Link>
            <Link href="/contributors" className={navLinkCls(pathname.startsWith("/contributors"))}>
              <Trophy size={16} />
              Contributors
            </Link>
          </div>

          {/* ── Desktop Right Actions ─────────────────────────────────────── */}
          <div className="hidden flex-shrink-0 items-center justify-end gap-2 lg:flex xl:gap-3">
            {/* Notifications */}
            <Link
              href="/notifications"
              className="text-ink-body hover:bg-paper-deep hover:text-ink relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="bg-power-orange-solid ring-paper absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-semibold text-white ring-2">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Additional Settings dropdown */}
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className={`inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-200 xl:px-3 ${
                  isSettingsActive
                    ? "text-power-orange-solid bg-paper-deep"
                    : "text-ink-body hover:bg-paper-deep hover:text-ink"
                }`}
              >
                More
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isSettingsOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isSettingsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="border-hairline absolute right-0 top-[calc(100%+8px)] z-50 min-w-48 overflow-hidden rounded-xl border bg-white shadow-lg"
                  >
                    <div className="px-3 pb-1 pt-3">
                      <p className="text-ink-muted text-xs font-medium">Settings</p>
                    </div>
                    {SETTINGS_ITEMS.map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsSettingsOpen(false)}
                        className={`hover:bg-paper-deep flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                          pathname.startsWith(href) ? "text-power-orange-solid" : "text-ink-body"
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </Link>
                    ))}
                    <div className="h-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Mobile hamburger ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/notifications"
              className="text-ink-body hover:bg-paper-deep relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="bg-power-orange-solid ring-paper absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white ring-2">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="border-hairline text-ink hover:border-ink/40 inline-flex h-11 w-11 items-center justify-center rounded-lg border bg-white transition-colors duration-200"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer (portal) ────────────────────────────────────────── */}
      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-ink/40 fixed inset-0 lg:hidden"
                style={{ zIndex: 2147483000 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="border-hairline bg-paper absolute left-0 top-0 h-full w-[88vw] max-w-sm overflow-y-auto border-r p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-ink-muted text-sm font-medium">Navigate</p>
                      <h2 className="font-editorial text-ink mt-1 text-2xl font-light">
                        Community menu
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="border-hairline text-ink hover:border-ink/40 inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white transition-colors duration-200"
                      aria-label="Close navigation menu"
                    >
                      <span className="text-lg leading-none">×</span>
                    </button>
                  </div>

                  {/* Main App link — a different origin, hence a plain anchor
                   * rather than next/link's same-app Link (it was pointing at
                   * this app's own "/" and never actually leaving). */}
                  <div className="border-hairline mt-4 rounded-xl border bg-white p-3">
                    <a
                      href={getMainAppUrl()}
                      className="hover:bg-paper-deep flex items-center gap-3 rounded-lg px-3 py-3 transition-colors duration-200"
                    >
                      <span className="bg-paper-deep text-ink flex h-10 w-10 items-center justify-center rounded-lg">
                        <ExternalLink size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Main App</p>
                        <p className="text-xs text-slate-500">Return to main site</p>
                      </div>
                    </a>
                  </div>

                  {/* Primary nav items */}
                  <p className="text-ink-muted mb-2 mt-5 px-1 text-sm font-medium">Main</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: "/", icon: House, label: "Home" },
                      {
                        href: "/chats?sidebar=conversations",
                        icon: MessagesSquare,
                        label: "Chats",
                        badge: unreadChatsCount,
                      },
                      { href: "/discover", icon: Compass, label: "Discover" },
                      { href: "/experiences", icon: Newspaper, label: "Experiences" },
                      { href: "/questions", icon: MessageSquare, label: "Questions" },
                      {
                        href: "/contributors",
                        icon: Trophy,
                        label: "Contributors",
                      },
                      { href: "/following", icon: Heart, label: "Following" },
                    ].map(({ href, icon: Icon, label, badge }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                      >
                        <Icon size={15} />
                        {label}
                        {!!badge && badge > 0 && (
                          <span className="bg-power-orange-solid ring-paper absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-semibold text-white ring-2">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    ))}

                    {/* Notifications — full-width to accommodate badge */}
                    <Link
                      href="/notifications"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                    >
                      <Bell size={15} />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="bg-power-orange-solid inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/reports"
                      className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                    >
                      <FileWarning size={15} />
                      Reports
                    </Link>
                    <Link
                      href="/contributors"
                      className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                    >
                      <Trophy size={15} />
                      Contributors
                    </Link>

                    <Link
                      href="/safety"
                      className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                    >
                      <UserX size={15} />
                      Safety
                    </Link>
                    <Link
                      href="/privacy"
                      className="border-hairline text-ink-body hover:border-ink/40 hover:text-ink inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-medium transition-colors duration-200"
                    >
                      <Shield size={15} />
                      Privacy
                    </Link>
                  </div>

                  {/* Tip */}
                  <div className="bg-paper-deep mt-4 rounded-xl p-4">
                    <p className="text-ink text-sm font-medium">Quick note</p>
                    <p className="text-ink-body mt-2 text-sm leading-6">
                      Use the drawer to move fast on mobile. The page keeps your current context
                      while navigating.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </header>
  );
}

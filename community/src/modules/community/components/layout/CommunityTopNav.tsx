"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getMainAppUrl } from "@/lib/auth/redirect";
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
  Settings2,
  ChevronDown,
  ChevronLeft,
  MessagesSquare,
  BrainCircuit,
  Heart,
  Compass,
} from "lucide-react";

// ─── Additional Settings dropdown items ────────────────────────────────────
const SETTINGS_ITEMS = [
  { href: "/reports", icon: FileWarning, label: "Reports" },
  { href: "/safety",  icon: UserX,       label: "Safety"  },
  { href: "/privacy", icon: Shield,      label: "Privacy" },
];

export default function CommunityTopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebar = searchParams?.get("sidebar");
  const mainAppUrl = getMainAppUrl();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen]     = useState(false);
  const [unreadCount, setUnreadCount]           = useState(0);
  const isMounted  = typeof document !== "undefined";
  const settingsRef = useRef<HTMLDivElement>(null);

  // ── load / refresh unread badge ──────────────────────────────────────────
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await communityService.getCommunityUnreadNotificationCount();
        setUnreadCount(count);
      } catch {
        setUnreadCount(0);
      }
    };

    void loadUnreadCount();

    const socket = getCommunitySocket();
    const handleNewNotification = () => {
      void communityService.clearNotificationCache();
      void loadUnreadCount();
    };

    socket.on("notification:new", handleNewNotification);
    if (!socket.connected) socket.connect();
    
    // Also update badge when notifications are marked read locally
    const handleLocalRead = () => {
      void loadUnreadCount();
    };
    window.addEventListener("community:notificationsRead", handleLocalRead);

    return () => {
      socket.off("notification:new", handleNewNotification);
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

  const isSettingsActive = SETTINGS_ITEMS.some((item) =>
    pathname.startsWith(item.href),
  );

  // ── primary nav-link style helper (center) ───────────────────────────────
  const navLinkCls = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-2xl px-2 lg:px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-all duration-200 ${
      active
        ? "bg-power-orange/10 text-power-orange"
        : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-0 z-120 border-b border-white/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 shadow-sm shadow-slate-900/5 backdrop-blur sm:px-4">

          {/* Left section: Back button & Logo */}
          <div className="flex items-center flex-shrink-0">
            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <Link href="/" className="flex flex-col items-start justify-center">
              <span className="font-title inline-block origin-left scale-x-[0.92] text-[1.1rem] font-extrabold leading-none tracking-tighter lg:text-[1.25rem]">
                <span className="text-power-orange">Power</span>
                <span className="text-slate-900">MySport</span>
              </span>
              <span className="mt-0.5 pl-[1px] text-[9px] font-black uppercase tracking-[0.3em] text-slate-400/80 leading-none">
                Community
              </span>
            </Link>
          </div>

          {/* ── Desktop Center Nav ────────────────────────────────────────── */}
          <div className="hidden xl:flex flex-1 items-center justify-center gap-0.5 mx-2">
            <Link
              href="/discover"
              className={navLinkCls(pathname.startsWith("/discover"))}
            >
              <Compass size={16} />
              Discover
            </Link>

            <Link
              href="/chats?sidebar=conversations"
              className={navLinkCls(pathname.startsWith("/chats"))}
            >
              <MessagesSquare size={16} />
              Chats
            </Link>

            <Link
              href="/q"
              className={navLinkCls(pathname.startsWith("/q"))}
            >
              <MessageSquare size={16} />
              Knowledge
            </Link>

            <Link
              href="/ai-guidance"
              className={navLinkCls(pathname.startsWith("/ai-guidance"))}
            >
              <BrainCircuit size={16} />
              AI Guidance
            </Link>

            <Link
              href="/contributors"
              className={navLinkCls(pathname.startsWith("/contributors"))}
            >
              <Trophy size={16} />
              Contributors
            </Link>
          </div>

          {/* ── Desktop Right Actions ─────────────────────────────────────── */}
          <div className="hidden xl:flex items-center justify-end gap-3 flex-shrink-0">
            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-power-orange px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Additional Settings dropdown */}
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                  isSettingsActive
                    ? "bg-power-orange/10 text-power-orange"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
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
                    className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
                  >
                    <div className="px-3 pb-1 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Settings
                      </p>
                    </div>
                    {SETTINGS_ITEMS.map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsSettingsOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${
                          pathname.startsWith(href)
                            ? "text-power-orange"
                            : "text-slate-700"
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

            {/* Main App */}
            <a
              href={mainAppUrl}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-power-orange to-[#d96610] px-4 py-2 text-[13px] font-bold text-white shadow-[0_8px_16px_-6px_rgba(233,115,22,0.4)] transition hover:opacity-90 hover:shadow-[0_8px_20px_-6px_rgba(233,115,22,0.6)]"
            >
              Main App
              <ExternalLink size={14} />
            </a>
          </div>

          {/* ── Mobile hamburger ──────────────────────────────────────────── */}
          <div className="flex xl:hidden items-center gap-2">
            <Link
              href="/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 transition hover:bg-slate-100"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-power-orange px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm xl:hidden"
                style={{ zIndex: 2147483000 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="absolute left-0 top-0 h-full w-[88vw] max-w-sm overflow-y-auto border-r border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Navigate
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">
                        Community menu
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                      aria-label="Close navigation menu"
                    >
                      <span className="text-lg leading-none">×</span>
                    </button>
                  </div>

                  {/* Home shortcut */}
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <Link
                      href="/"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
                        <House size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          PowerMySport Home
                        </p>
                        <p className="text-xs text-slate-500">Overview and chat</p>
                      </div>
                    </Link>
                  </div>

                  {/* Main App link */}
                  <a
                    href={mainAppUrl}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-power-orange/30 bg-power-orange/10 px-3 py-3 text-sm font-semibold text-power-orange shadow-sm transition hover:bg-power-orange/15"
                  >
                    Main App
                    <ExternalLink size={15} />
                  </a>

                  {/* Primary nav items */}
                  <p className="mt-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 px-1">
                    Main
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: "/chats?sidebar=conversations",           icon: MessagesSquare, label: "Chats"        },
                      { href: "/ai-guidance",     icon: BrainCircuit,   label: "AI Guidance"  },
                      { href: "/discover",        icon: Compass,        label: "Discover"     },
                      { href: "/q",               icon: MessageSquare,  label: "Knowledge"    },
                      { href: "/contributors",    icon: Trophy,         label: "Contributors" },
                      { href: "/following",       icon: Heart,          label: "Following"    },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <Icon size={15} />
                        {label}
                      </Link>
                    ))}

                    {/* Notifications — full-width to accommodate badge */}
                    <Link
                      href="/notifications"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Bell size={15} />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-power-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/reports"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <FileWarning size={15} />
                      Reports
                    </Link>
                    <Link
                      href="/contributors"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Trophy size={15} />
                      Contributors
                    </Link>

                    <Link
                      href="/safety"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <UserX size={15} />
                      Safety
                    </Link>
                    <Link
                      href="/privacy"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Shield size={15} />
                      Privacy
                    </Link>
                  </div>

                  {/* Tip */}
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Quick note
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Use the drawer to move fast on mobile. The page keeps your
                      current context while navigating.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </header>
  );
}

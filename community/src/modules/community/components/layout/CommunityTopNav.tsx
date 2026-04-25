"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  Heart,
  ExternalLink,
} from "lucide-react";

export default function CommunityTopNav() {
  const pathname = usePathname();
  const mainAppUrl = getMainAppUrl();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = typeof document !== "undefined";

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count =
          await communityService.getCommunityUnreadNotificationCount();
        setUnreadCount(count);
      } catch {
        setUnreadCount(0);
      }
    };

    void loadUnreadCount();

    const socket = getCommunitySocket();
    const handleNotification = () => {
      void loadUnreadCount();
    };

    socket.on("notification:new", handleNotification);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", handleNotification);
    };
  }, []);

  if (pathname.startsWith("/join/")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-120 border-b border-white/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 shadow-sm shadow-slate-900/5 backdrop-blur sm:px-4">
          <Link
            href="/?sidebar=community-overview"
            className="flex items-center gap-2"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#E97316,#F59E0B)] text-sm font-black text-white shadow-[0_10px_24px_-12px_rgba(233,115,22,0.75)]">
              PM
            </span>
            <div>
              <p className="font-title text-base tracking-tight text-slate-900 sm:text-lg">
                PowerMySport
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">
                Community
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/q"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/85 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              <MessageSquare size={13} />
              Knowledge
            </Link>
            <Link
              href="/notifications"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/85 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              <Bell size={13} />
              Notifications
              {unreadCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-power-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/reports"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileWarning size={13} />
              Reports
            </Link>
            <Link
              href="/contributors"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Trophy size={13} />
              Contributors
            </Link>
            <Link
              href="/following"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Heart size={13} />
              Following
            </Link>
            <Link
              href="/safety"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UserX size={13} />
              Safety
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Shield size={13} />
              Privacy
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
          >
            <Menu size={18} />
            Menu
          </button>
        </div>
      </div>

      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm md:hidden"
                style={{ zIndex: 2147483000 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -24, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="absolute left-0 top-0 h-full w-[88vw] max-w-sm overflow-y-auto border-r border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
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

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <Link
                      href="/?sidebar=community-overview"
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
                        <House size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          PowerMySport Home
                        </p>
                        <p className="text-xs text-slate-500">
                          Overview and chat
                        </p>
                      </div>
                    </Link>
                  </div>

                  <a
                    href={mainAppUrl}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-power-orange/30 bg-power-orange/10 px-3 py-3 text-sm font-semibold text-power-orange shadow-sm transition hover:bg-power-orange/15"
                  >
                    Main App
                    <ExternalLink size={15} />
                  </a>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href="/q"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <MessageSquare size={15} />
                      Knowledge
                    </Link>
                    <Link
                      href="/notifications"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Bell size={15} />
                      Alerts
                      {unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-power-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
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
                      href="/following"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Heart size={15} />
                      Following
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Shield,
  FileWarning,
  House,
  Trophy,
  UserX,
  Heart,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
  match: (path: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Community",
    icon: House,
    match: (path) => path === "/",
  },
  {
    href: "/q",
    label: "Knowledge",
    icon: MessageSquare,
    match: (path) => path === "/q" || path.startsWith("/q/"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileWarning,
    match: (path) => path === "/reports",
  },
  {
    href: "/contributors",
    label: "Contributors",
    icon: Trophy,
    match: (path) => path === "/contributors",
  },
  {
    href: "/following",
    label: "Following",
    icon: Heart,
    match: (path) => path === "/following",
  },
  {
    href: "/safety",
    label: "Safety",
    icon: UserX,
    match: (path) => path === "/safety",
  },
  {
    href: "/privacy",
    label: "Privacy",
    icon: Shield,
    match: (path) => path === "/privacy",
  },
];

export default function CommunityTopNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/join/")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-power-orange text-sm font-black text-white shadow-sm">
              PM
            </span>
            <div>
              <p className="font-title text-lg tracking-tight text-slate-900">
                PowerMySport
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Community
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/q"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <MessageSquare size={13} />
              Knowledge
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileWarning size={13} />
              Reports
            </Link>
            <Link
              href="/contributors"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Trophy size={13} />
              Contributors
            </Link>
            <Link
              href="/following"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Heart size={13} />
              Following
            </Link>
            <Link
              href="/safety"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UserX size={13} />
              Safety
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Shield size={13} />
              Privacy
            </Link>
          </div>
        </div>

        <nav className="flex max-w-full items-center gap-1 overflow-x-auto pb-0.5 sm:max-w-none md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`nav-link inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-power-orange/20"
                    : "bg-white/80 text-slate-700 shadow-sm"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

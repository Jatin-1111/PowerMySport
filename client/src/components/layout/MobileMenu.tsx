"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

export interface MobileMenuLink {
  href: string;
  label: string;
  description?: string;
}

export type MobileMenuItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; key: string; label: string; links: MobileMenuLink[] };

export interface MobileMenuAccount {
  name: string;
  email: string;
  roleLabel: string;
  dashboardHref: string;
  sessionsHref?: string;
  settingsHref: string;
  onLogout: () => void;
}

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  items: MobileMenuItem[];
  isActive: (href: string) => boolean;
  /** `null` for a guest, who sees Login and Get started instead. */
  account: MobileMenuAccount | null;
}

const ROW =
  "border-hairline flex min-h-14 w-full items-center justify-between border-b text-left font-editorial text-[1.375rem] font-light leading-none";

/**
 * The phone navigation: a sheet that fills the screen under the header, so the
 * page behind it is not half visible, with the sections as ruled serif rows and
 * the account (or Login / Get started) set apart at the foot. Rows are 56px
 * tall for a thumb, one section opens at a time, and the page behind does not
 * scroll while it is open.
 */
export const MobileMenu: React.FC<MobileMenuProps> = ({
  open,
  onClose,
  items,
  isActive,
  account,
}) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const groupIsActive = (links: MobileMenuLink[]) =>
    links.some((link) => isActive(link.href.split("?")[0] ?? link.href));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="bg-paper absolute inset-x-0 top-full h-[calc(100dvh-4rem-1px)] overflow-y-auto overscroll-contain md:hidden"
        >
          <div className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
            <ul>
              {items.map((item) => {
                if (item.kind === "link") {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(ROW, active ? "text-power-orange-solid" : "text-ink")}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                }

                const expanded = openGroup === item.key;
                const active = groupIsActive(item.links);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(expanded ? null : item.key)}
                      aria-expanded={expanded}
                      aria-controls={`mobile-menu-${item.key}`}
                      className={cn(
                        ROW,
                        "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2",
                        active ? "text-power-orange-solid" : "text-ink"
                      )}
                    >
                      {item.label}
                      <motion.span
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.18 }}
                        className="text-ink-muted inline-flex"
                        aria-hidden="true"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          id={`mobile-menu-${item.key}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <ul className="border-hairline mb-3 mt-1 border-l pl-4">
                            {item.links.map((link) => {
                              const linkActive = isActive(link.href.split("?")[0] ?? link.href);
                              return (
                                <li key={link.href}>
                                  <Link
                                    href={link.href}
                                    onClick={onClose}
                                    aria-current={linkActive ? "page" : undefined}
                                    className="block py-3"
                                  >
                                    <span
                                      className={cn(
                                        "block text-base font-medium",
                                        linkActive ? "text-power-orange-solid" : "text-ink"
                                      )}
                                    >
                                      {link.label}
                                    </span>
                                    {link.description && (
                                      <span className="text-ink-muted mt-0.5 block text-sm">
                                        {link.description}
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {account ? (
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-ink text-paper flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-semibold"
                  >
                    {account.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink truncate text-base font-semibold">{account.name}</p>
                    <p className="text-ink-muted truncate text-sm">{account.email}</p>
                    <p className="text-ink-muted text-xs">{account.roleLabel}</p>
                  </div>
                </div>

                <ul className="mt-4">
                  {[
                    { label: "Dashboard", href: account.dashboardHref },
                    ...(account.sessionsHref
                      ? [{ label: "My sessions", href: account.sessionsHref }]
                      : []),
                    { label: "Settings", href: account.settingsHref },
                  ].map((row) => (
                    <li key={row.label}>
                      <Link
                        href={row.href}
                        onClick={onClose}
                        className="border-hairline text-ink flex min-h-12 items-center justify-between border-t text-base font-medium"
                      >
                        {row.label}
                        <ArrowRight className="text-ink-muted h-4 w-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={account.onLogout}
                  className="border-hairline text-ink-muted hover:text-error-red flex min-h-12 w-full items-center border-t text-left text-base font-medium transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={onClose}
                  className="border-ink text-ink hover:bg-paper-deep flex h-12 items-center justify-center rounded-md border text-base font-semibold transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="bg-power-orange-solid flex h-12 items-center justify-center rounded-md text-base font-semibold text-white transition-colors hover:bg-orange-700"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

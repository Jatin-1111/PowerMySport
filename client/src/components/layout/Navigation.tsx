"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import { consoleHomeFor, settingsHomeFor } from "@/flow/policy";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ListOrdered,
  Map,
  Menu,
  Settings,
  ShoppingBag,
  Star,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { NotificationDropdown } from "./NotificationDropdown";

export interface NavProps {
  variant?: "light" | "dark";
  sticky?: boolean;
}

const isShopLive = process.env.NEXT_PUBLIC_SHOP_IS_LIVE !== "false";
const isBookingLive = process.env.NEXT_PUBLIC_BOOKING_IS_LIVE !== "false";

/** Nav subtitle under "Book" — Venues/Coaches/Academies hidden for now, Experts only. */
const BOOK_TABS = "Experts";

// Experts deliberately absent: it is a tab inside Book, so listing it here as a
// sibling of Book pointed out of Book and straight back into it. It is named in
// the Book entry's subtitle instead.
const servicesItems = [
  ...(isShopLive
    ? [
        {
          href: "/shop",
          label: "Shop",
          description: "Sports gear and equipment",
          icon: ShoppingBag,
        },
      ]
    : []),
];

const exploreItems = [
  {
    href: "/assessment",
    label: "Get Started",
    description: "Know the sport, or need help deciding — start here",
    icon: Star,
  },
  {
    href: "/roadmap",
    label: "Sports Pathways",
    description: "Explore the journey ahead for your child's sport",
    icon: Map,
  },
  // Powermysport AI hidden for now.
  {
    href: "/rankings",
    label: "Rankings",
    description: "Official federation lists, searchable by state and player",
    icon: ListOrdered,
  },
];

/**
 * Global Navigation Bar for marketing pages
 */
export const Navigation: React.FC<NavProps> = ({ variant = "light", sticky = true }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const servicesDropdownRef = useRef<HTMLDivElement>(null);
  const exploreDropdownRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (
        servicesDropdownRef.current &&
        !servicesDropdownRef.current.contains(event.target as Node)
      ) {
        setServicesDropdownOpen(false);
      }
      if (
        exploreDropdownRef.current &&
        !exploreDropdownRef.current.contains(event.target as Node)
      ) {
        setExploreDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigationLinksRight = [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/contact", label: "Contact" },
  ];

  const isExploreActive = exploreItems.some((item) => pathname === item.href);

  const isActive = (path: string) => pathname === path;
  const isBookingActive = pathname === "/booking";
  const isServicesActive =
    isBookingActive || servicesItems.some((item) => pathname === item.href.split("?")[0]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      logout();
      setUserDropdownOpen(false);
      setMobileMenuOpen(false);
      router.push("/");
    }
  };

  const getDashboardLink = () => {
    if (!user) return null;
    return consoleHomeFor(user.role);
  };

  return (
    <nav
      className={cn(
        "border-b border-white/60 bg-white/75 text-slate-900 backdrop-blur-xl transition-all duration-300",
        sticky && "fixed inset-x-0 top-0 z-50 w-full shadow-sm",
        variant === "dark" && "bg-white/80 text-slate-900"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="relative z-50 h-full shrink-0">
            <Link href="/" className="inline-flex h-full flex-col items-start justify-center">
              <span className="font-title text-2xl font-extrabold leading-none tracking-tight">
                <span className="text-slate-900">Power</span>
                <span className="text-power-orange">My</span>
                <span className="text-slate-900">Sport</span>
              </span>
              <span className="mt-1.5 hidden text-[9px] font-medium uppercase leading-none tracking-wider text-slate-400 sm:inline-block">
                Confidence for Every Sporting Journey
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-8 md:flex">
            {/* Explore Dropdown (Roadmap + Guidance) */}
            <div className="relative" ref={exploreDropdownRef}>
              <button
                onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                onMouseEnter={() => {
                  setExploreDropdownOpen(true);
                  setServicesDropdownOpen(false);
                }}
                className={cn(
                  "shop-nav-link relative flex items-center gap-1 font-medium focus:outline-none",
                  isExploreActive &&
                    "text-power-orange after:bg-power-orange/70 after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full"
                )}
              >
                Explore
                <motion.span
                  animate={{ rotate: exploreDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>

              <AnimatePresence>
                {exploreDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onMouseLeave={() => setExploreDropdownOpen(false)}
                    className="absolute left-1/2 mt-3 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl"
                  >
                    {/* subtle top accent */}
                    <div className="from-power-orange/60 via-power-orange to-power-orange/60 h-0.5 w-full bg-gradient-to-r" />

                    <div className="py-2">
                      {exploreItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: index * 0.05,
                              duration: 0.15,
                              ease: "easeOut",
                            }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setExploreDropdownOpen(false)}
                              className={cn(
                                "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-orange-50",
                                pathname === item.href && "bg-orange-50"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                  pathname === item.href
                                    ? "bg-power-orange text-white"
                                    : "group-hover:bg-power-orange/10 group-hover:text-power-orange bg-slate-100 text-slate-500"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p
                                  className={cn(
                                    "mb-0.5 text-sm font-medium leading-none",
                                    pathname === item.href
                                      ? "text-power-orange"
                                      : "group-hover:text-power-orange text-slate-800"
                                  )}
                                >
                                  {item.label}
                                </p>
                                <p className="text-xs text-slate-400">{item.description}</p>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Community Link */}
            <Link
              href="/community"
              className={cn(
                "shop-nav-link relative font-medium",
                isActive("/community") &&
                  "text-power-orange after:bg-power-orange/70 bg-transparent after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full"
              )}
            >
              Community
            </Link>

            {/* Services Dropdown */}
            <div className="relative" ref={servicesDropdownRef}>
              <button
                onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                onMouseEnter={() => {
                  setServicesDropdownOpen(true);
                  setExploreDropdownOpen(false);
                }}
                className={cn(
                  "shop-nav-link relative font-medium focus:outline-none",
                  isServicesActive &&
                    "text-power-orange after:bg-power-orange/70 after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full"
                )}
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    Services
                    <motion.span
                      animate={{ rotate: servicesDropdownOpen ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="inline-flex"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {servicesDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    onMouseLeave={() => setServicesDropdownOpen(false)}
                    className="absolute left-1/2 mt-3 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl"
                  >
                    {/* subtle top accent */}
                    <div className="from-power-orange/60 via-power-orange to-power-orange/60 h-0.5 w-full bg-gradient-to-r" />

                    <div className="py-2">
                      {/* Book entry */}
                      {isBookingLive && (
                        <>
                          <motion.div
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: 0,
                              duration: 0.15,
                              ease: "easeOut",
                            }}
                          >
                            <Link
                              href="/booking"
                              onClick={() => setServicesDropdownOpen(false)}
                              className={cn(
                                "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-orange-50",
                                isBookingActive && "bg-orange-50"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                  isBookingActive
                                    ? "bg-power-orange text-white"
                                    : "group-hover:bg-power-orange/10 group-hover:text-power-orange bg-slate-100 text-slate-500"
                                )}
                              >
                                <CalendarCheck className="h-4 w-4" />
                              </span>
                              <div>
                                <p
                                  className={cn(
                                    "mb-0.5 text-sm font-medium leading-none",
                                    isBookingActive
                                      ? "text-power-orange"
                                      : "group-hover:text-power-orange text-slate-800"
                                  )}
                                >
                                  Book
                                </p>
                                <p className="text-xs text-slate-400">{BOOK_TABS}</p>
                              </div>
                            </Link>
                          </motion.div>

                          <div className="mx-3 mb-1 border-t border-slate-100" />
                        </>
                      )}

                      {servicesItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: (index + 1) * 0.05,
                              duration: 0.15,
                              ease: "easeOut",
                            }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setServicesDropdownOpen(false)}
                              className={cn(
                                "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-orange-50",
                                pathname === item.href && "bg-orange-50"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                  pathname === item.href
                                    ? "bg-power-orange text-white"
                                    : "group-hover:bg-power-orange/10 group-hover:text-power-orange bg-slate-100 text-slate-500"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p
                                  className={cn(
                                    "mb-0.5 text-sm font-medium leading-none",
                                    pathname === item.href
                                      ? "text-power-orange"
                                      : "group-hover:text-power-orange text-slate-800"
                                  )}
                                >
                                  {item.label}
                                </p>
                                <p className="text-xs text-slate-400">{item.description}</p>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Nav Links */}
            {navigationLinksRight.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shop-nav-link relative font-medium",
                  isActive(link.href) &&
                    "text-power-orange after:bg-power-orange/70 bg-transparent after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons (Desktop) */}
          <div className="hidden items-center space-x-4 md:flex">
            {user ? (
              <>
                <NotificationDropdown />

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="bg-power-orange focus:ring-power-orange flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    aria-label="User menu"
                  >
                    <User className="h-5 w-5" />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card border-border absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border shadow-lg"
                      >
                        <div className="border-border border-b px-4 py-3">
                          <p className="text-card-foreground text-sm font-medium">{user.name}</p>
                          <p className="text-muted-foreground mt-1 text-xs">{user.email}</p>
                          <p className="text-power-orange mt-1.5 text-[10px] font-semibold uppercase tracking-wider">
                            {user.role.replace("_", " ")}
                          </p>
                        </div>

                        <div className="py-1">
                          <Link
                            href={getDashboardLink() || "/"}
                            onClick={() => setUserDropdownOpen(false)}
                            className="text-card-foreground hover:bg-muted flex items-center px-4 py-2 text-sm transition-colors"
                          >
                            <LayoutDashboard className="mr-3 h-4 w-4" />
                            Dashboard
                          </Link>

                          {user.role !== "EXPERT" && (
                            <Link
                              href="/experts/sessions"
                              onClick={() => setUserDropdownOpen(false)}
                              className="text-card-foreground hover:bg-muted flex items-center px-4 py-2 text-sm transition-colors"
                            >
                              <CalendarCheck className="mr-3 h-4 w-4" />
                              My Sessions
                            </Link>
                          )}

                          <Link
                            href={settingsHomeFor(user.role)}
                            onClick={() => setUserDropdownOpen(false)}
                            className="text-card-foreground hover:bg-muted flex items-center px-4 py-2 text-sm transition-colors"
                          >
                            <Settings className="mr-3 h-4 w-4" />
                            Settings
                          </Link>

                          <button
                            onClick={handleLogout}
                            className="text-error-red hover:bg-muted flex w-full items-center px-4 py-2 text-sm transition-colors"
                          >
                            <LogOut className="mr-3 h-4 w-4" />
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hover:text-power-orange focus:ring-power-orange rounded-md p-2 text-slate-800 focus:outline-none focus:ring-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-200 bg-white/95 md:hidden"
          >
            <div className="space-y-1 px-2 pb-3 pt-2">
              {/* Mobile Explore Accordion (Roadmap + Guidance) */}
              <div>
                <button
                  onClick={() => setMobileExploreOpen(!mobileExploreOpen)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-base font-medium transition-colors",
                    isExploreActive
                      ? "text-power-orange bg-orange-50"
                      : "text-slate-700 hover:bg-indigo-50"
                  )}
                >
                  Explore
                  <motion.span
                    animate={{ rotate: mobileExploreOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {mobileExploreOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-1 space-y-1 border-l-2 border-orange-100 pl-3">
                        {exploreItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => {
                                setMobileExploreOpen(false);
                                setMobileMenuOpen(false);
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                pathname === item.href
                                  ? "text-power-orange bg-orange-50"
                                  : "hover:text-power-orange text-slate-600 hover:bg-orange-50"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Community Link */}
              <Link
                href="/community"
                className={cn(
                  "block rounded-md px-3 py-2 transition-colors hover:bg-indigo-50",
                  isActive("/community") ? "bg-orange-50" : ""
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span
                  className={cn(
                    "text-base font-medium",
                    isActive("/community") ? "text-power-orange" : "text-slate-700"
                  )}
                >
                  Community
                </span>
              </Link>

              {/* Mobile Services Accordion */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 transition-colors",
                    isServicesActive ? "bg-orange-50" : "hover:bg-indigo-50"
                  )}
                >
                  <span
                    className={cn(
                      "text-base font-medium",
                      isServicesActive ? "text-power-orange" : "text-slate-700"
                    )}
                  >
                    Services
                  </span>
                  <motion.span
                    animate={{ rotate: mobileServicesOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "inline-flex",
                      isServicesActive ? "text-power-orange" : "text-slate-700"
                    )}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {mobileServicesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-1 space-y-1 border-l-2 border-orange-100 pl-3">
                        {/* Book link */}
                        {isBookingLive && (
                          <Link
                            href="/booking"
                            onClick={() => {
                              setMobileServicesOpen(false);
                              setMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isBookingActive
                                ? "text-power-orange bg-orange-50"
                                : "hover:text-power-orange text-slate-600 hover:bg-orange-50"
                            )}
                          >
                            <CalendarCheck className="h-4 w-4 shrink-0" />
                            Book
                          </Link>
                        )}

                        {servicesItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => {
                                setMobileServicesOpen(false);
                                setMobileMenuOpen(false);
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                pathname === item.href
                                  ? "text-power-orange bg-orange-50"
                                  : "hover:text-power-orange text-slate-600 hover:bg-orange-50"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Nav Links */}
              {navigationLinksRight.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-indigo-50",
                    isActive(link.href) ? "text-power-orange bg-orange-50" : "text-slate-700"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="space-y-2 pb-2 pt-4">
                {user ? (
                  <>
                    <div className="border-border border-b px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{user.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                      <p className="text-power-orange mt-1.5 text-[10px] font-semibold uppercase tracking-wider">
                        {user.role.replace("_", " ")}
                      </p>
                    </div>

                    <Link href={getDashboardLink() || "/"}>
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                        className="justify-start"
                      >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Button>
                    </Link>

                    {user.role !== "EXPERT" && (
                      <Link href="/experts/sessions">
                        <Button
                          variant="ghost"
                          size="sm"
                          fullWidth
                          onClick={() => setMobileMenuOpen(false)}
                          className="justify-start"
                        >
                          <CalendarCheck className="mr-2 h-4 w-4" />
                          My Sessions
                        </Button>
                      </Link>
                    )}

                    <Link href={settingsHomeFor(user.role)}>
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                        className="justify-start"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={handleLogout}
                      className="text-error-red justify-start"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Login
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

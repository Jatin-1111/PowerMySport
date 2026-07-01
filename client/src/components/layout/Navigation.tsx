"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/utils/cn";
import { getDashboardPathByRole } from "@/utils/roleDashboard";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  Building2,
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  Settings,
  ShoppingBag,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/modules/shared/ui/Button";
import { NotificationDropdown } from "./NotificationDropdown";

export interface NavProps {
  variant?: "light" | "dark";
  sticky?: boolean;
}

const servicesItems = [
  {
    href: "/experts",
    label: "Experts",
    description: "Guidance for your sports plan",
    icon: Users,
  },
  {
    href: "/shop",
    label: "Shop",
    description: "Sports gear and equipment",
    icon: ShoppingBag,
  },
];

const exploreItems = [
  {
    href: "/roadmap",
    label: "Roadmap",
    description: "Discover sports pathways & plans",
    icon: Map,
  },
  {
    href: "/guidance",
    label: "Guidance",
    description: "AI-powered sports guidance portal",
    icon: BrainCircuit,
  },
];

/**
 * Global Navigation Bar for marketing pages
 */
export const Navigation: React.FC<NavProps> = ({
  variant = "light",
  sticky = true,
}) => {
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
    isBookingActive ||
    servicesItems.some((item) => pathname === item.href.split("?")[0]);

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
    return getDashboardPathByRole(user.role);
  };

  return (
    <nav
      className={cn(
        "border-b border-white/60 bg-white/75 backdrop-blur-xl text-slate-900 transition-all duration-300",
        sticky && "fixed inset-x-0 top-0 z-50 w-full shadow-sm",
        variant === "dark" && "bg-white/80 text-slate-900",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="shrink-0 relative z-50 h-full">
            <Link href="/" className="inline-flex items-center h-full">
              <span className="font-title text-2xl font-extrabold tracking-tight leading-none">
                <span className="text-power-orange">Power</span>
                <span className="text-slate-900">MySport</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Home */}
            <Link
              href="/"
              className={cn(
                "shop-nav-link relative font-medium",
                isActive("/") &&
                  "bg-transparent text-power-orange after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-power-orange/70",
              )}
            >
              Home
            </Link>

            {/* Explore Dropdown (Roadmap + Guidance) */}
            <div className="relative" ref={exploreDropdownRef}>
              <button
                onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                onMouseEnter={() => { setExploreDropdownOpen(true); setServicesDropdownOpen(false); }}
                className={cn(
                  "shop-nav-link relative font-medium flex items-center gap-1 focus:outline-none",
                  isExploreActive &&
                    "text-power-orange after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-power-orange/70",
                )}
              >
                Explore
                <motion.span
                  animate={{ rotate: exploreDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <ChevronDown className="w-4 h-4" />
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
                    className="absolute left-1/2 -translate-x-1/2 mt-3 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
                  >
                    {/* subtle top accent */}
                    <div className="h-0.5 w-full bg-gradient-to-r from-power-orange/60 via-power-orange to-power-orange/60" />

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
                                "flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-orange-50",
                                pathname === item.href && "bg-orange-50",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                  pathname === item.href
                                    ? "bg-power-orange text-white"
                                    : "bg-slate-100 text-slate-500 group-hover:bg-power-orange/10 group-hover:text-power-orange",
                                )}
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-medium leading-none mb-0.5",
                                    pathname === item.href
                                      ? "text-power-orange"
                                      : "text-slate-800 group-hover:text-power-orange",
                                  )}
                                >
                                  {item.label}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {item.description}
                                </p>
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
                  "bg-transparent text-power-orange after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-power-orange/70",
              )}
            >
              Community
            </Link>

            {/* Services Dropdown */}
            <div className="relative" ref={servicesDropdownRef}>
              <button
                onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                onMouseEnter={() => { setServicesDropdownOpen(true); setExploreDropdownOpen(false); }}
                className={cn(
                  "shop-nav-link relative font-medium focus:outline-none",
                  isServicesActive &&
                    "text-power-orange after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-power-orange/70",
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
                      <ChevronDown className="w-4 h-4" />
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
                    className="absolute left-1/2 -translate-x-1/2 mt-3 w-64 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
                  >
                    {/* subtle top accent */}
                    <div className="h-0.5 w-full bg-gradient-to-r from-power-orange/60 via-power-orange to-power-orange/60" />

                    <div className="py-2">
                      {/* Book entry */}
                      <motion.div
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0, duration: 0.15, ease: "easeOut" }}
                      >
                        <Link
                          href="/booking"
                          onClick={() => setServicesDropdownOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-orange-50",
                            isBookingActive && "bg-orange-50",
                          )}
                        >
                          <span
                            className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                              isBookingActive
                                ? "bg-power-orange text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-power-orange/10 group-hover:text-power-orange",
                            )}
                          >
                            <CalendarCheck className="w-4 h-4" />
                          </span>
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium leading-none mb-0.5",
                                isBookingActive
                                  ? "text-power-orange"
                                  : "text-slate-800 group-hover:text-power-orange",
                              )}
                            >
                              Book
                            </p>
                            <p className="text-xs text-slate-400">
                              Venues · Coaches · Academies
                            </p>
                          </div>
                        </Link>
                      </motion.div>

                      <div className="mx-3 mb-1 border-t border-slate-100" />

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
                                "flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-orange-50",
                                pathname === item.href && "bg-orange-50",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                                  pathname === item.href
                                    ? "bg-power-orange text-white"
                                    : "bg-slate-100 text-slate-500 group-hover:bg-power-orange/10 group-hover:text-power-orange",
                                )}
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-medium leading-none mb-0.5",
                                    pathname === item.href
                                      ? "text-power-orange"
                                      : "text-slate-800 group-hover:text-power-orange",
                                  )}
                                >
                                  {item.label}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {item.description}
                                </p>
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
                    "bg-transparent text-power-orange after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-power-orange/70",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons (Desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <NotificationDropdown />

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-power-orange hover:bg-orange-600 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-2"
                    aria-label="User menu"
                  >
                    <User className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-56 bg-card rounded-lg shadow-lg border border-border overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-medium text-card-foreground">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {user.email}
                          </p>
                        </div>

                        <div className="py-1">
                          <Link
                            href={getDashboardLink() || "/"}
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-card-foreground hover:bg-muted transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 mr-3" />
                            Dashboard
                          </Link>

                          <Link
                            href="/settings"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-card-foreground hover:bg-muted transition-colors"
                          >
                            <Settings className="w-4 h-4 mr-3" />
                            Settings
                          </Link>

                          <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-4 py-2 text-sm text-error-red hover:bg-muted transition-colors"
                          >
                            <LogOut className="w-4 h-4 mr-3" />
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
              className="text-slate-800 hover:text-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange p-2 rounded-md"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
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
            className="md:hidden border-t border-slate-200 overflow-hidden bg-white/95"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Home */}
              <Link
                href="/"
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium hover:bg-indigo-50 transition-colors",
                  isActive("/")
                    ? "text-power-orange bg-orange-50"
                    : "text-slate-700",
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>

              {/* Mobile Explore Accordion (Roadmap + Guidance) */}
              <div>
                <button
                  onClick={() => setMobileExploreOpen(!mobileExploreOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors",
                    isExploreActive
                      ? "text-power-orange bg-orange-50"
                      : "text-slate-700 hover:bg-indigo-50",
                  )}
                >
                  Explore
                  <motion.span
                    animate={{ rotate: mobileExploreOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex"
                  >
                    <ChevronDown className="w-4 h-4" />
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
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                pathname === item.href
                                  ? "text-power-orange bg-orange-50"
                                  : "text-slate-600 hover:bg-orange-50 hover:text-power-orange",
                              )}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
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
                  "block px-3 py-2 rounded-md hover:bg-indigo-50 transition-colors",
                  isActive("/community") ? "bg-orange-50" : "",
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={cn("text-base font-medium", isActive("/community") ? "text-power-orange" : "text-slate-700")}>Community</span>
              </Link>

              {/* Mobile Services Accordion */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                    isServicesActive ? "bg-orange-50" : "hover:bg-indigo-50",
                  )}
                >
                  <span className={cn("text-base font-medium", isServicesActive ? "text-power-orange" : "text-slate-700")}>Services</span>
                  <motion.span
                    animate={{ rotate: mobileServicesOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn("inline-flex", isServicesActive ? "text-power-orange" : "text-slate-700")}
                  >
                    <ChevronDown className="w-4 h-4" />
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
                        <Link
                          href="/booking"
                          onClick={() => {
                            setMobileServicesOpen(false);
                            setMobileMenuOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            isBookingActive
                              ? "text-power-orange bg-orange-50"
                              : "text-slate-600 hover:bg-orange-50 hover:text-power-orange",
                          )}
                        >
                          <CalendarCheck className="w-4 h-4 shrink-0" />
                          Book
                        </Link>

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
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                pathname === item.href
                                  ? "text-power-orange bg-orange-50"
                                  : "text-slate-600 hover:bg-orange-50 hover:text-power-orange",
                              )}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
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
                    "block px-3 py-2 rounded-md text-base font-medium hover:bg-indigo-50 transition-colors",
                    isActive(link.href)
                      ? "text-power-orange bg-orange-50"
                      : "text-slate-700",
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-4 pb-2 space-y-2">
                {user ? (
                  <>
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-sm font-medium text-slate-900">
                        {user.name}
                      </p>
                      <p className="text-xs mt-1 text-slate-500">{user.email}</p>
                    </div>

                    <Link href={getDashboardLink() || "/"}>
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                        className="justify-start"
                      >
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>

                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => setMobileMenuOpen(false)}
                        className="justify-start"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      onClick={handleLogout}
                      className="justify-start text-error-red"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
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
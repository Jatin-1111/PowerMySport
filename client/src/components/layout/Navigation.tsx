"use client";

import { buildWhatsAppUrl } from "@/lib/whatsapp";
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
  Trophy,
  GraduationCap,
  HandCoins,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  NavDropdownDivider,
  NavDropdownFooter,
  NavDropdownHeading,
  NavDropdownItem,
  NavDropdownPanel,
} from "./NavDropdown";
import { MobileMenu, type MobileMenuItem } from "./MobileMenu";
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

// Grouped so six items read as three decisions: where to start, how to compete,
// and what comes after. Descriptions stay to one or two lines so the menu is
// an even height; the longer explanation lives on each page.
const exploreItems = [
  {
    group: "Start here",
    href: "/assessment",
    label: "Get Started",
    description: "Know the sport, or need help deciding",
    icon: Star,
  },
  {
    group: "Start here",
    href: "/roadmap",
    label: "Sports Pathways",
    description: "The journey ahead for your child's sport",
    icon: Map,
  },
  {
    group: "Compete",
    href: "/tournaments",
    label: "Tournaments",
    description: "Upcoming dates, by age group",
    icon: Trophy,
  },
  // Powermysport AI hidden for now.
  {
    group: "Compete",
    href: "/planner",
    label: "Season Planner",
    description: "Plan the events they can enter",
    icon: CalendarCheck,
  },
  {
    group: "Compete",
    href: "/rankings",
    label: "Rankings",
    description: "Official federation lists",
    icon: ListOrdered,
  },
  {
    group: "Beyond the court",
    href: "/admissions",
    label: "Admissions",
    description: "Sports quotas at schools and colleges",
    icon: GraduationCap,
  },
  {
    group: "Beyond the court",
    href: "/scholarships",
    label: "Scholarships",
    description: "Funding for young athletes",
    icon: HandCoins,
  },
];

/** The same items, one column per group, for the side-by-side desktop menu. */
const exploreGroups = exploreItems.reduce<
  Array<{ group: string; items: (typeof exploreItems)[number][] }>
>((groups, item) => {
  const last = groups[groups.length - 1];
  if (last?.group === item.group) last.items.push(item);
  else groups.push({ group: item.group, items: [item] });
  return groups;
}, []);

/** Served by the community app through a rewrite, so it has no page in this route tree. */
const COMMUNITY_PATH = "/community";

/** "SUPER_ADMIN" as "Super admin": sentence case, for the menu's account block. */
const roleLabel = (role: string) => {
  const text = role.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Global Navigation Bar for marketing pages
 */
export const Navigation: React.FC<NavProps> = ({ variant = "light", sticky = true }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);

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

    // Escape closes whichever menu is open, as keyboard users expect.
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExploreDropdownOpen(false);
      setServicesDropdownOpen(false);
      setUserDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const navigationLinksRight = [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/contact", label: "Contact" },
  ];

  // Prefix match, so a sport's tournament list or a single tournament still
  // lights up Explore rather than leaving the reader with no active section.
  const isExploreActive = exploreItems.some(
    (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)
  );

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

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Prefix match so a page inside a section still lights up its row.
  const isMenuActive = (href: string) =>
    pathname === href || (href !== "/" && !!pathname?.startsWith(`${href}/`));

  const mobileMenuItems: MobileMenuItem[] = [
    {
      kind: "group",
      key: "explore",
      label: "Explore",
      links: exploreItems.map(({ href, label, description }) => ({ href, label, description })),
    },
    { kind: "link", href: COMMUNITY_PATH, label: "Community" },
    {
      kind: "group",
      key: "services",
      label: "Services",
      links: [
        ...(isBookingLive ? [{ href: "/booking", label: "Book", description: BOOK_TABS }] : []),
        ...servicesItems.map(({ href, label, description }) => ({ href, label, description })),
      ],
    },
    ...navigationLinksRight.map((link) => ({ kind: "link" as const, ...link })),
  ];

  const getDashboardLink = () => {
    if (!user) return null;
    return consoleHomeFor(user.role);
  };

  return (
    <nav
      className={cn(
        "border-hairline bg-paper/90 text-ink border-b backdrop-blur-xl transition-all duration-300",
        sticky && "fixed inset-x-0 top-0 z-50 w-full",
        variant === "dark" && "bg-paper/90 text-ink"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="relative z-50 h-full shrink-0">
            {/* The wordmark alone. A tagline sat under it at 9px in slate-400
                (2.6:1), and at a legible 12px it would be wider than the logo. */}
            <Link href="/" className="inline-flex h-full flex-col items-start justify-center">
              <span className="font-editorial text-[1.7rem] font-medium leading-none">
                <span className="text-ink">Power</span>
                <span className="text-power-orange">My</span>
                <span className="text-ink">Sport</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-8 md:flex">
            {/* Explore Dropdown (Roadmap + Guidance) */}
            <div className="relative" ref={exploreDropdownRef}>
              <button
                aria-expanded={exploreDropdownOpen}
                aria-haspopup="true"
                onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                onMouseEnter={() => {
                  setExploreDropdownOpen(true);
                  setServicesDropdownOpen(false);
                }}
                className={cn(
                  "shop-nav-link relative flex items-center gap-1 font-medium focus:outline-none",
                  isExploreActive &&
                    "text-power-orange-solid after:bg-power-orange/70 after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full"
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

              <NavDropdownPanel
                wide
                open={exploreDropdownOpen}
                onMouseLeave={() => setExploreDropdownOpen(false)}
              >
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  {exploreGroups.map(({ group, items }) => (
                    <div key={group} className="pb-1">
                      <NavDropdownHeading first>{group}</NavDropdownHeading>
                      {items.map((item) => (
                        <NavDropdownItem
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          label={item.label}
                          description={item.description}
                          active={pathname === item.href}
                          onNavigate={() => setExploreDropdownOpen(false)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <NavDropdownFooter
                  href={buildWhatsAppUrl("Hi! I'm not sure where to start with my child's sport.")}
                  prompt="Not sure where to start?"
                  label="Get guidance on WhatsApp"
                />
              </NavDropdownPanel>
            </div>

            {/* Community Link */}
            <Link
              href="/community"
              className={cn(
                "shop-nav-link relative font-medium",
                isActive("/community") &&
                  "text-power-orange-solid after:bg-power-orange/70 bg-transparent after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full"
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
                    "text-power-orange-solid after:bg-power-orange/70 after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full"
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

              <NavDropdownPanel
                open={servicesDropdownOpen}
                onMouseLeave={() => setServicesDropdownOpen(false)}
              >
                {isBookingLive && (
                  <>
                    <NavDropdownItem
                      href="/booking"
                      icon={CalendarCheck}
                      label="Book"
                      description={BOOK_TABS}
                      active={isBookingActive}
                      onNavigate={() => setServicesDropdownOpen(false)}
                    />
                    {servicesItems.length > 0 && <NavDropdownDivider />}
                  </>
                )}
                {servicesItems.map((item) => (
                  <NavDropdownItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                    active={pathname === item.href}
                    onNavigate={() => setServicesDropdownOpen(false)}
                  />
                ))}
              </NavDropdownPanel>
            </div>

            {/* Right Nav Links */}
            {navigationLinksRight.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shop-nav-link relative font-medium",
                  isActive(link.href) &&
                    "text-power-orange-solid after:bg-power-orange/70 bg-transparent after:absolute after:-bottom-1 after:left-3 after:right-3 after:h-0.5 after:rounded-full"
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
                    className="bg-power-orange-solid focus:ring-power-orange flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2"
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
                          <p className="text-power-orange-solid mt-1.5 text-xs font-semibold uppercase tracking-wider">
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
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hover:text-power-orange-solid focus:ring-power-orange rounded-md p-2 text-slate-800 focus:outline-none focus:ring-2"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        items={mobileMenuItems}
        isActive={isMenuActive}
        account={
          user
            ? {
                name: user.name,
                email: user.email,
                roleLabel: roleLabel(user.role),
                dashboardHref: getDashboardLink() || "/",
                sessionsHref: user.role !== "EXPERT" ? "/experts/sessions" : undefined,
                settingsHref: settingsHomeFor(user.role),
                onLogout: handleLogout,
              }
            : null
        }
      />
    </nav>
  );
};

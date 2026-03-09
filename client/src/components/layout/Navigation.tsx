"use client";

import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { cn } from "@/utils/cn";
import { getDashboardPathByRole } from "@/utils/roleDashboard";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, LogOut, Menu, Settings, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/modules/shared/ui/Button";
import { NotificationDropdown } from "./NotificationDropdown";

export interface NavProps {
  variant?: "light" | "dark";
  sticky?: boolean;
}

/**
 * Global Navigation Bar for marketing pages
 */
export const Navigation: React.FC<NavProps> = ({
  variant = "light",
  sticky = true,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigationLinks = [
    { href: "/", label: "Home" },
    { href: "/venues", label: "Venues" },
    { href: "/coaches", label: "Coaches" },
    { href: "/services", label: "Services" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (path: string) => pathname === path;

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

  // If user is logged in, show dashboard link instead of register
  const getDashboardLink = () => {
    if (!user) return null;
    return getDashboardPathByRole(user.role);
  };

  return (
    <nav
      className={cn(
        "border-b border-border bg-deep-slate text-white",
        sticky && "sticky top-0 z-50 backdrop-blur-sm bg-deep-slate text-white",
        variant === "dark" && "bg-deep-slate text-white",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="shrink-0 relative z-50 h-full">
            <Link href="/" className="inline-flex items-center h-full">
              <Image
                src="/header_logo_1.png"
                alt="PowerMySport"
                width={180}
                height={40}
                className="h-36 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-white hover:text-power-orange transition-colors font-medium",
                  isActive(link.href) &&
                    "text-power-orange border-b-2 border-power-orange",
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
                {/* Notification Dropdown */}
                <NotificationDropdown />

                {/* User Dropdown */}
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
              className="text-white hover:text-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange p-2 rounded-md"
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
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium hover:bg-muted transition-colors",
                  isActive(link.href)
                    ? "text-power-orange bg-orange-50"
                    : "text-slate-100",
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
                    <p className="text-sm font-medium text-slate-100">
                      {user.name}
                    </p>
                    <p className="text-xs mt-1 text-slate-300">{user.email}</p>
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
        </div>
      )}
    </nav>
  );
};

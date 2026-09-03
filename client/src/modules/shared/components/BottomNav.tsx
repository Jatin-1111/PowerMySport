"use client";

import { Badge } from "../ui/Badge";
import { cn } from "@/utils/cn";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  className?: string;
}

export function BottomNav({ items, className }: BottomNavProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50 md:hidden",
        "border-t border-slate-200/60 bg-white shadow-md",
        "safe-area-inset-bottom",
        className
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex h-14 items-center justify-around overflow-x-auto px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.href);
          const badgeText = item.badge ? `, ${item.badge} pending` : "";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-full min-w-12 flex-shrink-0 flex-col items-center justify-center px-2",
                "transition-colors duration-200",
                "focus-visible:ring-power-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                active ? "text-power-orange" : "text-slate-600 hover:text-slate-900"
              )}
              aria-label={`${item.label}${badgeText}`}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                {item.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center px-0.5 text-[9px]"
                    aria-label={`${item.badge} pending`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "mt-0.5 text-[9px] leading-tight font-medium",
                  active && "font-semibold"
                )}
                aria-hidden="true"
              >
                {item.label}
              </span>
              {active && (
                <div
                  className="bg-power-orange absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-b-full"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Spacer component to prevent content from being hidden behind bottom nav
export function BottomNavSpacer() {
  return <div className="h-14 md:hidden" />;
}

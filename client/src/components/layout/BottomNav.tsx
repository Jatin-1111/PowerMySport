"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";

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
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-white border-t border-slate-200/60 shadow-md",
        "safe-area-inset-bottom",
        className,
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14 px-1 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.href);
          const badgeText = item.badge ? `, ${item.badge} pending` : "";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center min-w-12 flex-shrink-0 h-full px-2",
                "transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-inset",
                active
                  ? "text-power-orange"
                  : "text-slate-600 hover:text-slate-900",
              )}
              aria-label={`${item.label}${badgeText}`}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 2}
                  aria-hidden="true"
                />
                {item.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 h-4 min-w-4 flex items-center justify-center text-[9px] px-0.5"
                    aria-label={`${item.badge} pending`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] mt-0.5 font-medium leading-tight",
                  active && "font-semibold",
                )}
                aria-hidden="true"
              >
                {item.label}
              </span>
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-power-orange rounded-b-full"
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

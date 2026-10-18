"use client";

import AcademiesTab from "@/modules/discovery/components/AcademiesTab";
import CoachesTab from "@/modules/discovery/components/CoachesTab";
import { ExpertsTab } from "@/modules/discovery/components/ExpertsTab";
import VenuesTab from "@/modules/discovery/components/VenuesTab";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { cn } from "@/utils/cn";
import { Building2, Check, GraduationCap, MapPin, UserRoundSearch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef } from "react";

type Tab = "venues" | "coaches" | "academies" | "experts";

// Experts are behind the same flag the `/experts` directory reads, so the tab
// appears only once they are actually bookable.
const isExpertsLive = process.env.NEXT_PUBLIC_EXPERTS_IS_LIVE === "true";

// Venues, coaches and academies are on while developing (`next dev`) and
// wherever NEXT_PUBLIC_BOOKING_CATEGORIES_IS_LIVE=true is set (UAT, staging).
// A production build leaves them off unless that flag says otherwise, so
// Experts stays the only public category until the others are ready.
const categoriesFlag = process.env.NEXT_PUBLIC_BOOKING_CATEGORIES_IS_LIVE;
const isCategoriesLive =
  categoriesFlag !== undefined ? categoriesFlag === "true" : process.env.NODE_ENV !== "production";

const ALL_TABS: {
  id: Tab;
  label: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
  sub: string;
  enabled: boolean;
}[] = [
  {
    id: "venues",
    label: "Venues",
    icon: MapPin,
    sub: "Courts and facilities",
    enabled: isCategoriesLive,
  },
  {
    id: "coaches",
    label: "Coaches",
    icon: GraduationCap,
    sub: "Certified trainers",
    enabled: isCategoriesLive,
  },
  {
    id: "academies",
    label: "Academies",
    icon: Building2,
    sub: "Structured programmes",
    enabled: isCategoriesLive,
  },
  {
    id: "experts",
    label: "Experts",
    icon: UserRoundSearch,
    sub: "1:1 guidance",
    enabled: isExpertsLive,
  },
];

const TABS = ALL_TABS.filter((t) => t.enabled);

/** The tab shown when the URL names none, or names one that is switched off. */
const DEFAULT_TAB: Tab = TABS.find((t) => t.id === "experts")?.id ?? TABS[0]?.id ?? "experts";

const TRUST_POINTS = ["Secure payments", "Verified listings", "Instant confirmation"];

function TabBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow keys move between tabs (and Home/End jump), as a tablist should.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === activeTab);
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    onTabChange(TABS[next].id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="border-hairline bg-paper/90 sticky top-16 z-40 border-b backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={listRef}
          role="tablist"
          aria-label="Booking categories"
          onKeyDown={onKeyDown}
          className="hide-scrollbar -mb-px flex gap-1 overflow-x-auto whitespace-nowrap"
        >
          {TABS.map(({ id, label, icon: Icon, sub }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                role="tab"
                id={`tab-${id}`}
                aria-controls={`tabpanel-${id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "focus-visible:ring-ink relative flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  isActive
                    ? "border-ink text-ink"
                    : "text-ink-muted hover:text-ink border-transparent"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {label}
                <span className="text-ink-muted hidden text-xs font-normal lg:inline">{sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : DEFAULT_TAB;

  const handleTabChange = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Filters belong to one category; carrying them across would silently
    // narrow the next list.
    ["sport", "mode", "maxRate", "maxFee", "minRating", "sort"].forEach((k) => params.delete(k));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="bg-paper min-h-screen">
      {/* ── Heading ──────────────────────────────────────────────── */}
      <header className="border-hairline border-b">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div>
              <p className="text-ink-muted mb-5 text-sm font-medium">Instant booking</p>
              <h1 className="font-editorial text-ink text-balance text-5xl font-light leading-[1.04] sm:text-6xl lg:text-7xl">
                {isCategoriesLive ? (
                  <>
                    Book a court, a coach or <em className="font-light italic">an expert</em>
                  </>
                ) : (
                  <>
                    Book 1:1 sessions with <em className="font-light italic">verified experts</em>
                  </>
                )}
              </h1>
            </div>

            <div>
              <p className="text-ink-body max-w-[46ch] text-pretty text-base leading-relaxed sm:text-lg">
                {isCategoriesLive
                  ? "Find a venue to play at, a coach to train with, an academy to join or an expert to ask. Bookable in minutes across India."
                  : "Get personalised guidance from verified sports experts, bookable in minutes across India."}
              </p>
              <ul className="border-hairline mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-sm">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="text-ink-body flex items-center gap-2">
                    <Check aria-hidden strokeWidth={2} className="text-ink h-4 w-4 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Tab content ──────────────────────────────────────────── */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "venues" && <VenuesTab />}
        {activeTab === "coaches" && <CoachesTab />}
        {activeTab === "academies" && <AcademiesTab />}
        {activeTab === "experts" && <ExpertsTab />}
      </div>
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div className="bg-paper min-h-screen" aria-busy="true" aria-label="Loading bookings">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <Skeleton className="mb-5 h-4 w-28" />
        <Skeleton className="h-16 w-full max-w-3xl" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingSkeleton />}>
      <BookingPageContent />
    </Suspense>
  );
}

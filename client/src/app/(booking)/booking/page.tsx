"use client";

import AcademiesTab from "@/modules/discovery/components/AcademiesTab";
import CoachesTab from "@/modules/discovery/components/CoachesTab";
import VenuesTab from "@/modules/discovery/components/VenuesTab";
import { Building2, CircleCheck, GraduationCap, MapPin, ShieldCheck, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/utils/cn";

type Tab = "venues" | "coaches" | "academies";

const TABS: { id: Tab; label: string; icon: React.FC<{ size?: number; className?: string }>; sub: string }[] = [
  { id: "venues",    label: "Venues",    icon: MapPin,        sub: "Courts & facilities" },
  { id: "coaches",   label: "Coaches",   icon: GraduationCap, sub: "Certified trainers"  },
  { id: "academies", label: "Academies", icon: Building2,     sub: "Structured programs" },
];

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  return (
    <div className="sticky top-16 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex">
          {TABS.map(({ id, label, icon: Icon, sub }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                aria-selected={isActive}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors focus-visible:outline-none",
                  isActive ? "text-power-orange" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon size={15} />
                {label}
                <span className="hidden lg:inline text-xs font-normal text-slate-400 ml-0.5">
                  · {sub}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-power-orange" />
                )}
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

  const rawTab = searchParams.get("tab") || "venues";
  const activeTab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "venues";

  const handleTabChange = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    ["sport", "mode", "maxRate", "minRating", "sort"].forEach((k) => params.delete(k));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F4F3F0]">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Headline block */}
            <div className="max-w-2xl">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-power-orange">
                Instant Booking
              </p>
              <h1
                className="font-title font-black leading-[0.92] tracking-tight text-slate-900"
                style={{ fontSize: "clamp(2.2rem, 5vw, 3.75rem)", textWrap: "balance" }}
              >
                Book courts,{" "}
                <span className="text-slate-300">coaches &</span>{" "}
                academies.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-500">
                Verified venues, certified coaches, structured academies — all bookable in minutes across India.
              </p>

            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end lg:gap-2.5">
              {[
                { icon: ShieldCheck,   label: "Secure payments"       },
                { icon: CircleCheck,   label: "Verified listings"      },
                { icon: Zap,           label: "Instant confirmation"   },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3.5 py-1.5 text-[12px] font-medium text-slate-600"
                >
                  <Icon size={13} className="text-power-orange" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Tab content ──────────────────────────────────────────── */}
      <div>
        {activeTab === "venues"    && <VenuesTab />}
        {activeTab === "coaches"   && <CoachesTab />}
        {activeTab === "academies" && <AcademiesTab />}
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[480px] items-center justify-center bg-white">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}

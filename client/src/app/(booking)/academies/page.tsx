"use client";

import FeatureWaitlist from "@/components/shared/FeatureWaitlist";
import { Building2 } from "lucide-react";

/**
 * `/academies` had a `layout.tsx` and an `[slug]` detail route but no page of
 * its own, so it returned a 404 — while the layout advertised "Discover Sports
 * Academies" to Google and `/academy` linked to it as "View public profile".
 * Same failure as `/venues` and `/coaches` before them, and the same fix: a
 * real 200 waitlist page until academy booking goes live.
 */
export default function AcademiesPage() {
  return (
    <FeatureWaitlist
      title="Academy Discovery."
      subtitle={
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
          Coming Soon.
        </span>
      }
      description="Verified academies with real programmes, fees and age groups are on their way. Join the waitlist and we'll notify you the moment academies near you go live."
      icon={Building2}
      gradientFrom="#E97316"
      gradientTo="#F59E0B"
      shadowColorClass="shadow-power-orange/30"
      buttonColorClass="bg-power-orange"
    />
  );
}

"use client";

import FeatureWaitlist from "@/components/shared/FeatureWaitlist";
import { UserCheck } from "lucide-react";

export default function CoachesPage() {
  return (
    <FeatureWaitlist
      title="Coach Booking."
      subtitle={
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
          Coming Soon.
        </span>
      }
      description="Personalised training with certified coaches is almost here. Join the waitlist and we'll let you know as soon as coaches open up for booking."
      icon={UserCheck}
      gradientFrom="#E97316"
      gradientTo="#F59E0B"
      shadowColorClass="shadow-power-orange/30"
      buttonColorClass="bg-power-orange"
    />
  );
}

"use client";

import FeatureWaitlist from "@/components/shared/FeatureWaitlist";
import { MapPin } from "lucide-react";

export default function VenuesPage() {
  return (
    <FeatureWaitlist
      title="Venue Booking."
      subtitle={
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
          Coming Soon.
        </span>
      }
      description="Instant turf, court, and field booking is on its way. Join the waitlist and we'll notify you the moment venues near you go live."
      icon={MapPin}
      gradientFrom="#E97316"
      gradientTo="#F59E0B"
      shadowColorClass="shadow-power-orange/30"
      buttonColorClass="bg-power-orange"
    />
  );
}

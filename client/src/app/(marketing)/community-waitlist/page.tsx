"use client";

import FeatureWaitlist from "@/components/shared/FeatureWaitlist";
import { Users } from "lucide-react";

export default function CommunityWaitlistPage() {
  return (
    <FeatureWaitlist
      title="Community."
      subtitle={<span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">Coming Soon.</span>}
      description="Our Community platform is almost here. Get ready to connect with parents, coaches, and sports enthusiasts."
      icon={Users}
      gradientFrom="#E97316"
      gradientTo="#F59E0B"
      shadowColorClass="shadow-power-orange/30"
      buttonColorClass="bg-power-orange"
    />
  );
}

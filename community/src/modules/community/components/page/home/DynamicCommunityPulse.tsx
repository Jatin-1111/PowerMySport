"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { communityService } from "@/modules/community/services/community";

export default function DynamicCommunityPulse() {
  const [displayCount, setDisplayCount] = useState<number>(1);

  useEffect(() => {
    let target = 1280;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const duration = 2000; // 2 seconds animation
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo for smooth deceleration
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setDisplayCount(Math.floor(1 + easeProgress * (target - 1)));
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    async function loadPulse() {
      try {
        const posts = await communityService.listPosts(1, 1);
        const groups = await communityService.listGroups();
        const totalActivity = (posts.pagination?.total || 0) + (groups.length * 12);
        target = totalActivity > 0 ? totalActivity : 1280;
      } catch (err) {
        target = 1280;
      } finally {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    }
    
    loadPulse();

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Community pulse
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {displayCount.toLocaleString()}+
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
          <Trophy className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Parents and coaches discussing development, confidence, and safe training options near you.
      </p>
    </div>
  );
}

"use client";

import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowRight, MessageCircle } from "lucide-react";

type CommunityInsightsCardProps = {
  title: string;
  description: string;
  q?: string;
  sport?: string;
  city?: string;
  ctaUrl: string;
  enabled: boolean;
  ctaTracking?: {
    eventName: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  };
};

export function CommunityInsightsCard({
  title,
  description,
  ctaUrl,
  enabled,
  ctaTracking,
}: CommunityInsightsCardProps) {
  const handleOpenCommunity = () => {
    if (!ctaTracking) {
      return;
    }

    statsApi.trackFunnelEventNonBlocking({
      ...ctaTracking,
      source: "WEB",
    });
  };

  return (
    <Card className="premium-shadow bg-white/92 rounded-3xl border border-slate-200/70 p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="text-power-orange mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
          {!enabled ? (
            <p className="mt-3 text-xs text-slate-500">
              Sign in as a player or coach to view live community insights.
            </p>
          ) : null}

          <a
            href={ctaUrl}
            target="_blank"
            rel="noreferrer"
            onClick={handleOpenCommunity}
            className="text-power-orange mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-orange-700"
          >
            Open Community
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </Card>
  );
}

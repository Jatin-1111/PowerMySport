"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import {
  communityInsightsService,
  CommunityInsightPost,
} from "@/modules/community/services/communityInsights";
import { ArrowRight, MessageCircle, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

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
  q,
  sport,
  city,
  ctaUrl,
  enabled,
  ctaTracking,
}: CommunityInsightsCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<CommunityInsightPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setError(null);
      return;
    }

    const run = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const posts = await communityInsightsService.listTopInsights({
          q,
          sport,
          city,
          limit: 3,
        });
        setItems(posts);
      } catch {
        setError("Unable to load community insights right now.");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [enabled, q, sport, city, refreshToken]);

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
    <Card className="premium-shadow rounded-3xl border border-slate-200/70 bg-white/92 p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 shrink-0 text-power-orange">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>

          {enabled && isLoading ? (
            <p className="mt-3 text-xs text-slate-500">
              Loading community insights...
            </p>
          ) : null}

          {enabled && !isLoading && error ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRefreshToken((value) => value + 1)}
                className="mt-2 font-semibold text-amber-900 underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}

          {enabled && !isLoading && items.length > 0 ? (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={getCommunityAppUrl({ path: `q/${item.id}` })}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100"
                >
                  <p className="line-clamp-1 text-sm font-medium text-slate-800">
                    {item.title}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={12} /> {item.answerCount} answers
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={12} /> {item.upvoteCount} upvotes
                    </span>
                  </p>
                </a>
              ))}
            </div>
          ) : null}

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
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange hover:text-orange-700"
          >
            Open Community
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </Card>
  );
}

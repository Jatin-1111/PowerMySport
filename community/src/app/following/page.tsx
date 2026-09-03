"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, Layers } from "lucide-react";
import { communityFollowStore, CommunityFollowRecord } from "@/modules/community/lib/followStore";
import { hasAuthToken } from "@/lib/auth/token";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";

export default function FollowingPage() {
  const [items, setItems] = useState<CommunityFollowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(true);

  useEffect(() => {
    // Follows live on the account now, so this page has nothing to show a
    // guest — say so rather than render a permanently empty list.
    if (!hasAuthToken()) {
      setIsSignedIn(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void communityFollowStore
      .getAll()
      .then((followed) => {
        if (!cancelled) {
          setItems(followed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Keeps this list in step if a follow is toggled elsewhere in the tab.
  useEffect(() => communityFollowStore.subscribe(setItems), []);

  const followedGroups = useMemo(() => items.filter((item) => item.kind === "GROUP"), [items]);
  const followedTopics = useMemo(() => items.filter((item) => item.kind === "TOPIC"), [items]);

  const remove = async (item: CommunityFollowRecord) => {
    try {
      await communityFollowStore.toggle({
        kind: item.kind,
        targetId: item.targetId,
      });
      setItems(await communityFollowStore.getAll());
      toast.success(`Unfollowed ${item.label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow space-y-4">
        <section className="community-card">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-600" />
            <h1 className="community-section-title">Following</h1>
          </div>
          <p className="community-section-copy">
            Groups and topics you follow for faster discovery.
          </p>

          {!isSignedIn ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">
                Sign in to see the groups and topics you follow. They are saved to your account, so
                they follow you across devices.
              </p>
              <button
                onClick={() => redirectToMainLogin()}
                className="bg-power-orange rounded-lg px-3 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </button>
            </div>
          ) : isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading your follows...</p>
          ) : items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No followed items yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Layers size={14} className="text-blue-600" />
                  <p className="text-sm font-semibold text-slate-900">Groups</p>
                </div>
                <div className="space-y-2">
                  {followedGroups.length === 0 ? (
                    <p className="text-xs text-slate-500">No followed groups.</p>
                  ) : (
                    followedGroups.map((item) => (
                      <div
                        key={`${item.kind}-${item.targetId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-800">{item.label}</p>
                        <button
                          onClick={() => void remove(item)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Unfollow
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Topics</p>
                <div className="space-y-2">
                  {followedTopics.length === 0 ? (
                    <p className="text-xs text-slate-500">No followed topics.</p>
                  ) : (
                    followedTopics.map((item) => (
                      <div
                        key={`${item.kind}-${item.targetId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-800">{item.label}</p>
                        <div className="flex items-center gap-2">
                          <Link
                            href={item.href}
                            className="text-power-orange inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                          >
                            Open
                            <ExternalLink size={12} />
                          </Link>
                          <button
                            onClick={() => void remove(item)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Unfollow
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

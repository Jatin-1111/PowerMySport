"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, Heart, Layers } from "lucide-react";
import {
  communityFollowStore,
  CommunityFollowItem,
} from "@/modules/community/lib/followStore";

export default function FollowingPage() {
  const [items, setItems] = useState<CommunityFollowItem[]>([]);

  useEffect(() => {
    setItems(communityFollowStore.getAll());
  }, []);

  const followedGroups = useMemo(
    () => items.filter((item) => item.kind === "group"),
    [items],
  );
  const followedTopics = useMemo(
    () => items.filter((item) => item.kind === "topic"),
    [items],
  );

  const remove = (item: CommunityFollowItem) => {
    communityFollowStore.toggle({
      kind: item.kind,
      id: item.id,
      label: item.label,
      href: item.href,
    });
    setItems(communityFollowStore.getAll());
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
          Back to Community
        </Link>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-600" />
            <h1 className="text-xl font-semibold text-slate-900">Following</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Groups and topics you follow for faster discovery.
          </p>

          {items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No followed items yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Layers size={14} className="text-blue-600" />
                  <p className="text-sm font-semibold text-slate-900">Groups</p>
                </div>
                <div className="space-y-2">
                  {followedGroups.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No followed groups.
                    </p>
                  ) : (
                    followedGroups.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {item.label}
                        </p>
                        <button
                          onClick={() => remove(item)}
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
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Topics
                </p>
                <div className="space-y-2">
                  {followedTopics.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No followed topics.
                    </p>
                  ) : (
                    followedTopics.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {item.label}
                        </p>
                        <div className="flex items-center gap-2">
                          <Link
                            href={item.href}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                          >
                            Open
                            <ExternalLink size={12} />
                          </Link>
                          <button
                            onClick={() => remove(item)}
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

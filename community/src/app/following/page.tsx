"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
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
      toast.error(error instanceof Error ? error.message : "We could not unfollow that");
    }
  };

  const renderRow = (item: CommunityFollowRecord, withOpen: boolean) => (
    <li
      key={`${item.kind}-${item.targetId}`}
      className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b py-4"
    >
      <p className="text-ink text-lg font-medium">{item.label}</p>
      <div className="flex items-center gap-5">
        {withOpen ? (
          <Link
            href={item.href}
            className="text-ink decoration-ink/30 hover:decoration-ink text-base font-semibold underline underline-offset-4 transition-colors duration-200"
          >
            Open
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => void remove(item)}
          className="text-ink-muted hover:text-ink min-h-11 text-base font-medium transition-colors duration-200"
        >
          Unfollow
        </button>
      </div>
    </li>
  );

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="Following"
          subtitle="Groups and topics you follow, saved to your account."
          badge="Your account"
        />

        <div className="mt-12">
          {!isSignedIn ? (
            <div className="bg-paper-deep rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">
                Sign in to see your follows.
              </p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                They are saved to your account, so they follow you across devices.
              </p>
              <button
                type="button"
                onClick={() => redirectToMainLogin()}
                className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
              >
                Sign in
              </button>
            </div>
          ) : isLoading ? (
            <div
              aria-busy="true"
              aria-label="Loading your follows"
              className="border-hairline border-t"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-hairline border-b py-5">
                  <div className="bg-ink/10 h-5 w-48 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-paper-deep rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">Nothing followed yet.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Follow a topic from the Questions page, or a group from Discover, and it shows up
                here.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
                <Link
                  href="/questions"
                  className="text-ink decoration-ink/30 hover:decoration-ink text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                >
                  Browse questions
                </Link>
                <Link
                  href="/discover"
                  className="text-ink decoration-ink/30 hover:decoration-ink text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                >
                  Discover groups
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-12 lg:grid-cols-2">
              <section aria-labelledby="following-groups">
                <h2 id="following-groups" className="font-editorial text-ink text-3xl font-light">
                  Groups
                </h2>
                <ul className="border-hairline mt-4 border-t">
                  {followedGroups.length === 0 ? (
                    <li className="border-hairline text-ink-body border-b py-4 text-base">
                      No followed groups.
                    </li>
                  ) : (
                    followedGroups.map((item) => renderRow(item, false))
                  )}
                </ul>
              </section>
              <section aria-labelledby="following-topics">
                <h2 id="following-topics" className="font-editorial text-ink text-3xl font-light">
                  Topics
                </h2>
                <ul className="border-hairline mt-4 border-t">
                  {followedTopics.length === 0 ? (
                    <li className="border-hairline text-ink-body border-b py-4 text-base">
                      No followed topics.
                    </li>
                  ) : (
                    followedTopics.map((item) => renderRow(item, true))
                  )}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

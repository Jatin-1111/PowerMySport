"use client";

import { DashboardSection } from "@/modules/player/components/dashboard/DashboardSection";
import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { friendService } from "@/modules/shared/services/friend";
import { Avatar, AvatarFallback, AvatarImage } from "@/modules/shared/ui/Avatar";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import Link from "next/link";

const AVATAR_LIMIT = 8;

/**
 * Who else the user knows here.
 *
 * Shows faces rather than a count: a number is a statistic, a row of people is
 * a reason to click. Pending requests stay the loudest element, since that is
 * the only part of this section that is waiting on the user.
 *
 * A friend can be anonymous in the community, so the display name falls back to
 * their alias — rendering the real name here would leak an identity the user
 * chose not to publish.
 */
export function FriendsWidget() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const { counts } = useNotifications();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.friends.list(1, AVATAR_LIMIT, ""),
    queryFn: () => friendService.getFriends(1, AVATAR_LIMIT),
    // These endpoints 401 when signed out, and the axios interceptor answers a
    // 401 by navigating to /login — firing early would hijack the route guard.
    enabled: hydrated && Boolean(token),
  });

  const friends = data?.friends ?? [];
  const total = data?.total ?? 0;
  const pending = counts.friendRequests;

  // The headline and the body below key off the SAME signal. They used to be
  // independent — the count came from `total`, the empty state from whether the
  // list was populated — and a connection to a deleted account made the two
  // disagree, so the card read "2 connections." directly above "No connections
  // yet". The server no longer counts dead rows, but a card that can only tell
  // a coherent story while its data is perfect will tell an incoherent one
  // eventually, so it is derived rather than trusted.
  const hasFriends = friends.length > 0;

  return (
    <DashboardSection
      icon={UserPlus}
      title="Friends"
      description={
        hasFriends
          ? `${total} ${total === 1 ? "connection" : "connections"}.`
          : "Connect with other parents and players to book sessions together."
      }
      isLoading={isLoading && !data}
      isError={isError}
      onRetry={() => void refetch()}
      skeletonHeight="h-16"
      action={
        <Link href="/dashboard/friends">
          <Button variant="outline" size="sm">
            {pending > 0 ? "Review requests" : "Manage friends"}
          </Button>
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        {pending > 0 && (
          <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
            {pending} pending {pending === 1 ? "request" : "requests"}
          </Badge>
        )}

        {!hasFriends ? (
          <p className="text-sm text-slate-500">
            No connections yet — find people you already train with.
          </p>
        ) : (
          <div className="flex -space-x-2">
            {friends.map((friend) => {
              const label =
                friend.isIdentityPublic === false
                  ? friend.anonymousAlias || "Member"
                  : friend.name || "Member";
              return (
                <Avatar
                  key={friend.connectionId}
                  className="h-9 w-9 ring-2 ring-white"
                  title={label}
                >
                  {friend.photoUrl && <AvatarImage src={friend.photoUrl} alt={label} />}
                  <AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              );
            })}
            {total > friends.length && (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-2 ring-white">
                +{total - friends.length}
              </span>
            )}
          </div>
        )}
      </div>
    </DashboardSection>
  );
}

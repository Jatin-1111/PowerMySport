"use client";

import { useEffect, useState } from "react";
import { friendService, Friend } from "@/modules/shared/services/friend";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/utils/cn";

interface FriendSelectorProps {
  selectedFriendIds: string[];
  onSelectionChange: (friendIds: string[]) => void;
  className?: string;
}

export function FriendSelector({
  selectedFriendIds,
  onSelectionChange,
  className,
}: FriendSelectorProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await friendService.getFriends(1, 100);
      setFriends(response.friends);
    } catch (err) {
      setError("Failed to load friends");
      console.error("Failed to load friends:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      onSelectionChange(selectedFriendIds.filter((id) => id !== friendId));
    } else {
      onSelectionChange([...selectedFriendIds, friendId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(friends.map((f) => f.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-white p-6",
          className,
        )}
      >
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading friends...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-red-200 bg-red-50 p-6",
          className,
        )}
      >
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50 p-6",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-slate-200 p-3">
            <UserPlus size={24} className="text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">No friends yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Add friends to invite them to group bookings
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-slate-500" />
          <span className="font-semibold text-slate-700">Select Friends</span>
          {selectedFriendIds.length > 0 && (
            <span className="rounded-full bg-power-orange px-2 py-0.5 text-xs font-semibold text-white">
              {selectedFriendIds.length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-power-orange hover:underline"
          >
            Select All
          </button>
          {selectedFriendIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Friends List */}
      <div className="max-h-64 overflow-y-auto">
        {friends.map((friend) => {
          const isSelected = selectedFriendIds.includes(friend.id);
          return (
            <button
              key={friend.id}
              type="button"
              onClick={() => toggleFriend(friend.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                isSelected && "bg-power-orange/5",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleFriend(friend.id)}
                className="pointer-events-none"
              />
              <Avatar className="h-10 w-10">
                <AvatarImage src={friend.photoUrl} alt={friend.name} />
                <AvatarFallback className="bg-slate-200 text-slate-700 font-semibold">
                  {friend.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {friend.name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {friend.email}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

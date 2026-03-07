"use client";

import { useState } from "react";
import { FriendSelector } from "./FriendSelector";
import { PaymentTypeSelector, PaymentType } from "./PaymentTypeSelector";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils/cn";

interface GroupBookingInviteSectionProps {
  isGroupBooking: boolean;
  onGroupBookingChange: (enabled: boolean) => void;
  selectedFriendIds: string[];
  onFriendSelectionChange: (friendIds: string[]) => void;
  paymentType: PaymentType;
  onPaymentTypeChange: (type: PaymentType) => void;
  totalAmount: number;
  className?: string;
}

export function GroupBookingInviteSection({
  isGroupBooking,
  onGroupBookingChange,
  selectedFriendIds,
  onFriendSelectionChange,
  paymentType,
  onPaymentTypeChange,
  totalAmount,
  className,
}: GroupBookingInviteSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const participantCount = isGroupBooking ? selectedFriendIds.length + 1 : 1; // +1 for the organizer

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toggle Group Booking */}
      <button
        type="button"
        onClick={() => {
          const newValue = !isGroupBooking;
          onGroupBookingChange(newValue);
          if (newValue) {
            setIsExpanded(true);
          } else {
            setIsExpanded(false);
            onFriendSelectionChange([]);
            onPaymentTypeChange("SINGLE");
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border-2 px-4 py-4 transition-all",
          isGroupBooking
            ? "border-power-orange bg-power-orange/5"
            : "border-slate-200 bg-white hover:border-slate-300",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              isGroupBooking
                ? "bg-power-orange text-white"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <Users size={20} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">
              Book with friends (Group Booking)
            </p>
            <p className="text-sm text-slate-600">
              {isGroupBooking
                ? `${selectedFriendIds.length} ${selectedFriendIds.length === 1 ? "friend" : "friends"} invited`
                : "Invite friends to join this booking"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGroupBooking && (
            <span className="rounded-full bg-power-orange px-3 py-1 text-xs font-semibold text-white">
              ON
            </span>
          )}
          {isGroupBooking ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Group Booking Options */}
      {isGroupBooking && isExpanded && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {/* Friend Selector */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Invite Friends
            </label>
            <FriendSelector
              selectedFriendIds={selectedFriendIds}
              onSelectionChange={onFriendSelectionChange}
            />
            {selectedFriendIds.length === 0 && (
              <p className="mt-2 text-xs text-red-600">
                Please select at least one friend to create a group booking
              </p>
            )}
          </div>

          {/* Payment Type Selector */}
          {selectedFriendIds.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Payment Method
              </label>
              <PaymentTypeSelector
                value={paymentType}
                onChange={onPaymentTypeChange}
                totalAmount={totalAmount}
                participantCount={participantCount}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

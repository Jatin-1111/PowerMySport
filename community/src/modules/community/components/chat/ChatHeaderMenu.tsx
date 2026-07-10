"use client";

import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Flag,
  Info,
  Search,
  Star,
  StarOff,
  Ban,
  Trash2,
  Eraser,
  UserCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { RefObject } from "react";

interface Props {
  menuRef: RefObject<HTMLDivElement | null>;
  isGroup: boolean;
  isMessageSelectionMode: boolean;
  isMuted: boolean;
  isFavourited: boolean;
  isBlocked: boolean;
  isTogglingBlockUser: boolean;
  onClose: () => void;
  onViewInfo: () => void;
  onToggleSearch: () => void;
  onMarkAllAsRead: () => void;
  onToggleSelectMessages: () => void;
  onToggleMute: () => void;
  onToggleFavourite: () => void;
  onBlock: () => void;
  onReport: () => void;
  onClearChat: () => void;
  onDeleteChat: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  hasBorderBottom = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  hasBorderBottom?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
        variant === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-50"
      } ${hasBorderBottom ? "border-b border-slate-100" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function ChatHeaderMenu({
  menuRef,
  isGroup,
  isMessageSelectionMode,
  isMuted,
  isFavourited,
  isBlocked,
  isTogglingBlockUser,
  onClose,
  onViewInfo,
  onToggleSearch,
  onMarkAllAsRead,
  onToggleSelectMessages,
  onToggleMute,
  onToggleFavourite,
  onBlock,
  onReport,
  onClearChat,
  onDeleteChat,
}: Props) {
  const wrap = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] overflow-hidden"
    >
      {/* Group 1 — Info / Search */}
      <MenuItem
        icon={isGroup ? <Info size={15} className="text-slate-500" /> : <UserCircle2 size={15} className="text-slate-500" />}
        label={isGroup ? "Group Info" : "Contact Info"}
        onClick={wrap(onViewInfo)}
      />
      <MenuItem
        icon={<Search size={15} className="text-slate-500" />}
        label="Search"
        onClick={wrap(onToggleSearch)}
        hasBorderBottom
      />

      {/* Group 2 — Messaging */}
      <MenuItem
        icon={<CheckCheck size={15} className="text-turf-green" />}
        label="Mark all as Read"
        onClick={wrap(onMarkAllAsRead)}
      />
      <MenuItem
        icon={<Check size={15} className="text-power-orange" />}
        label={isMessageSelectionMode ? "Cancel Selection" : "Select Messages"}
        onClick={wrap(onToggleSelectMessages)}
        hasBorderBottom
      />

      {/* Group 3 — Preferences */}
      <MenuItem
        icon={
          isMuted ? (
            <Bell size={15} className="text-slate-500" />
          ) : (
            <BellOff size={15} className="text-slate-500" />
          )
        }
        label={isMuted ? "Unmute Notifications" : "Mute Notifications"}
        onClick={wrap(onToggleMute)}
      />
      <MenuItem
        icon={
          isFavourited ? (
            <StarOff size={15} className="text-amber-500" />
          ) : (
            <Star size={15} className="text-amber-500" />
          )
        }
        label={isFavourited ? "Remove from Favourites" : "Add to Favourites"}
        onClick={wrap(onToggleFavourite)}
        hasBorderBottom={!isGroup}
      />

      {/* Group 4 — Safety (DM only) */}
      {!isGroup && (
        <MenuItem
          icon={<Ban size={15} />}
          label={isBlocked ? "Unblock User" : "Block User"}
          onClick={wrap(onBlock)}
          variant="danger"
          disabled={isTogglingBlockUser}
          hasBorderBottom
        />
      )}

      {/* Group 5 — Destructive */}
      <MenuItem
        icon={<Flag size={15} />}
        label="Report"
        onClick={wrap(onReport)}
        variant="danger"
      />
      <MenuItem
        icon={<Eraser size={15} />}
        label="Clear Chat"
        onClick={wrap(onClearChat)}
        variant="danger"
      />
      <MenuItem
        icon={<Trash2 size={15} />}
        label="Delete Chat"
        onClick={wrap(onDeleteChat)}
        variant="danger"
      />
    </motion.div>
  );
}

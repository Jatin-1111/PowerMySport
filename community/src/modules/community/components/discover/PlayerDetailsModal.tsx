"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CommunityMemberProfile } from "@/modules/community/types";
import { communityService } from "@/modules/community/services/community";
import {
  X,
  User,
  MapPin,
  Calendar,
  MessageSquare,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { getAvatarCharacter } from "@/modules/community/utils/chatUtils";

interface PlayerDetailsModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChat: (userId: string) => void;
}

export default function PlayerDetailsModal({
  userId,
  isOpen,
  onClose,
  onChat,
}: PlayerDetailsModalProps) {
  const [profile, setProfile] = useState<CommunityMemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && userId) {
      const fetchProfile = async () => {
        setLoading(true);
        setError("");
        try {
          const data = await communityService.getPlayerProfile(userId);
          setProfile(data);
        } catch (err) {
          console.error("Failed to fetch player profile", err);
          setError("Failed to load player details.");
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [isOpen, userId]);

  if (!isOpen || !userId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[201] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-900/5">
              {/* Header / Hero Banner */}
              <div className="relative h-28 bg-gradient-to-r from-blue-600 to-sky-400 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/40"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile Avatar Overlap */}
              <div className="relative px-6 pb-6 pt-0 sm:px-8">
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 sm:-translate-x-0 sm:left-8 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white bg-slate-100 font-title text-4xl font-bold text-slate-400 shadow-sm">
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : profile?.displayName ? (
                    getAvatarCharacter(profile.displayName)
                  ) : (
                    <User size={40} className="text-slate-300" />
                  )}
                </div>

                {loading ? (
                  <div className="mt-20 flex flex-col items-center justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-sky-500" />
                    <p className="mt-2 text-sm text-slate-500">
                      Loading profile...
                    </p>
                  </div>
                ) : error ? (
                  <div className="mt-20 py-8 text-center text-sm text-red-500">
                    {error}
                  </div>
                ) : profile ? (
                  <>
                    <div className="mt-16 flex flex-col items-center sm:items-start text-center sm:text-left">
                      <h2 className="font-title text-2xl font-bold tracking-tight text-slate-900">
                        {profile.displayName}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-600">
                          {profile.userType === "Parent"
                            ? "PARENT"
                            : profile.role === "Coach"
                              ? "Coach"
                              : "Player"}
                        </span>
                        {!profile.isIdentityPublic && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Anonymous
                          </span>
                        )}
                      </div>
                    </div>

                    {/* About & Stats */}
                    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turf-green/10 text-turf-green">
                          <MapPin size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            Location
                          </p>
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {profile.city || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
                          <Calendar size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            Age
                          </p>
                          <p className="font-semibold text-slate-900 text-sm">
                            {profile.age ?? "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Footer */}
              {!loading && profile && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8 sm:py-5">
                  <button
                    onClick={() => {
                      onChat(profile.id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-600"
                  >
                    <MessageSquare size={16} /> Send Message
                  </button>
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <ShieldCheck size={14} className="text-emerald-500" />{" "}
                    Secure Parent-to-Parent Messaging
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

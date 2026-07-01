"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile } from "@/modules/community/types";
import AuthorAvatar from "./AuthorAvatar";

/**
 * Compact "My Account" access for the blog tab: avatar + @username linking to
 * the account page. Fetches the current user's blog profile once on mount.
 */
export default function BlogAccountChip({
  className = "",
}: {
  className?: string;
}) {
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void blogService
      .getMyProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // Not eligible / not signed in — chip stays hidden.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 py-1 pl-1 pr-3 shadow-sm ${className}`}
      >
        <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
        <span className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href="/blog/account"
        title="My Account"
        className={`group inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 py-1 pl-1 pr-3 shadow-sm backdrop-blur-sm transition hover:border-power-orange/40 hover:bg-white ${className}`}
      >
        <AuthorAvatar
          name={profile.name}
          photoUrl={profile.photoUrl}
          size={32}
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[11px] font-medium text-slate-400 group-hover:text-slate-500">
            My Account
          </span>
          <span className="truncate text-xs font-semibold text-slate-800">
            {profile.username ? `@${profile.username}` : profile.name}
          </span>
        </span>
      </Link>
    </motion.div>
  );
}

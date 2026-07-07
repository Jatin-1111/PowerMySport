"use client";

import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  Heart,
  Loader2,
  Newspaper,
  Pencil,
  PenLine,
} from "lucide-react";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import {
  formatBlogDate,
  formatCount,
} from "@/modules/community/utils/blogFormat";
import {
  SOCIAL_META,
  buildSocialUrl,
} from "@/modules/community/utils/socialLinks";
import AuthorAvatar from "./AuthorAvatar";
import MyBlogListItem from "./MyBlogListItem";

interface BlogProfileViewProps {
  profile: BlogAuthorProfile;
  blogs: BlogListItem[];
  isLoadingBlogs: boolean;
  onDeleteBlog?: (blog: BlogListItem) => void;
  onEditProfile?: () => void;
}

export default function BlogProfileView({
  profile,
  blogs,
  isLoadingBlogs,
  onDeleteBlog,
  onEditProfile,
}: BlogProfileViewProps) {
  const isOwner = profile.isMe;

  const activeSocials = SOCIAL_META.map((meta) => ({
    ...meta,
    value: profile.socialLinks?.[meta.key] || "",
  })).filter((meta) => meta.value.trim().length > 0);

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#eef4ff_0%,#f8fbff_45%,#fff6e9_100%)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Blog
          </Link>
          {isOwner ? (
            <Link
              href="/blog/write"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <PenLine size={15} />
              Write
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
          {/* Section 1 — Blog list */}
          <section className="order-2 space-y-3 lg:order-1">
            <div className="flex items-center gap-2">
              <Newspaper size={18} className="text-power-orange" />
              <h2 className="font-title text-xl font-bold tracking-tight text-slate-900">
                {isOwner ? "Your stories" : `Stories by ${profile.name}`}
              </h2>
            </div>

            {isLoadingBlogs ? (
              <div className="flex justify-center py-14 text-slate-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : blogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Newspaper size={22} />
                </span>
                <p className="mt-3 font-semibold text-slate-700">
                  No stories yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isOwner
                    ? "Publish your first story to see it here."
                    : "This writer hasn't published anything yet."}
                </p>
                {isOwner ? (
                  <Link
                    href="/blog/write"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white"
                  >
                    <PenLine size={15} />
                    Write your first story
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {blogs.map((blog) => (
                    <MyBlogListItem
                      key={blog.id}
                      blog={blog}
                      owner={isOwner}
                      onDelete={onDeleteBlog}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Section 2 — Account details */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:h-fit">
            <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-sm backdrop-blur-sm">
              <div className="h-20 bg-[linear-gradient(120deg,#0f172a,#1e293b)]" />
              <div className="-mt-10 flex flex-col items-center px-6 pb-6 text-center">
                <AuthorAvatar
                  name={profile.name}
                  photoUrl={profile.photoUrl}
                  size={80}
                  className="ring-4 ring-white"
                />
                <h1 className="mt-3 font-title text-xl font-bold tracking-tight text-slate-900">
                  {profile.name}
                </h1>
                {profile.username ? (
                  <p className="text-sm font-medium text-power-orange">
                    @{profile.username}
                  </p>
                ) : null}

                <div className="mt-4 flex w-full items-center justify-center gap-3">
                  <div className="flex-1 rounded-2xl bg-slate-50 py-2.5">
                    <p className="text-lg font-bold text-slate-900">
                      {formatCount(profile.blogCount)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {profile.blogCount === 1 ? "Blog" : "Blogs"}
                    </p>
                  </div>
                  <div className="flex-1 rounded-2xl bg-slate-50 py-2.5">
                    <p className="inline-flex items-center gap-1 text-lg font-bold text-slate-900">
                      <Heart
                        size={15}
                        className="fill-rose-500 text-rose-500"
                      />
                      {formatCount(profile.totalLikes)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Likes
                    </p>
                  </div>
                </div>

                {profile.bio ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {profile.bio}
                  </p>
                ) : null}

                {activeSocials.length > 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {activeSocials.map(({ key, label, Icon, value, hover }) => (
                      <a
                        key={key}
                        href={buildSocialUrl(key, value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        title={label}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition ${hover}`}
                      >
                        <Icon size={16} />
                      </a>
                    ))}
                  </div>
                ) : null}

                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarDays size={13} />
                  Joined on {formatBlogDate(profile.joinedAt)}
                </p>

                {isOwner ? (
                  <button
                    onClick={onEditProfile}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil size={15} />
                    Edit Profile
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

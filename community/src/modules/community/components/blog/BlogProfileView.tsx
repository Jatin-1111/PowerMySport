"use client";

import Link from "next/link";
import { ChevronLeft, PenLine } from "lucide-react";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import { formatBlogDate, formatCount } from "@/modules/community/utils/blogFormat";
import { SOCIAL_META, buildSocialUrl } from "@/modules/community/utils/socialLinks";
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
    <div className="bg-paper relative min-h-[calc(100vh-5.5rem)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Link
          href="/experiences"
          className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
        >
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          All experiences
        </Link>

        <header className="bg-paper-deep mt-4 rounded-3xl p-6 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <AuthorAvatar
              name={profile.name}
              photoUrl={profile.photoUrl}
              size={96}
              className="!rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-[1.08] sm:text-5xl">
                {profile.name}
              </h1>
              {profile.username ? (
                <p className="text-ink-body mt-1 text-base">@{profile.username}</p>
              ) : null}

              {profile.bio ? (
                <p className="text-ink-body mt-5 max-w-[56ch] text-lg leading-relaxed">
                  {profile.bio}
                </p>
              ) : null}

              <p className="text-ink-body mt-5 text-base tabular-nums">
                <span className="text-ink font-semibold">{formatCount(profile.blogCount)}</span>{" "}
                {profile.blogCount === 1 ? "experience" : "experiences"}
                <span aria-hidden className="mx-3">
                  ·
                </span>
                <span className="text-ink font-semibold">{formatCount(profile.totalLikes)}</span>{" "}
                {profile.totalLikes === 1 ? "like" : "likes"}
                <span aria-hidden className="mx-3">
                  ·
                </span>
                Joined {formatBlogDate(profile.joinedAt)}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                {isOwner ? (
                  <>
                    <Link
                      href="/experiences/new"
                      className="btn-motion bg-power-orange-solid inline-flex min-h-11 items-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
                    >
                      <PenLine size={16} aria-hidden="true" />
                      Write
                    </Link>
                    <button
                      type="button"
                      onClick={onEditProfile}
                      className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                    >
                      Edit profile
                    </button>
                  </>
                ) : null}
                {activeSocials.map(({ key, label, Icon, value }) => (
                  <a
                    key={key}
                    href={buildSocialUrl(key, value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-2 text-base transition-colors duration-200"
                  >
                    <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section aria-labelledby="writer-posts" className="mt-14">
          <h2 id="writer-posts" className="font-editorial text-ink text-3xl font-light sm:text-4xl">
            {isOwner ? "Your experiences" : `Experiences by ${profile.name}`}
          </h2>

          {isLoadingBlogs ? (
            <div
              aria-busy="true"
              aria-label="Loading experiences"
              className="border-hairline mt-6 border-t"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-hairline flex gap-6 border-b py-6">
                  <div className="bg-ink/10 h-28 w-44 shrink-0 animate-pulse rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="bg-ink/10 h-3 w-20 animate-pulse rounded-sm" />
                    <div className="bg-ink/10 h-6 w-3/4 animate-pulse rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : blogs.length === 0 ? (
            <div className="bg-paper-deep mt-6 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">No experiences yet.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                {isOwner
                  ? "Share your first experience and it will show up here."
                  : "This writer has not published anything yet."}
              </p>
              {isOwner ? (
                <Link
                  href="/experiences/new"
                  className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
                >
                  <PenLine size={16} aria-hidden="true" />
                  Share your first experience
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="border-hairline mt-6 border-t">
              {blogs.map((blog) => (
                <MyBlogListItem key={blog.id} blog={blog} owner={isOwner} onDelete={onDeleteBlog} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

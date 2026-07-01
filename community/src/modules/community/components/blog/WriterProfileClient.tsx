"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import BlogProfileView from "./BlogProfileView";

export default function WriterProfileClient({
  identifier,
}: {
  identifier: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }
      const author = await blogService.getAuthorProfile(identifier);

      // Viewing your own writer page → send to the editable account page.
      if (author.isMe) {
        router.replace("/blog/account");
        return;
      }
      setProfile(author);

      setIsLoadingBlogs(true);
      const data = await blogService.listBlogs(1, 50, {
        authorId: author.userId,
      });
      setBlogs(data.items || []);
    } catch (error) {
      setNotFound(true);
      toast.error(
        error instanceof Error ? error.message : "Failed to load writer",
      );
    } finally {
      setIsLoading(false);
      setIsLoadingBlogs(false);
    }
  }, [identifier, router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5.5rem)] items-center justify-center text-slate-400">
        <Loader2 size={26} className="animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-700">Writer not found.</p>
        <Link
          href="/blog"
          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <BlogProfileView
      profile={profile}
      blogs={blogs}
      isLoadingBlogs={isLoadingBlogs}
    />
  );
}

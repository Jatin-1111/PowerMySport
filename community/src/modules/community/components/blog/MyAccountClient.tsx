"use client";

import { useCallback, useEffect, useState } from "react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import BlogProfileView from "./BlogProfileView";
import EditProfileModal from "./EditProfileModal";

export default function MyAccountClient() {
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }
      setEmail(session.email);
      const me = await blogService.getMyProfile();
      setProfile(me);

      setIsLoadingBlogs(true);
      const data = await blogService.listBlogs(1, 50, { mine: true });
      setBlogs(data.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not load your account");
    } finally {
      setIsLoading(false);
      setIsLoadingBlogs(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeleteBlog = (blog: BlogListItem) => {
    toast("Delete this experience permanently?", {
      action: {
        label: "Delete",
        onClick: () => {
          const proceed = async () => {
            try {
              await blogService.deleteBlog(blog.id);
              setBlogs((current) => current.filter((item) => item.id !== blog.id));
              setProfile((current) =>
                current
                  ? {
                      ...current,
                      blogCount: Math.max(0, current.blogCount - 1),
                    }
                  : current
              );
              toast.success("Experience deleted");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to delete");
            }
          };
          void proceed();
        },
      },
    });
  };

  if (isLoading || !profile) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading your account"
        className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-56 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <>
      <BlogProfileView
        profile={profile}
        blogs={blogs}
        isLoadingBlogs={isLoadingBlogs}
        onDeleteBlog={handleDeleteBlog}
        onEditProfile={() => setEditOpen(true)}
      />
      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        email={email}
        onSaved={setProfile}
      />
    </>
  );
}

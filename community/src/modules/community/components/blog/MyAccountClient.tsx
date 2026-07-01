"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load account",
      );
    } finally {
      setIsLoading(false);
      setIsLoadingBlogs(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeleteBlog = (blog: BlogListItem) => {
    toast("Delete this blog permanently?", {
      action: {
        label: "Delete",
        onClick: () => {
          const proceed = async () => {
            try {
              await blogService.deleteBlog(blog.id);
              setBlogs((current) => current.filter((item) => item.id !== blog.id));
              setProfile((current) =>
                current
                  ? { ...current, blogCount: Math.max(0, current.blogCount - 1) }
                  : current,
              );
              toast.success("Blog deleted");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Failed to delete",
              );
            }
          };
          void proceed();
        },
      },
    });
  };

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-5.5rem)] items-center justify-center text-slate-400">
        <Loader2 size={26} className="animate-spin" />
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

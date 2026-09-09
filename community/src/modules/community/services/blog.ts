import axiosInstance from "@/lib/api/axios";
import {
  BlogAuthorProfile,
  BlogComment,
  BlogCommentListResponse,
  BlogDetail,
  BlogListResponse,
  SocialLinks,
} from "../types";
import type { ExperienceSubjectKind } from "../constants/experienceSubjects";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** What create/updateBlog send for `subject` — a snapshot, not a live ref. */
export interface ExperienceSubjectInput {
  kind: ExperienceSubjectKind;
  refId: string;
  nameSnapshot: string;
  slugSnapshot?: string | null;
}

export interface SubjectSearchResult {
  kind: ExperienceSubjectKind;
  refId: string;
  name: string;
  slug: string | null;
  meta?: string;
}

export interface ExperienceSubjectSummary {
  count: number;
  signals: Partial<Record<string, { good: number; okay: number; poor: number }>>;
  recent: Array<{ id: string; excerpt: string; createdAt: string; authorName: string | null }>;
}

export const blogService = {
  async listBlogs(
    page = 1,
    limit = 12,
    params?: {
      topic?: string;
      q?: string;
      mine?: boolean;
      authorId?: string;
    }
  ): Promise<BlogListResponse> {
    const response = await axiosInstance.get<ApiResponse<BlogListResponse>>(
      "/community/experiences/posts",
      {
        params: {
          page,
          limit,
          ...(params?.topic ? { topic: params.topic } : {}),
          ...(params?.q ? { q: params.q } : {}),
          ...(params?.mine ? { mine: true } : {}),
          ...(params?.authorId ? { authorId: params.authorId } : {}),
        },
      }
    );
    return response.data.data;
  },

  async getBlog(blogId: string): Promise<BlogDetail> {
    const response = await axiosInstance.get<ApiResponse<BlogDetail>>(
      `/community/experiences/posts/${blogId}`
    );
    return response.data.data;
  },

  async createBlog(payload: {
    title?: string;
    excerpt?: string;
    coverImageKey?: string | null;
    topic?: string;
    tags?: string[];
    content?: string;
    status?: "DRAFT" | "PUBLISHED";
    subject?: ExperienceSubjectInput | null;
    signals?: Record<string, string> | null;
    attendedAt?: string | null;
  }): Promise<BlogDetail> {
    const response = await axiosInstance.post<ApiResponse<BlogDetail>>(
      "/community/experiences/posts",
      payload
    );
    return response.data.data;
  },

  async updateBlog(
    blogId: string,
    payload: {
      title?: string;
      excerpt?: string;
      coverImageKey?: string | null;
      topic?: string;
      tags?: string[];
      content?: string;
      status?: "DRAFT" | "PUBLISHED";
      subject?: ExperienceSubjectInput | null;
      signals?: Record<string, string> | null;
      attendedAt?: string | null;
    }
  ): Promise<BlogDetail> {
    const response = await axiosInstance.patch<ApiResponse<BlogDetail>>(
      `/community/experiences/posts/${blogId}`,
      payload
    );
    return response.data.data;
  },

  async deleteBlog(blogId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await axiosInstance.delete<ApiResponse<{ id: string; deleted: boolean }>>(
      `/community/experiences/posts/${blogId}`
    );
    return response.data.data;
  },

  async toggleLike(
    targetType: "EXPERIENCE" | "COMMENT",
    targetId: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    const response = await axiosInstance.post<ApiResponse<{ liked: boolean; likeCount: number }>>(
      "/community/experiences/likes",
      { targetType, targetId }
    );
    return response.data.data;
  },

  async listComments(blogId: string, page = 1, limit = 30): Promise<BlogCommentListResponse> {
    const response = await axiosInstance.get<ApiResponse<BlogCommentListResponse>>(
      `/community/experiences/posts/${blogId}/comments`,
      { params: { page, limit } }
    );
    return response.data.data;
  },

  async createComment(blogId: string, content: string, parentId?: string): Promise<BlogComment> {
    const response = await axiosInstance.post<ApiResponse<BlogComment>>(
      `/community/experiences/posts/${blogId}/comments`,
      { content, ...(parentId ? { parentId } : {}) }
    );
    return response.data.data;
  },

  async deleteComment(commentId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await axiosInstance.delete<ApiResponse<{ id: string; deleted: boolean }>>(
      `/community/experiences/comments/${commentId}`
    );
    return response.data.data;
  },

  async getMyProfile(): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.get<ApiResponse<BlogAuthorProfile>>(
      "/community/experiences/profile"
    );
    return response.data.data;
  },

  async getAuthorProfile(identifier: string): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.get<ApiResponse<BlogAuthorProfile>>(
      `/community/experiences/authors/${encodeURIComponent(identifier)}`
    );
    return response.data.data;
  },

  async updateProfile(payload: {
    username?: string;
    bio?: string;
    socialLinks?: Partial<SocialLinks>;
  }): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.patch<ApiResponse<BlogAuthorProfile>>(
      "/community/experiences/profile",
      payload
    );
    return response.data.data;
  },

  // ─── Subjects ───────────────────────────────────────────────────────────
  // The composer's "was this about a tournament, venue, academy or coach?"
  // autocomplete, and an entity page's "Parent experiences" summary band.
  async searchSubjects(q: string, kind?: ExperienceSubjectKind): Promise<SubjectSearchResult[]> {
    const response = await axiosInstance.get<ApiResponse<{ items: SubjectSearchResult[] }>>(
      "/community/experiences/subjects/search",
      { params: { q, ...(kind ? { kind } : {}) } }
    );
    return response.data.data.items;
  },

  async getSubjectSummary(
    kind: ExperienceSubjectKind,
    refId: string
  ): Promise<ExperienceSubjectSummary> {
    const response = await axiosInstance.get<ApiResponse<ExperienceSubjectSummary>>(
      "/community/experiences/subjects/summary",
      { params: { kind, refId } }
    );
    return response.data.data;
  },

  // The named coach/expert's one right of reply. Ownership is re-checked
  // server-side (postSubjectReply) — this call succeeding is not itself proof
  // of who the caller is.
  async postSubjectReply(blogId: string, content: string): Promise<BlogDetail> {
    const response = await axiosInstance.post<ApiResponse<BlogDetail>>(
      `/community/experiences/posts/${blogId}/reply`,
      { content }
    );
    return response.data.data;
  },

  async getImageUploadUrl(
    contentType: string
  ): Promise<{ uploadUrl: string; downloadUrl: string; key: string }> {
    const response = await axiosInstance.post<
      ApiResponse<{ uploadUrl: string; downloadUrl: string; key: string }>
    >("/community/experiences/upload-url", { contentType });
    return response.data.data;
  },
};

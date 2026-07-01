import axiosInstance from "@/lib/api/axios";
import {
  BlogAuthorProfile,
  BlogComment,
  BlogCommentListResponse,
  BlogDetail,
  BlogListResponse,
  SocialLinks,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
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
    },
  ): Promise<BlogListResponse> {
    const response = await axiosInstance.get<ApiResponse<BlogListResponse>>(
      "/community/blog/posts",
      {
        params: {
          page,
          limit,
          ...(params?.topic ? { topic: params.topic } : {}),
          ...(params?.q ? { q: params.q } : {}),
          ...(params?.mine ? { mine: true } : {}),
          ...(params?.authorId ? { authorId: params.authorId } : {}),
        },
      },
    );
    return response.data.data;
  },

  async getBlog(blogId: string): Promise<BlogDetail> {
    const response = await axiosInstance.get<ApiResponse<BlogDetail>>(
      `/community/blog/posts/${blogId}`,
    );
    return response.data.data;
  },

  async createBlog(payload: {
    title: string;
    excerpt?: string;
    coverImageKey?: string | null;
    topic?: string;
    tags?: string[];
    content?: string;
  }): Promise<BlogDetail> {
    const response = await axiosInstance.post<ApiResponse<BlogDetail>>(
      "/community/blog/posts",
      payload,
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
    },
  ): Promise<BlogDetail> {
    const response = await axiosInstance.patch<ApiResponse<BlogDetail>>(
      `/community/blog/posts/${blogId}`,
      payload,
    );
    return response.data.data;
  },

  async deleteBlog(blogId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await axiosInstance.delete<
      ApiResponse<{ id: string; deleted: boolean }>
    >(`/community/blog/posts/${blogId}`);
    return response.data.data;
  },

  async toggleLike(
    targetType: "BLOG" | "COMMENT",
    targetId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const response = await axiosInstance.post<
      ApiResponse<{ liked: boolean; likeCount: number }>
    >("/community/blog/likes", { targetType, targetId });
    return response.data.data;
  },

  async listComments(
    blogId: string,
    page = 1,
    limit = 30,
  ): Promise<BlogCommentListResponse> {
    const response = await axiosInstance.get<
      ApiResponse<BlogCommentListResponse>
    >(`/community/blog/posts/${blogId}/comments`, { params: { page, limit } });
    return response.data.data;
  },

  async createComment(
    blogId: string,
    content: string,
    parentId?: string,
  ): Promise<BlogComment> {
    const response = await axiosInstance.post<ApiResponse<BlogComment>>(
      `/community/blog/posts/${blogId}/comments`,
      { content, ...(parentId ? { parentId } : {}) },
    );
    return response.data.data;
  },

  async deleteComment(
    commentId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const response = await axiosInstance.delete<
      ApiResponse<{ id: string; deleted: boolean }>
    >(`/community/blog/comments/${commentId}`);
    return response.data.data;
  },

  async getMyProfile(): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.get<ApiResponse<BlogAuthorProfile>>(
      "/community/blog/profile",
    );
    return response.data.data;
  },

  async getAuthorProfile(identifier: string): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.get<ApiResponse<BlogAuthorProfile>>(
      `/community/blog/authors/${encodeURIComponent(identifier)}`,
    );
    return response.data.data;
  },

  async updateProfile(payload: {
    username?: string;
    bio?: string;
    socialLinks?: Partial<SocialLinks>;
  }): Promise<BlogAuthorProfile> {
    const response = await axiosInstance.patch<ApiResponse<BlogAuthorProfile>>(
      "/community/blog/profile",
      payload,
    );
    return response.data.data;
  },

  async getImageUploadUrl(
    contentType: string,
  ): Promise<{ uploadUrl: string; downloadUrl: string; key: string }> {
    const response = await axiosInstance.post<
      ApiResponse<{ uploadUrl: string; downloadUrl: string; key: string }>
    >("/community/blog/upload-url", { contentType });
    return response.data.data;
  },
};

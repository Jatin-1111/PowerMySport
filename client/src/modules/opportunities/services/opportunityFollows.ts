import axiosInstance from "@/lib/api/axios";

// A parent's own follows. Every call needs a signed-in user; the server scopes
// them to the caller. Following is what makes the server tell a parent when a
// window opens or is about to close.

const base = "/opportunity-follows";

export const opportunityFollowsApi = {
  async list(): Promise<string[]> {
    const { data } = await axiosInstance.get(base);
    return data?.data?.slugs ?? [];
  },

  async follow(slug: string): Promise<void> {
    await axiosInstance.put(`${base}/${encodeURIComponent(slug)}`);
  },

  async unfollow(slug: string): Promise<void> {
    await axiosInstance.delete(`${base}/${encodeURIComponent(slug)}`);
  },
};

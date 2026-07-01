import mongoose from "mongoose";
import { BlogPost, BlogBlock } from "../models/BlogPost";
import { BlogComment } from "../models/BlogComment";
import { BlogLike, BlogLikeTargetType } from "../models/BlogLike";
import {
  CommunityProfile,
  CommunitySocialLinks,
} from "../models/CommunityProfile";
import { User } from "../../client/models/User";
import { S3Service } from "../../shared/services/S3Service";
import { normalizeTags } from "./communityQnaUtils";

const s3Service = new S3Service();

const COMMUNITY_ALLOWED_ROLES = ["PLAYER", "COACH"] as const;
const SOCIAL_KEYS: Array<keyof CommunitySocialLinks> = [
  "youtube",
  "instagram",
  "facebook",
  "twitter",
  "github",
  "website",
];

// ─── Shared response shapes ─────────────────────────────────────────────────
export interface BlogAuthorSummary {
  id: string;
  name: string;
  username: string;
  photoUrl: string | null;
}

export interface BlogListItem {
  id: string;
  title: string;
  excerpt: string;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  topic: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByMe: boolean;
  createdAt: Date;
  author: BlogAuthorSummary;
}

export interface BlogDetail extends BlogListItem {
  content: BlogBlock[];
  updatedAt: Date;
  isMine: boolean;
}

export interface BlogCommentItem {
  id: string;
  blogId: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  author: BlogAuthorSummary;
  replies: BlogCommentItem[];
  isMine: boolean;
}

export interface BlogAuthorProfile {
  userId: string;
  username: string;
  name: string;
  photoUrl: string | null;
  bio: string;
  socialLinks: CommunitySocialLinks;
  joinedAt: Date;
  blogCount: number;
  totalLikes: number;
  isMe: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const resolveUserPhotoUrl = async (user?: {
  photoUrl?: string | null;
  photoS3Key?: string | null;
}): Promise<string | null> => {
  if (!user) {
    return null;
  }
  if (!user.photoS3Key) {
    return user.photoUrl || null;
  }
  try {
    return await s3Service.generateDownloadUrl(user.photoS3Key, "images", 604800);
  } catch (error) {
    console.error("Failed to refresh blog author photo URL:", error);
    return user.photoUrl || null;
  }
};

/** Presigned GET URL for a blog image stored in the private images bucket. */
const resolveBlogImageUrl = async (
  key?: string | null,
): Promise<string | null> => {
  if (!key) return null;
  try {
    return await s3Service.generateDownloadUrl(key, "images", 604800);
  } catch (error) {
    console.error("Failed to resolve blog image URL:", error);
    return null;
  }
};

const ensureCommunityUser = async (userId: string) => {
  const user = await User.findById(userId)
    .select("_id role name photoUrl photoS3Key createdAt")
    .lean();
  if (!user) {
    throw new Error("User not found");
  }
  if (!COMMUNITY_ALLOWED_ROLES.includes(user.role as "PLAYER" | "COACH")) {
    throw new Error(
      "The blog is available only for player and coach accounts",
    );
  }
  return user;
};

const slugifyUsername = (name?: string): string => {
  const base = (name || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `member${base}`;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean((error as { code?: number })?.code === 11000);

const generateUniqueUsername = async (name?: string): Promise<string> => {
  const base = slugifyUsername(name);
  // Try the bare slug first, then append incrementing suffixes.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await CommunityProfile.exists({ username: candidate });
    if (!exists) {
      return candidate.slice(0, 30);
    }
  }
  return `${base}${Date.now().toString().slice(-6)}`.slice(0, 30);
};

const makeDefaultAlias = (name?: string): string => {
  const seed = Math.floor(1000 + Math.random() * 9000);
  const safeName = name?.trim().split(" ")[0] || "Member";
  return `${safeName}-${seed}`;
};

/**
 * Ensure a CommunityProfile exists for the user and has a blog username.
 * Reuses the community profile so blog + chat identities stay unified.
 */
const ensureBlogProfile = async (userId: string) => {
  const user = await ensureCommunityUser(userId);

  let profile = await CommunityProfile.findOne({ userId });
  if (!profile) {
    try {
      profile = await CommunityProfile.create({
        userId,
        anonymousAlias: makeDefaultAlias(user.name),
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      profile = await CommunityProfile.findOne({ userId });
    }
  }

  if (!profile) {
    throw new Error("Failed to initialize blog profile");
  }

  if (!profile.username) {
    profile.username = await generateUniqueUsername(user.name);
    try {
      await profile.save();
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      profile.username = await generateUniqueUsername(`${user.name}${Date.now()}`);
      await profile.save();
    }
  }

  return { profile, user };
};

const normalizeSocialLinks = (
  input?: Partial<CommunitySocialLinks>,
): CommunitySocialLinks => {
  const result: CommunitySocialLinks = {};
  for (const key of SOCIAL_KEYS) {
    const value = input?.[key];
    result[key] = typeof value === "string" ? value.trim() : "";
  }
  return result;
};

/** Strip HTML tags/entities from rich-text block content for plain excerpts. */
const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

const deriveExcerpt = (
  explicit: string | undefined,
  content: BlogBlock[],
): string => {
  if (explicit && explicit.trim()) {
    return stripHtml(explicit).slice(0, 300);
  }
  const firstText = content.find(
    (block) =>
      (block.type === "text" || block.type === "heading") &&
      typeof block.text === "string" &&
      stripHtml(block.text as string).length > 0,
  );
  const text = stripHtml((firstText?.text as string) || "");
  return text.slice(0, 280);
};

/**
 * Strip transient display-only fields (resolved presigned URLs) before
 * persisting — only the S3 `imageKey` is stored; URLs are re-resolved on read.
 */
const sanitizeBlocks = (blocks: BlogBlock[]): BlogBlock[] =>
  blocks.map((block) => {
    if (block.type === "image") {
      const { imageUrl: _imageUrl, ...rest } = block as BlogBlock & {
        imageUrl?: string;
      };
      return rest as BlogBlock;
    }
    return block;
  });

const toObjectId = (id: string, label = "id"): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(id);
};

// ─── Author resolution for lists ────────────────────────────────────────────
type LeanUser = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  photoUrl?: string | null;
  photoS3Key?: string | null;
};

const buildAuthorMaps = async (authorIds: mongoose.Types.ObjectId[]) => {
  const uniqueIds = [...new Set(authorIds.map((id) => String(id)))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: uniqueIds } })
      .select("_id name photoUrl photoS3Key")
      .lean<LeanUser[]>(),
    CommunityProfile.find({ userId: { $in: uniqueIds } })
      .select("userId username")
      .lean(),
  ]);

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const usernameMap = new Map(
    profiles.map((profile) => [String(profile.userId), profile.username || ""]),
  );

  // Resolve photo URLs once per unique author.
  const photoEntries = await Promise.all(
    uniqueIds.map(async (id) => {
      const user = userMap.get(id);
      const url = await resolveUserPhotoUrl(user || undefined);
      return [id, url] as const;
    }),
  );
  const photoMap = new Map(photoEntries);

  const buildAuthor = (authorId: string): BlogAuthorSummary => {
    const user = userMap.get(authorId);
    return {
      id: authorId,
      name: user?.name || "PowerMySport Member",
      username: usernameMap.get(authorId) || "",
      photoUrl: photoMap.get(authorId) || null,
    };
  };

  return { buildAuthor };
};

export const BlogService = {
  async listBlogs(
    userId: string,
    page = 1,
    limit = 12,
    filters?: {
      topic?: string | undefined;
      q?: string | undefined;
      mine?: boolean | undefined;
      authorId?: string | undefined;
    },
  ): Promise<{
    items: BlogListItem[];
    pagination: { total: number; page: number; totalPages: number };
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const query: Record<string, unknown> = {
      isDeleted: false,
      status: "PUBLISHED",
    };

    if (filters?.mine) {
      query.authorId = toObjectId(userId, "user id");
    } else if (filters?.authorId) {
      query.authorId = toObjectId(filters.authorId, "author id");
    }

    const topic = (filters?.topic || "").trim();
    if (topic && topic.toLowerCase() !== "all") {
      query.topic = topic;
    }

    // Case-insensitive "contains" match across title, excerpt, tags, topic.
    const search = (filters?.q || "").trim();
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");
      query.$or = [
        { title: rx },
        { excerpt: rx },
        { tags: rx },
        { topic: rx },
      ];
    }

    const [posts, total] = await Promise.all([
      BlogPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      BlogPost.countDocuments(query),
    ]);

    const { buildAuthor } = await buildAuthorMaps(
      posts.map((post) => post.authorId),
    );

    const likedSet = await this.buildLikedSet(
      userId,
      "BLOG",
      posts.map((post) => String(post._id)),
    );

    const coverUrls = await Promise.all(
      posts.map((post) => resolveBlogImageUrl(post.coverImageKey)),
    );

    const items: BlogListItem[] = posts.map((post, index) => ({
      id: String(post._id),
      title: post.title,
      excerpt: post.excerpt || "",
      coverImageKey: post.coverImageKey || null,
      coverImageUrl: coverUrls[index] ?? null,
      topic: post.topic || "General",
      tags: post.tags || [],
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      viewCount: post.viewCount || 0,
      likedByMe: likedSet.has(String(post._id)),
      createdAt: post.createdAt,
      author: buildAuthor(String(post.authorId)),
    }));

    return {
      items,
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit) || 0,
      },
    };
  },

  async buildLikedSet(
    userId: string,
    targetType: BlogLikeTargetType,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (!targetIds.length) {
      return new Set();
    }
    const likes = await BlogLike.find({
      userId,
      targetType,
      targetId: { $in: targetIds },
    })
      .select("targetId")
      .lean();
    return new Set(likes.map((like) => String(like.targetId)));
  },

  async getBlog(userId: string, blogId: string): Promise<BlogDetail> {
    const id = toObjectId(blogId, "blog id");
    const post = await BlogPost.findOne({ _id: id, isDeleted: false }).lean();
    if (!post) {
      throw new Error("Blog not found");
    }

    // Fire-and-forget view increment (don't block the read).
    BlogPost.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).catch(() => {});

    const { buildAuthor } = await buildAuthorMaps([post.authorId]);
    const likedSet = await this.buildLikedSet(userId, "BLOG", [String(post._id)]);

    const coverImageUrl = await resolveBlogImageUrl(post.coverImageKey);

    // Resolve presigned URLs for inline image blocks.
    const rawContent = (post.content as BlogBlock[]) || [];
    const content = await Promise.all(
      rawContent.map(async (block) => {
        if (block.type === "image" && block.imageKey) {
          return {
            ...block,
            imageUrl: await resolveBlogImageUrl(block.imageKey as string),
          };
        }
        return block;
      }),
    );

    return {
      id: String(post._id),
      title: post.title,
      excerpt: post.excerpt || "",
      coverImageKey: post.coverImageKey || null,
      coverImageUrl,
      topic: post.topic || "General",
      tags: post.tags || [],
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      viewCount: (post.viewCount || 0) + 1,
      likedByMe: likedSet.has(String(post._id)),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      content,
      isMine: String(post.authorId) === userId,
      author: buildAuthor(String(post.authorId)),
    };
  },

  async createBlog(
    userId: string,
    payload: {
      title: string;
      excerpt?: string;
      coverImageKey?: string | null;
      topic?: string;
      tags?: string[];
      content?: BlogBlock[];
    },
  ): Promise<BlogDetail> {
    await ensureBlogProfile(userId);

    const content = sanitizeBlocks(
      Array.isArray(payload.content) ? payload.content : [],
    );
    const post = await BlogPost.create({
      authorId: userId,
      title: payload.title.trim(),
      excerpt: deriveExcerpt(payload.excerpt, content),
      coverImageKey: payload.coverImageKey || null,
      topic: (payload.topic || "General").trim() || "General",
      tags: normalizeTags(payload.tags),
      content,
      status: "PUBLISHED",
    });

    return this.getBlog(userId, String(post._id));
  },

  async updateBlog(
    userId: string,
    blogId: string,
    payload: {
      title?: string;
      excerpt?: string;
      coverImageKey?: string | null;
      topic?: string;
      tags?: string[];
      content?: BlogBlock[];
    },
  ): Promise<BlogDetail> {
    const id = toObjectId(blogId, "blog id");
    const post = await BlogPost.findOne({ _id: id, isDeleted: false });
    if (!post) {
      throw new Error("Blog not found");
    }
    if (String(post.authorId) !== userId) {
      throw new Error("Access denied");
    }

    if (typeof payload.title === "string") {
      post.title = payload.title.trim();
    }
    if (typeof payload.topic === "string") {
      post.topic = payload.topic.trim() || "General";
    }
    if (Array.isArray(payload.tags)) {
      post.tags = normalizeTags(payload.tags);
    }
    if (payload.coverImageKey !== undefined) {
      post.coverImageKey = payload.coverImageKey || null;
    }
    if (Array.isArray(payload.content)) {
      const cleaned = sanitizeBlocks(payload.content);
      post.content = cleaned;
      post.excerpt = deriveExcerpt(payload.excerpt, cleaned);
    } else if (typeof payload.excerpt === "string") {
      post.excerpt = payload.excerpt.trim().slice(0, 300);
    }

    await post.save();
    return this.getBlog(userId, String(post._id));
  },

  async deleteBlog(
    userId: string,
    blogId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const id = toObjectId(blogId, "blog id");
    const post = await BlogPost.findOne({ _id: id, isDeleted: false });
    if (!post) {
      throw new Error("Blog not found");
    }
    if (String(post.authorId) !== userId) {
      throw new Error("Access denied");
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    return { id: String(post._id), deleted: true };
  },

  async toggleLike(
    userId: string,
    targetType: BlogLikeTargetType,
    targetId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    await ensureBlogProfile(userId);
    const id = toObjectId(targetId, "target id");

    const Model = (
      targetType === "BLOG" ? BlogPost : BlogComment
    ) as mongoose.Model<{ likeCount: number }>;
    const target = await Model.findOne({ _id: id, isDeleted: false }).select("_id");
    if (!target) {
      throw new Error(
        targetType === "BLOG" ? "Blog not found" : "Comment not found",
      );
    }

    const existing = await BlogLike.findOne({ userId, targetType, targetId: id });

    let liked: boolean;
    if (existing) {
      await BlogLike.deleteOne({ _id: existing._id });
      await Model.updateOne({ _id: id }, { $inc: { likeCount: -1 } });
      liked = false;
    } else {
      try {
        await BlogLike.create({ userId, targetType, targetId: id });
        await Model.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
        liked = true;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        liked = true;
      }
    }

    const updated = await Model.findById(id).select("likeCount").lean();
    return { liked, likeCount: Math.max(0, updated?.likeCount || 0) };
  },

  async listComments(
    userId: string,
    blogId: string,
    page = 1,
    limit = 30,
  ): Promise<{
    items: BlogCommentItem[];
    pagination: { total: number; page: number; totalPages: number };
  }> {
    const id = toObjectId(blogId, "blog id");
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [topLevel, total] = await Promise.all([
      BlogComment.find({ blogId: id, parentId: null, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      BlogComment.countDocuments({ blogId: id, parentId: null, isDeleted: false }),
    ]);

    const topIds = topLevel.map((comment) => comment._id);
    const replies = topIds.length
      ? await BlogComment.find({
          parentId: { $in: topIds },
          isDeleted: false,
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];

    const all = [...topLevel, ...replies];
    const { buildAuthor } = await buildAuthorMaps(
      all.map((comment) => comment.authorId),
    );
    const likedSet = await this.buildLikedSet(
      userId,
      "COMMENT",
      all.map((comment) => String(comment._id)),
    );

    const toItem = (comment: (typeof all)[number]): BlogCommentItem => ({
      id: String(comment._id),
      blogId: String(comment.blogId),
      content: comment.content,
      parentId: comment.parentId ? String(comment.parentId) : null,
      likeCount: comment.likeCount || 0,
      likedByMe: likedSet.has(String(comment._id)),
      createdAt: comment.createdAt,
      author: buildAuthor(String(comment.authorId)),
      replies: [],
      isMine: String(comment.authorId) === userId,
    });

    const repliesByParent = new Map<string, BlogCommentItem[]>();
    for (const reply of replies) {
      const parentKey = String(reply.parentId);
      const list = repliesByParent.get(parentKey) || [];
      list.push(toItem(reply));
      repliesByParent.set(parentKey, list);
    }

    const items = topLevel.map((comment) => {
      const item = toItem(comment);
      item.replies = repliesByParent.get(String(comment._id)) || [];
      return item;
    });

    return {
      items,
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit) || 0,
      },
    };
  },

  async createComment(
    userId: string,
    blogId: string,
    content: string,
    parentId?: string,
  ): Promise<BlogCommentItem> {
    await ensureBlogProfile(userId);
    const id = toObjectId(blogId, "blog id");

    const blog = await BlogPost.findOne({ _id: id, isDeleted: false }).select("_id");
    if (!blog) {
      throw new Error("Blog not found");
    }

    let parent: mongoose.Types.ObjectId | null = null;
    if (parentId) {
      const parentObjId = toObjectId(parentId, "parent id");
      const parentComment = await BlogComment.findOne({
        _id: parentObjId,
        blogId: id,
        isDeleted: false,
      }).select("_id parentId");
      if (!parentComment) {
        throw new Error("Parent comment not found");
      }
      // Enforce single-level threading: reply to the top-level ancestor.
      parent = parentComment.parentId
        ? (parentComment.parentId as mongoose.Types.ObjectId)
        : (parentComment._id as mongoose.Types.ObjectId);
    }

    const comment = await BlogComment.create({
      blogId: id,
      authorId: userId,
      content: content.trim(),
      parentId: parent,
    });
    await BlogPost.updateOne({ _id: id }, { $inc: { commentCount: 1 } });

    const { buildAuthor } = await buildAuthorMaps([comment.authorId]);
    return {
      id: String(comment._id),
      blogId: String(comment.blogId),
      content: comment.content,
      parentId: comment.parentId ? String(comment.parentId) : null,
      likeCount: 0,
      likedByMe: false,
      createdAt: comment.createdAt,
      author: buildAuthor(String(comment.authorId)),
      replies: [],
      isMine: true,
    };
  },

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const id = toObjectId(commentId, "comment id");
    const comment = await BlogComment.findOne({ _id: id, isDeleted: false });
    if (!comment) {
      throw new Error("Comment not found");
    }
    if (String(comment.authorId) !== userId) {
      throw new Error("Access denied");
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();
    await BlogPost.updateOne(
      { _id: comment.blogId },
      { $inc: { commentCount: -1 } },
    );

    return { id: String(comment._id), deleted: true };
  },

  async buildProfilePayload(
    viewerId: string,
    targetUserId: string,
  ): Promise<BlogAuthorProfile> {
    const [user, profile] = await Promise.all([
      User.findById(targetUserId)
        .select("_id name photoUrl photoS3Key createdAt")
        .lean<LeanUser & { createdAt: Date }>(),
      CommunityProfile.findOne({ userId: targetUserId }).lean(),
    ]);
    if (!user) {
      throw new Error("User not found");
    }

    const [photoUrl, blogCount, likeAgg] = await Promise.all([
      resolveUserPhotoUrl(user),
      BlogPost.countDocuments({
        authorId: targetUserId,
        isDeleted: false,
        status: "PUBLISHED",
      }),
      BlogPost.aggregate<{ total: number }>([
        {
          $match: {
            authorId: new mongoose.Types.ObjectId(targetUserId),
            isDeleted: false,
            status: "PUBLISHED",
          },
        },
        { $group: { _id: null, total: { $sum: "$likeCount" } } },
      ]),
    ]);

    return {
      userId: String(user._id),
      username: profile?.username || "",
      name: user.name || "PowerMySport Member",
      photoUrl,
      bio: profile?.bio || "",
      socialLinks: normalizeSocialLinks(profile?.socialLinks),
      joinedAt: user.createdAt,
      blogCount,
      totalLikes: likeAgg[0]?.total || 0,
      isMe: String(user._id) === viewerId,
    };
  },

  async getMyBlogProfile(userId: string): Promise<BlogAuthorProfile> {
    await ensureBlogProfile(userId);
    return this.buildProfilePayload(userId, userId);
  },

  async getBlogAuthorProfile(
    viewerId: string,
    identifier: string,
  ): Promise<BlogAuthorProfile> {
    let targetUserId: string | null = null;

    // Resolve by @username first, then by raw user id.
    const byUsername = await CommunityProfile.findOne({
      username: identifier.trim().toLowerCase(),
    })
      .select("userId")
      .lean();
    if (byUsername) {
      targetUserId = String(byUsername.userId);
    } else if (mongoose.Types.ObjectId.isValid(identifier)) {
      targetUserId = identifier;
    }

    if (!targetUserId) {
      throw new Error("Author not found");
    }

    return this.buildProfilePayload(viewerId, targetUserId);
  },

  async updateBlogProfile(
    userId: string,
    payload: {
      username?: string;
      bio?: string;
      socialLinks?: Partial<CommunitySocialLinks>;
    },
  ): Promise<BlogAuthorProfile> {
    const { profile } = await ensureBlogProfile(userId);

    if (typeof payload.username === "string" && payload.username.trim()) {
      const nextUsername = payload.username.trim().toLowerCase();
      if (nextUsername !== profile.username) {
        const taken = await CommunityProfile.findOne({
          username: nextUsername,
          userId: { $ne: userId },
        })
          .select("_id")
          .lean();
        if (taken) {
          throw new Error("Username is already taken");
        }
        profile.username = nextUsername;
      }
    }

    if (typeof payload.bio === "string") {
      profile.bio = payload.bio.trim().slice(0, 300);
    }

    if (payload.socialLinks) {
      profile.socialLinks = normalizeSocialLinks({
        ...(profile.socialLinks || {}),
        ...payload.socialLinks,
      });
    }

    try {
      await profile.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("Username is already taken");
      }
      throw error;
    }

    return this.buildProfilePayload(userId, userId);
  },

  async generateImageUploadUrl(
    userId: string,
    contentType: "image/jpeg" | "image/png" | "image/webp",
  ): Promise<{ uploadUrl: string; downloadUrl: string; key: string }> {
    await ensureCommunityUser(userId);
    const { uploadUrl, downloadUrl, key } =
      await s3Service.generateBlogImageUploadUrl(userId, contentType);
    return { uploadUrl, downloadUrl, key };
  },
};

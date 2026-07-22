import { Prisma, type BlogLikeTargetType } from "@prisma/client";
import prisma from "../../lib/prisma";
import { S3Service } from "../../shared/services/S3Service";
import { normalizeTags } from "./communityQnaUtils";

const s3Service = new S3Service();

const COMMUNITY_ALLOWED_ROLES = ["Player", "Coach", "Parent"] as const;

// socialLinks was an embedded object on CommunityProfile in Mongo; in Postgres
// it is flattened into sl* scalar columns. This interface preserves the old
// object shape used by the public response payloads.
interface CommunitySocialLinks {
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

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
  content: string;
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
    return await s3Service.generateDownloadUrl(
      user.photoS3Key,
      "images",
      604800,
    );
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      photoUrl: true,
      photoS3Key: true,
      createdAt: true,
    },
  });
  if (!user) {
    throw new Error("User not found");
  }
  if (
    !COMMUNITY_ALLOWED_ROLES.includes(
      user.role as (typeof COMMUNITY_ALLOWED_ROLES)[number],
    )
  ) {
    throw new Error(
      "The blog is available only for player, coach, and parent accounts",
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

// Postgres unique-constraint violations surface as Prisma P2002 (was Mongo 11000).
const isDuplicateKeyError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const generateUniqueUsername = async (name?: string): Promise<string> => {
  const base = slugifyUsername(name);
  // Try the bare slug first, then append incrementing suffixes.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await prisma.communityProfile.findFirst({
      where: { username: candidate },
      select: { id: true },
    });
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

  let profile = await prisma.communityProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    try {
      profile = await prisma.communityProfile.create({
        data: {
          userId,
          anonymousAlias: makeDefaultAlias(user.name),
        },
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      profile = await prisma.communityProfile.findUnique({
        where: { userId },
      });
    }
  }

  if (!profile) {
    throw new Error("Failed to initialize blog profile");
  }

  if (!profile.username) {
    try {
      profile = await prisma.communityProfile.update({
        where: { id: profile.id },
        data: { username: await generateUniqueUsername(user.name) },
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      profile = await prisma.communityProfile.update({
        where: { id: profile.id },
        data: {
          username: await generateUniqueUsername(`${user.name}${Date.now()}`),
        },
      });
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

/** Rebuild the embedded-style socialLinks object from the flattened sl* columns. */
const socialLinksFromProfile = (profile: {
  slYoutube: string;
  slInstagram: string;
  slFacebook: string;
  slTwitter: string;
  slGithub: string;
  slWebsite: string;
}): CommunitySocialLinks => ({
  youtube: profile.slYoutube,
  instagram: profile.slInstagram,
  facebook: profile.slFacebook,
  twitter: profile.slTwitter,
  github: profile.slGithub,
  website: profile.slWebsite,
});

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
  content: string,
): string => {
  if (explicit && explicit.trim()) {
    return stripHtml(explicit).slice(0, 300);
  }
  return stripHtml(content || "").slice(0, 280);
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface LegacyBlogBlock {
  id: string;
  type: "heading" | "text" | "list" | "image" | "quote";
  text?: string;
  level?: 1 | 2 | 3;
  items?: string[];
  ordered?: boolean;
  imageKey?: string;
  caption?: string;
  [key: string]: unknown;
}

/**
 * Posts published before the Tiptap editor stored `content` as an array of
 * blocks (see git history of BlogPost.ts). Legacy rows migrated from Mongo may
 * still carry that array shape, so convert them to the equivalent HTML on the
 * fly rather than migrating (and potentially corrupting) other authors' stored
 * content.
 */
const legacyBlocksToHtml = (blocks: LegacyBlogBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const level = Math.min(Math.max(block.level || 2, 1), 3);
          return `<h${level}>${block.text || ""}</h${level}>`;
        }
        case "quote":
          return `<blockquote><p>${block.text || ""}</p></blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = (block.items || [])
            .filter((item) => item.trim())
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          return items ? `<${tag}>${items}</${tag}>` : "";
        }
        case "image": {
          if (!block.imageKey) return "";
          const img = `<img data-key="${escapeAttr(block.imageKey)}" alt="${escapeAttr(block.caption || "")}">`;
          return block.caption
            ? `${img}<p><em>${escapeHtml(block.caption)}</em></p>`
            : img;
        }
        case "text":
        default:
          return block.text ? `<p>${block.text}</p>` : "";
      }
    })
    .filter(Boolean)
    .join("");

/** Normalize a post's persisted `content` to HTML, upgrading legacy block arrays. */
const toContentHtml = (content: unknown): string =>
  Array.isArray(content)
    ? legacyBlocksToHtml(content as LegacyBlogBlock[])
    : (content as string) || "";

const CONTENT_IMG_RE = /<img\b[^>]*>/gi;
const DATA_KEY_ATTR_RE = /data-key="([^"]*)"/i;
const SRC_ATTR_RE = /\ssrc="[^"]*"/i;

const escapeAttr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Blank the `src` of every content image that carries a `data-key` before
 * persisting — only the S3 key is stored; the URL is re-resolved fresh on
 * every read (mirrors cover image / author photo handling).
 */
const stripContentImageSrc = (html: string): string =>
  (html || "").replace(CONTENT_IMG_RE, (tag) => {
    const key = DATA_KEY_ATTR_RE.exec(tag)?.[1];
    if (!key) return tag;
    return SRC_ATTR_RE.test(tag) ? tag.replace(SRC_ATTR_RE, ' src=""') : tag;
  });

/** Re-sign every content image's `src` from its stored `data-key`. */
const resolveContentImageUrls = async (html: string): Promise<string> => {
  if (!html) return html;
  const tags = [...new Set(html.match(CONTENT_IMG_RE) || [])];
  const entries = tags
    .map((tag) => ({ tag, key: DATA_KEY_ATTR_RE.exec(tag)?.[1] }))
    .filter((entry): entry is { tag: string; key: string } =>
      Boolean(entry.key),
    );

  const replacements = await Promise.all(
    entries.map(async ({ tag, key }) => {
      const url = await resolveBlogImageUrl(key);
      if (!url) return null;
      const safeUrl = escapeAttr(url);
      const nextTag = SRC_ATTR_RE.test(tag)
        ? tag.replace(SRC_ATTR_RE, ` src="${safeUrl}"`)
        : tag.replace(/^<img/i, `<img src="${safeUrl}"`);
      return { tag, nextTag };
    }),
  );

  let result = html;
  for (const replacement of replacements) {
    if (replacement) {
      result = result.split(replacement.tag).join(replacement.nextTag);
    }
  }
  return result;
};

/**
 * Ids are now Postgres strings (cuid, or the 24-char ObjectId hex preserved
 * from the Mongo ETL) — there is no ObjectId to cast to, so we only guard
 * against empty/invalid input and pass the id through verbatim.
 */
const toId = (id: string, label = "id"): string => {
  if (!id || typeof id !== "string") {
    throw new Error(`Invalid ${label}`);
  }
  return id;
};

// ─── Author resolution for lists ────────────────────────────────────────────
const buildAuthorMaps = async (authorIds: string[]) => {
  const uniqueIds = [...new Set(authorIds.map((id) => String(id)))];
  const [users, profiles] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, photoUrl: true, photoS3Key: true },
    }),
    prisma.communityProfile.findMany({
      where: { userId: { in: uniqueIds } },
      select: { userId: true, username: true },
    }),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const usernameMap = new Map(
    profiles.map((profile) => [profile.userId, profile.username || ""]),
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

    const where: Prisma.BlogPostWhereInput = {
      isDeleted: false,
      status: "PUBLISHED",
    };

    if (filters?.mine) {
      where.authorId = toId(userId, "user id");
    } else if (filters?.authorId) {
      where.authorId = toId(filters.authorId, "author id");
    }

    const topic = (filters?.topic || "").trim();
    if (topic && topic.toLowerCase() !== "all") {
      where.topic = topic;
    }

    // Case-insensitive "contains" match across title, excerpt, topic + exact tag.
    const search = (filters?.q || "").trim();
    if (search) {
      // TODO(prisma): full-text — this OR/contains scan replaces the old Mongo
      // regex $or. For a real full-text endpoint, add a tsvector + GIN index and
      // query via $queryRaw. Note `tags` (String[]) only supports exact-element
      // `has` here; case-insensitive partial tag matching also needs the tsvector
      // approach (Prisma has no `contains`/`mode` on scalar arrays).
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { topic: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    const { buildAuthor } = await buildAuthorMaps(
      posts.map((post) => post.authorId),
    );

    const likedSet = await this.buildLikedSet(
      userId,
      "BLOG",
      posts.map((post) => post.id),
    );

    const coverUrls = await Promise.all(
      posts.map((post) => resolveBlogImageUrl(post.coverImageKey)),
    );

    const items: BlogListItem[] = posts.map((post, index) => ({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt || "",
      coverImageKey: post.coverImageKey || null,
      coverImageUrl: coverUrls[index] ?? null,
      topic: post.topic || "General",
      tags: post.tags || [],
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      viewCount: post.viewCount || 0,
      likedByMe: likedSet.has(post.id),
      createdAt: post.createdAt,
      author: buildAuthor(post.authorId),
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
    const likes = await prisma.blogLike.findMany({
      where: {
        userId,
        targetType,
        targetId: { in: targetIds },
      },
      select: { targetId: true },
    });
    return new Set(likes.map((like) => like.targetId));
  },

  async getBlog(userId: string, blogId: string): Promise<BlogDetail> {
    const id = toId(blogId, "blog id");
    const post = await prisma.blogPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!post) {
      throw new Error("Blog not found");
    }

    // Fire-and-forget view increment (don't block the read).
    prisma.blogPost
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    const { buildAuthor } = await buildAuthorMaps([post.authorId]);
    const likedSet = await this.buildLikedSet(userId, "BLOG", [post.id]);

    const coverImageUrl = await resolveBlogImageUrl(post.coverImageKey);
    const content = await resolveContentImageUrls(toContentHtml(post.content));

    return {
      id: post.id,
      title: post.title,
      excerpt: post.excerpt || "",
      coverImageKey: post.coverImageKey || null,
      coverImageUrl,
      topic: post.topic || "General",
      tags: post.tags || [],
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      viewCount: (post.viewCount || 0) + 1,
      likedByMe: likedSet.has(post.id),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      content,
      isMine: post.authorId === userId,
      author: buildAuthor(post.authorId),
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
      content?: string;
    },
  ): Promise<BlogDetail> {
    await ensureBlogProfile(userId);

    const content = stripContentImageSrc(payload.content || "");
    const post = await prisma.blogPost.create({
      data: {
        authorId: userId,
        title: payload.title.trim(),
        excerpt: deriveExcerpt(payload.excerpt, content),
        coverImageKey: payload.coverImageKey || null,
        topic: (payload.topic || "General").trim() || "General",
        tags: normalizeTags(payload.tags),
        content,
        status: "PUBLISHED",
      },
    });

    return this.getBlog(userId, post.id);
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
      content?: string;
    },
  ): Promise<BlogDetail> {
    const id = toId(blogId, "blog id");
    const post = await prisma.blogPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!post) {
      throw new Error("Blog not found");
    }
    if (post.authorId !== userId) {
      throw new Error("Access denied");
    }

    const data: Prisma.BlogPostUpdateInput = {};

    if (typeof payload.title === "string") {
      data.title = payload.title.trim();
    }
    if (typeof payload.topic === "string") {
      data.topic = payload.topic.trim() || "General";
    }
    if (Array.isArray(payload.tags)) {
      data.tags = normalizeTags(payload.tags);
    }
    if (payload.coverImageKey !== undefined) {
      data.coverImageKey = payload.coverImageKey || null;
    }
    if (typeof payload.content === "string") {
      const cleaned = stripContentImageSrc(payload.content);
      data.content = cleaned;
      data.excerpt = deriveExcerpt(payload.excerpt, cleaned);
    } else if (typeof payload.excerpt === "string") {
      data.excerpt = payload.excerpt.trim().slice(0, 300);
    }

    await prisma.blogPost.update({ where: { id }, data });
    return this.getBlog(userId, id);
  },

  async deleteBlog(
    userId: string,
    blogId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const id = toId(blogId, "blog id");
    const post = await prisma.blogPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!post) {
      throw new Error("Blog not found");
    }
    if (post.authorId !== userId) {
      throw new Error("Access denied");
    }

    await prisma.blogPost.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { id: post.id, deleted: true };
  },

  async toggleLike(
    userId: string,
    targetType: BlogLikeTargetType,
    targetId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    await ensureBlogProfile(userId);
    const id = toId(targetId, "target id");

    // Confirm the like target exists and is not soft-deleted.
    const target =
      targetType === "BLOG"
        ? await prisma.blogPost.findFirst({
            where: { id, isDeleted: false },
            select: { id: true },
          })
        : await prisma.blogComment.findFirst({
            where: { id, isDeleted: false },
            select: { id: true },
          });
    if (!target) {
      throw new Error(
        targetType === "BLOG" ? "Blog not found" : "Comment not found",
      );
    }

    const existing = await prisma.blogLike.findUnique({
      where: {
        userId_targetType_targetId: { userId, targetType, targetId: id },
      },
    });

    let liked: boolean;
    if (existing) {
      // Un-like: delete the row + decrement the target counter atomically.
      await prisma.$transaction([
        prisma.blogLike.delete({ where: { id: existing.id } }),
        targetType === "BLOG"
          ? prisma.blogPost.update({
              where: { id },
              data: { likeCount: { decrement: 1 } },
            })
          : prisma.blogComment.update({
              where: { id },
              data: { likeCount: { decrement: 1 } },
            }),
      ]);
      liked = false;
    } else {
      // Like: create the row + increment the target counter atomically.
      try {
        await prisma.$transaction([
          prisma.blogLike.create({
            data: { userId, targetType, targetId: id },
          }),
          targetType === "BLOG"
            ? prisma.blogPost.update({
                where: { id },
                data: { likeCount: { increment: 1 } },
              })
            : prisma.blogComment.update({
                where: { id },
                data: { likeCount: { increment: 1 } },
              }),
        ]);
        liked = true;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        liked = true;
      }
    }

    const updated =
      targetType === "BLOG"
        ? await prisma.blogPost.findUnique({
            where: { id },
            select: { likeCount: true },
          })
        : await prisma.blogComment.findUnique({
            where: { id },
            select: { likeCount: true },
          });
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
    const id = toId(blogId, "blog id");
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [topLevel, total] = await Promise.all([
      prisma.blogComment.findMany({
        where: { blogId: id, parentId: null, isDeleted: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.blogComment.count({
        where: { blogId: id, parentId: null, isDeleted: false },
      }),
    ]);

    const topIds = topLevel.map((comment) => comment.id);
    const replies = topIds.length
      ? await prisma.blogComment.findMany({
          where: { parentId: { in: topIds }, isDeleted: false },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const all = [...topLevel, ...replies];
    const { buildAuthor } = await buildAuthorMaps(
      all.map((comment) => comment.authorId),
    );
    const likedSet = await this.buildLikedSet(
      userId,
      "COMMENT",
      all.map((comment) => comment.id),
    );

    const toItem = (comment: (typeof all)[number]): BlogCommentItem => ({
      id: comment.id,
      blogId: comment.blogId,
      content: comment.content,
      parentId: comment.parentId ? comment.parentId : null,
      likeCount: comment.likeCount || 0,
      likedByMe: likedSet.has(comment.id),
      createdAt: comment.createdAt,
      author: buildAuthor(comment.authorId),
      replies: [],
      isMine: comment.authorId === userId,
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
      item.replies = repliesByParent.get(comment.id) || [];
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
    const id = toId(blogId, "blog id");

    const blog = await prisma.blogPost.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    });
    if (!blog) {
      throw new Error("Blog not found");
    }

    let parent: string | null = null;
    if (parentId) {
      const parentObjId = toId(parentId, "parent id");
      const parentComment = await prisma.blogComment.findFirst({
        where: { id: parentObjId, blogId: id, isDeleted: false },
        select: { id: true, parentId: true },
      });
      if (!parentComment) {
        throw new Error("Parent comment not found");
      }
      // Enforce single-level threading: reply to the top-level ancestor.
      parent = parentComment.parentId
        ? parentComment.parentId
        : parentComment.id;
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.blogComment.create({
        data: {
          blogId: id,
          authorId: userId,
          content: content.trim(),
          parentId: parent,
        },
      });
      await tx.blogPost.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      });
      return created;
    });

    const { buildAuthor } = await buildAuthorMaps([comment.authorId]);
    return {
      id: comment.id,
      blogId: comment.blogId,
      content: comment.content,
      parentId: comment.parentId ? comment.parentId : null,
      likeCount: 0,
      likedByMe: false,
      createdAt: comment.createdAt,
      author: buildAuthor(comment.authorId),
      replies: [],
      isMine: true,
    };
  },

  async deleteComment(
    userId: string,
    commentId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    const id = toId(commentId, "comment id");
    const comment = await prisma.blogComment.findFirst({
      where: { id, isDeleted: false },
    });
    if (!comment) {
      throw new Error("Comment not found");
    }
    if (comment.authorId !== userId) {
      throw new Error("Access denied");
    }

    await prisma.$transaction([
      prisma.blogComment.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
      prisma.blogPost.update({
        where: { id: comment.blogId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    return { id: comment.id, deleted: true };
  },

  async buildProfilePayload(
    viewerId: string,
    targetUserId: string,
  ): Promise<BlogAuthorProfile> {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          photoS3Key: true,
          createdAt: true,
        },
      }),
      prisma.communityProfile.findUnique({ where: { userId: targetUserId } }),
    ]);
    if (!user) {
      throw new Error("User not found");
    }

    const [photoUrl, blogCount, likeAgg] = await Promise.all([
      resolveUserPhotoUrl(user),
      prisma.blogPost.count({
        where: {
          authorId: targetUserId,
          isDeleted: false,
          status: "PUBLISHED",
        },
      }),
      prisma.blogPost.aggregate({
        where: {
          authorId: targetUserId,
          isDeleted: false,
          status: "PUBLISHED",
        },
        _sum: { likeCount: true },
      }),
    ]);

    return {
      userId: user.id,
      username: profile?.username || "",
      name: user.name || "PowerMySport Member",
      photoUrl,
      bio: profile?.bio || "",
      socialLinks: normalizeSocialLinks(
        profile ? socialLinksFromProfile(profile) : undefined,
      ),
      joinedAt: user.createdAt,
      blogCount,
      totalLikes: likeAgg._sum.likeCount || 0,
      isMe: user.id === viewerId,
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
    const byUsername = await prisma.communityProfile.findFirst({
      where: { username: identifier.trim().toLowerCase() },
      select: { userId: true },
    });
    if (byUsername) {
      targetUserId = byUsername.userId;
    } else {
      // No ObjectId to validate against anymore; treat the identifier as a raw
      // user id only if a matching user actually exists.
      const user = await prisma.user.findUnique({
        where: { id: identifier },
        select: { id: true },
      });
      if (user) {
        targetUserId = identifier;
      }
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

    const data: Prisma.CommunityProfileUpdateInput = {};

    if (typeof payload.username === "string" && payload.username.trim()) {
      const nextUsername = payload.username.trim().toLowerCase();
      if (nextUsername !== profile.username) {
        const taken = await prisma.communityProfile.findFirst({
          where: { username: nextUsername, userId: { not: userId } },
          select: { id: true },
        });
        if (taken) {
          throw new Error("Username is already taken");
        }
        data.username = nextUsername;
      }
    }

    if (typeof payload.bio === "string") {
      data.bio = payload.bio.trim().slice(0, 300);
    }

    if (payload.socialLinks) {
      const merged = normalizeSocialLinks({
        ...socialLinksFromProfile(profile),
        ...payload.socialLinks,
      });
      data.slYoutube = merged.youtube ?? "";
      data.slInstagram = merged.instagram ?? "";
      data.slFacebook = merged.facebook ?? "";
      data.slTwitter = merged.twitter ?? "";
      data.slGithub = merged.github ?? "";
      data.slWebsite = merged.website ?? "";
    }

    try {
      await prisma.communityProfile.update({
        where: { id: profile.id },
        data,
      });
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

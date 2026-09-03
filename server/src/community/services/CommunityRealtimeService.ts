import { Server } from "socket.io";

let socketInstance: Server | null = null;

export type CommunityQnaEventName =
  | "community:qnaPostCreated"
  | "community:qnaPostUpdated"
  | "community:qnaPostDeleted"
  | "community:qnaAnswerCreated"
  | "community:qnaAnswerUpdated"
  | "community:qnaAnswerDeleted"
  | "community:qnaVoteUpdated"
  | "community:qnaAnswerAccepted"
  | "community:qnaCommentCreated"
  | "community:qnaCommentDeleted";

export type CommunityBlogEventName =
  | "community:blogCreated"
  | "community:blogUpdated"
  | "community:blogDeleted"
  | "community:blogLiked"
  | "community:blogCommented";

export type CommunityGroupEventName = "community:groupMembersUpdated";

export type CommunityUserEventName = "community:reportUpdated";

/**
 * Room names. Q&A and blog events used to go to `.of("/community").emit(...)`,
 * which handed every connected socket every event — a user sitting in a DM got
 * woken up by a vote on a question they have never seen, and each wake-up costs
 * a refetch on the client. These rooms narrow each event to the sockets that
 * actually render it.
 *
 * The feed rooms are deliberately NOT sharded by sport. `sport` is optional on
 * a post and the default feed view is unfiltered, so a sharded client would
 * have to join every shard anyway — it would buy nothing and break the moment
 * someone posts without a sport.
 */
export const QNA_FEED_ROOM = "qna:feed";
export const BLOG_FEED_ROOM = "blog:feed";
export const qnaPostRoom = (postId: string) => `qna:post:${postId}`;
export const blogRoom = (blogId: string) => `blog:${blogId}`;

/** Rooms a socket may join on its own say-so. Both are public, read-only
 *  surfaces — anyone who can reach the namespace can already GET this data over
 *  HTTP, so there is nothing extra to authorise. Group and conversation rooms
 *  are access-checked and stay out of here. */
const isSubscribableRoom = (room: string): boolean =>
  room === QNA_FEED_ROOM ||
  room === BLOG_FEED_ROOM ||
  /^qna:post:[a-f\d]{24}$/i.test(room) ||
  /^blog:[a-f\d]{24}$/i.test(room);

export const assertSubscribableRoom = (room: string): boolean => isSubscribableRoom(room);

export const setCommunityRealtimeSocketInstance = (io: Server) => {
  socketInstance = io;
};

/** Emit to one or more rooms. Socket.IO de-duplicates across chained `.to()`
 *  calls, so a socket in both the feed room and the post room still receives a
 *  single copy. */
const emitToRooms = (
  rooms: string[],
  eventName: string,
  payload: Record<string, unknown>
): void => {
  if (!socketInstance) {
    return;
  }

  const targets = rooms.filter(Boolean);
  if (targets.length === 0) {
    return;
  }

  socketInstance
    .of("/community")
    .to(targets)
    .emit(eventName, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
};

export const emitCommunityQnaEvent = (
  eventName: CommunityQnaEventName,
  payload: Record<string, unknown>,
  rooms: string[]
): void => {
  emitToRooms(rooms, eventName, payload);
};

export const emitCommunityBlogEvent = (
  eventName: CommunityBlogEventName,
  payload: Record<string, unknown>,
  rooms: string[]
): void => {
  emitToRooms(rooms, eventName, payload);
};

export const emitCommunityGroupEvent = (
  groupId: string,
  eventName: CommunityGroupEventName,
  payload: Record<string, unknown>
): void => {
  emitToRooms([`group:${groupId}`], eventName, payload);
};

export const emitCommunityUserEvent = (
  userId: string,
  eventName: CommunityUserEventName,
  payload: Record<string, unknown>
): void => {
  emitToRooms([`user:${userId}`], eventName, payload);
};

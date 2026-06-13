import { Server } from "socket.io";

let socketInstance: Server | null = null;

export type CommunityQnaEventName =
  | "community:qnaPostCreated"
  | "community:qnaPostUpdated"
  | "community:qnaPostDeleted"
  | "community:qnaAnswerCreated"
  | "community:qnaAnswerUpdated"
  | "community:qnaAnswerDeleted"
  | "community:qnaVoteUpdated";

export type CommunityGroupEventName = "community:groupMembersUpdated";

export type CommunityUserEventName = "community:reportUpdated";

export const setCommunityRealtimeSocketInstance = (io: Server) => {
  socketInstance = io;
};

export const emitCommunityQnaEvent = (
  eventName: CommunityQnaEventName,
  payload: Record<string, unknown>,
): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.of("/community").emit(eventName, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

export const emitCommunityGroupEvent = (
  groupId: string,
  eventName: CommunityGroupEventName,
  payload: Record<string, unknown>,
): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.of("/community").to(`group:${groupId}`).emit(eventName, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

export const emitCommunityUserEvent = (
  userId: string,
  eventName: CommunityUserEventName,
  payload: Record<string, unknown>,
): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.of("/community").to(`user:${userId}`).emit(eventName, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

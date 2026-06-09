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

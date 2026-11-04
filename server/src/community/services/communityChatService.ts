import { conversationsService } from "./communityChatService/conversations";
import { messagesService } from "./communityChatService/messages";
import { reactionsService } from "./communityChatService/reactions";

/**
 * Conversations and messages: sending, editing, reactions, receipts.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityChatService = {
  ...conversationsService,
  ...messagesService,
  ...reactionsService,
};

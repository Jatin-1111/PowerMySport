import { postsService } from "./communityQnaService/posts";
import { answersService } from "./communityQnaService/answers";
import { votingService } from "./communityQnaService/voting";

/**
 * Questions, answers, answer comments, accepted answers and voting.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityQnaService = {
  ...postsService,
  ...answersService,
  ...votingService,
};

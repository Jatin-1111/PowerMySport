import { WhatsAppConversation } from "../../client/models/WhatsAppConversation";
import { log as __rootLog } from "../../utils/logger";
import type { ChatToolContext } from "./chatToolsService";

const log = __rootLog.child("whatsappPendingAction");

/**
 * Doing something for a parent only after they say yes, whatever the something is.
 *
 * The model cannot be trusted to confirm on the parent's behalf, so confirming is not something it
 * decides. A tool that wants to act first *prepares* the action: it stores what it would do on the
 * chat and tells the model to ask the parent for a YES. `confirm_pending_action` then does it, and
 * only when (1) the parent's own latest message is a clear yes, (2) the prepared action is from an
 * earlier message and under 15 minutes old, and (3) the action's own checks pass. The action is
 * taken atomically, so two yeses do it once.
 *
 * Each kind of action (a development plan, a season-plan entry) registers an executor with the
 * rules that are its own: whether it is switched on, what it needs, and what it does.
 */

export const PENDING_MINUTES = 15;

export interface PendingAction {
  kind: string;
  /** Whatever the executor needs, already built and checked when it was prepared. */
  payload: Record<string, unknown>;
  /** The message count when it was prepared: it can only be confirmed on a later message. */
  turn: number;
  createdAt: Date;
}

export interface PendingExecutorContext {
  userId: string;
  phoneHash: string;
  now: Date;
}

/** What an executor reports: done, or not done and whether the parent can simply say yes again. */
export type ExecutorOutcome =
  { done: true; reply: unknown } | { done: false; reply: unknown; retry: boolean };

export interface PendingExecutor {
  /** Whether this kind is switched on. Checked again at confirm time. */
  enabled: () => boolean;
  /** What to say when it is not. */
  notEnabledReply: unknown;
  execute: (pending: PendingAction, context: PendingExecutorContext) => Promise<ExecutorOutcome>;
}

const executors = new Map<string, PendingExecutor>();

export function registerPendingExecutor(kind: string, executor: PendingExecutor): void {
  executors.set(kind, executor);
}

/** True while at least one kind of action is switched on. */
export const anyActionEnabled = (): boolean =>
  [...executors.values()].some((executor) => executor.enabled());

// ─── Is this message a yes? ──────────────────────────────────────────────────────────────

/** Words that say yes, in English, Hindi written in English letters, and Devanagari. */
const YES = new Set([
  "yes",
  "y",
  "yeah",
  "yep",
  "yup",
  "ok",
  "okay",
  "okey",
  "sure",
  "confirm",
  "confirmed",
  "proceed",
  "go",
  "ahead",
  "do",
  "haan",
  "han",
  "ha",
  "haa",
  "hanji",
  "ji",
  "theek",
  "thik",
  "chalega",
  "kar",
  "karo",
  "kardo",
  "krdo",
  "bana",
  "banao",
  "dijiye",
  "हाँ",
  "हां",
  "जी",
  "ठीक",
  "कर",
  "दो",
  "बना",
]);

/** Words that may surround a yes without changing it. Anything else makes the message not a yes. */
const FILLER = new Set([
  "please",
  "plz",
  "pls",
  "thanks",
  "thank",
  "you",
  "the",
  "plan",
  "it",
  "now",
  "then",
  "and",
  "hai",
  "to",
  "sir",
  "madam",
  "make",
  "create",
  "kindly",
  "है",
]);

/**
 * A clear yes and nothing else. Every word must be a yes or a harmless filler, so "yes but add
 * cricket", "what do you do" and "no" all fail and the assistant simply asks again.
 */
export function isAffirmative(text: string | undefined | null): boolean {
  const words = (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 7) return false;
  return words.every((word) => YES.has(word) || FILLER.has(word)) && words.some((w) => YES.has(w));
}

// ─── Preparing ──────────────────────────────────────────────────────────────────────────

/** Stores what would be done, replacing any earlier prepared action, and returns nothing. */
export async function storePendingAction(
  phoneHash: string,
  kind: string,
  payload: Record<string, unknown>,
  now: Date = new Date()
): Promise<void> {
  const conversation = await WhatsAppConversation.findOne({ phoneHash })
    .select("totalMessageCount")
    .lean();
  await WhatsAppConversation.updateOne(
    { phoneHash },
    {
      $set: {
        pendingAction: {
          kind,
          payload,
          turn: conversation?.totalMessageCount ?? 0,
          createdAt: now,
        },
      },
    },
    { upsert: true }
  );
}

// ─── Confirming ─────────────────────────────────────────────────────────────────────────

const NOT_ON = {
  available: false,
  instruction:
    "Doing this from WhatsApp is not switched on yet. Say so, and that they can do it on https://powermysport.com.",
} as const;

const NOT_LINKED = {
  available: false,
  reason: "number_not_linked",
  instruction:
    "This number is not tied to a PowerMySport account, so this cannot be done here. Say that plainly, and that signing in at https://powermysport.com lets them do it.",
} as const;

export async function confirmPendingAction(
  context: ChatToolContext | undefined,
  now: Date = new Date()
): Promise<unknown> {
  if (!anyActionEnabled()) return NOT_ON;
  if (!context?.userId || !context.phoneHash) return NOT_LINKED;
  const { userId, phoneHash } = context;

  // The parent's own words, not the model's say-so. Checked before anything is touched, so a
  // message that is not a yes leaves the prepared action waiting.
  if (!isAffirmative(context.userMessage)) {
    return {
      done: false,
      reason: "not_confirmed",
      instruction:
        "The parent's last message was not a clear yes, so nothing was done. Do not do it. Ask them to reply YES to go ahead, or to tell you what to change.",
    };
  }

  const conversation = await WhatsAppConversation.findOne({ phoneHash })
    .select("pendingAction totalMessageCount")
    .lean();
  const pending = conversation?.pendingAction as PendingAction | undefined;
  const fresh =
    pending && now.getTime() - new Date(pending.createdAt).getTime() <= PENDING_MINUTES * 60_000;
  if (!pending || !fresh) {
    return {
      done: false,
      reason: "nothing_pending",
      instruction:
        "There is nothing waiting for a yes, or it has timed out. Offer to set it up again with the tool that prepares it. Do not do anything now.",
    };
  }

  const executor = executors.get(pending.kind);
  if (!executor) {
    log.error(`no executor for pending action kind "${pending.kind}"`);
    return {
      done: false,
      reason: "unavailable",
      instruction: "That cannot be done just now. Say so briefly and do not try again.",
    };
  }
  if (!executor.enabled()) return executor.notEnabledReply;

  // An action can only be confirmed by a later message than the one that prepared it.
  if ((conversation?.totalMessageCount ?? 0) <= pending.turn) {
    return {
      done: false,
      reason: "not_confirmed",
      instruction:
        "It was only just prepared and the parent has not replied to it. Do not do it. Ask them to reply YES to go ahead.",
    };
  }

  // Take it, once. Only the request that wins this acts; a second yes finds nothing.
  const taken = await WhatsAppConversation.findOneAndUpdate(
    { phoneHash, "pendingAction.createdAt": pending.createdAt },
    { $unset: { pendingAction: "" } },
    { new: false }
  ).lean();
  if (!taken?.pendingAction) {
    return {
      done: false,
      reason: "already_handled",
      instruction:
        "That is already being done or was just done. Say it is on its way and do not start another.",
    };
  }

  // Nothing was done if the executor says so, so the action is put back for a retry on request.
  const putBack = async (): Promise<void> => {
    await WhatsAppConversation.updateOne(
      { phoneHash, pendingAction: { $exists: false } },
      {
        $set: {
          pendingAction: { ...pending, turn: conversation?.totalMessageCount ?? pending.turn },
        },
      }
    );
  };

  try {
    const outcome = await executor.execute(pending, { userId, phoneHash, now });
    if (!outcome.done && outcome.retry) await putBack();
    // One thing for the model to check, whatever the action: `done`.
    return { ...(outcome.reply as Record<string, unknown>), done: outcome.done };
  } catch (err) {
    log.error(`could not do a pending "${pending.kind}" action`, err);
    await putBack();
    return {
      done: false,
      reason: "unavailable",
      instruction:
        "It could not be done just now, and nothing was changed. Say so briefly, and that they can reply YES again in a minute to try once more.",
    };
  }
}

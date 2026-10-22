import crypto from "crypto";
import { WhatsAppConversation } from "../../client/models/WhatsAppConversation";
import { buildAssistantChatSystemPrompt } from "./assistantChatService";
import { streamAgenticChatResponse, type ChatHistoryMessage } from "./agenticChatService";
import { ASSISTANT_CHAT_TOOLS, type ChatToolContext } from "./chatToolsService";
import { findUserIdByPhone } from "./whatsappIdentity";
import { decrementDailyMessageCount, checkChatRateLimit } from "./chatRateLimitService";
import { retrieveRelevantChunks } from "./knowledgeRetrievalService";
import { withdrawConsentForPhone } from "./whatsappConsent";
import { OPT_OUT_REPLY, isOptOutMessage } from "./whatsappPilot";
import { clipReply, formatForWhatsApp } from "./whatsappFormat";
import type { InboundWhatsAppMessage } from "./whatsappService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappAssistant");

const MAX_INBOUND_CHARS = 1000;
/** WhatsApp rejects a text body over 4096 characters. */
const MAX_REPLY_CHARS = 3800;
/** Turns kept per conversation, and turns sent to the model as history. */
const STORED_MESSAGES = 20;
const HISTORY_MESSAGES = 12;

export const CHANNEL_ADDENDUM = `

---

## Channel: WhatsApp
You are replying inside WhatsApp, not on the website. Adjust everything above to fit:
- Plain text only. No markdown headings, tables or **double-asterisk** bold. A single *asterisk* pair for emphasis is fine, sparingly.
- Short. Aim for under 900 characters unless the parent asks for detail. One idea, then one question at most.
- Relative paths like /guidance do not work here. Always write the full link, e.g. https://powermysport.com/guidance
- Do not use markdown links. Put the bare URL on its own line.
- You are an AI assistant. If asked whether you are a person or a bot, say you are an AI assistant.
- Never ask for a child's medical details, ID numbers, payment details or passwords, and tell a parent not to send them here.
- Write fees in rupees with the symbol and the unit, for example ₹1,000 per session, never a bare number.
- If a parent wants to talk to a person, say the PowerMySport team can help. Offer to pass their question on, which needs their name and an email address, and also give https://powermysport.com/contact

## How to behave
- Never explain how you work inside: do not say which tool you used or "a different tool". If an earlier answer of yours was wrong or incomplete, say so in one short sentence, give the corrected answer, and move on.
- Use what the parent already told you in this chat (the child's name, the sport, the tournaments you just listed). Do not ask again for something they said. When they say "all of them", "that one" or "the first", it means what you listed last.
- Never suggest a tournament whose entries have closed. Tell the parent plainly if the only events left are closed, and offer to look for ones still open.`;

/** The number is tied to exactly one account, so the tools return that parent's own data. */
export const KNOWN_PARENT_ADDENDUM = `

## This parent is known
This WhatsApp number belongs to a PowerMySport account, and your tools return that parent's own children, linked rankings and tournament verdicts. So:
- Do not ask which sport or which child when the tools can tell you. Call the tool first.
- Never say you cannot see their account, ranking or children. If a tool returns nothing personal, say that no ranking is linked for that child yet and point to https://powermysport.com/planner.
- Say the child's first name, nothing else from the account.`;

/** No account, or more than one, holds this number, so nothing personal is available. */
export const UNKNOWN_NUMBER_ADDENDUM = `

## This parent is not identified
This WhatsApp number is not tied to a single PowerMySport account, so your tools return public data only and you cannot see anyone's children or rankings. If they ask for their child's ranking or a list made for their child, say plainly that this number is not linked to an account, and that signing in at https://powermysport.com/planner shows it. Do not claim the information is private or that you are unable to look it up.`;

const FALLBACK_REPLY =
  "Sorry, I couldn't put an answer together just now. Please try again in a minute, or ask on https://powermysport.com/ask";
const UNSUPPORTED_REPLY = "I can only read text messages for now. Could you type your question?";
const DAILY_LIMIT_REPLY =
  "You've reached today's limit of messages here. Please message again tomorrow, or keep going on https://powermysport.com/ask";

/**
 * Keyed hash of a phone number, used as the conversation key. HMAC with a
 * domain-separated key so the hash cannot be matched against hashes made for
 * any other purpose. `WHATSAPP_PHONE_HASH_KEY` can pin its own key; otherwise
 * the JWT secret (already mandatory) is used.
 */
export function hashPhone(phone: string): string {
  const key = process.env.WHATSAPP_PHONE_HASH_KEY || process.env.JWT_SECRET;
  if (!key) throw new Error("Missing WHATSAPP_PHONE_HASH_KEY or JWT_SECRET");
  return crypto.createHmac("sha256", key).update(`whatsapp-phone:${phone}`).digest("hex");
}

export type ReplyGenerator = (
  systemPrompt: string,
  history: ChatHistoryMessage[],
  userMessage: string,
  toolContext?: ChatToolContext
) => AsyncIterable<string>;

const defaultGenerator: ReplyGenerator = (systemPrompt, history, userMessage, toolContext) =>
  streamAgenticChatResponse(systemPrompt, history, userMessage, ASSISTANT_CHAT_TOOLS, toolContext);

/**
 * Whose number this is, as far as the account is known. A lookup failure is the same as
 * no match: the parent still gets an answer from public data.
 */
async function identify(phone: string): Promise<ChatToolContext> {
  try {
    const userId = await findUserIdByPhone(phone);
    return userId ? { userId } : {};
  } catch (err) {
    log.error("could not look up the account for a WhatsApp number", err);
    return {};
  }
}

export interface WhatsAppAnswer {
  reply: string;
  /** No earlier conversation was found for this number, so the parent has not seen the notice. */
  firstContact: boolean;
}

/**
 * Works out the reply to one inbound WhatsApp message and records the turn.
 * Always returns text to send: a failure becomes an apology rather than
 * silence, because a parent staring at an unanswered message is the worst
 * outcome here.
 */
export async function answerWhatsAppMessage(
  message: InboundWhatsAppMessage,
  generate: ReplyGenerator = defaultGenerator
): Promise<WhatsAppAnswer> {
  const text = message.text?.trim();
  if (!text) return { reply: UNSUPPORTED_REPLY, firstContact: false };

  const userMessage = text.slice(0, MAX_INBOUND_CHARS);
  const phoneHash = hashPhone(message.from);

  // "STOP" and the like delete the chat. Checked before the daily limit so a parent
  // who has used their messages can still take their data back.
  if (isOptOutMessage(text)) {
    await WhatsAppConversation.deleteOne({ phoneHash });
    // Also off the list for booking messages. A failure here must not stop the reply.
    await withdrawConsentForPhone(message.from).catch((err) =>
      log.error("could not withdraw WhatsApp consent", err)
    );
    return { reply: OPT_OUT_REPLY, firstContact: false };
  }
  // Not the website's limiter key: a WhatsApp number is not a user id.
  const limiterKey = `wa:${phoneHash}`;

  // Lifetime cap is passed as 0 on purpose. On the website a chat is a bounded
  // session, but here the conversation is one thread per number with no "new
  // chat", so a lifetime cap would lock a parent out for good.
  const limit = await checkChatRateLimit(limiterKey, 0, {
    dailyReached: DAILY_LIMIT_REPLY,
    lifetimeReached: DAILY_LIMIT_REPLY,
  });
  if (!limit.ok) return { reply: limit.message, firstContact: false };

  try {
    const conversation = await WhatsAppConversation.findOne({ phoneHash })
      .select("messages")
      .lean();
    const firstContact = !conversation;
    const history: ChatHistoryMessage[] = (conversation?.messages ?? [])
      .slice(-HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    const toolContext = await identify(message.from);
    const chunks = await retrieveRelevantChunks(userMessage);
    const systemPrompt =
      buildAssistantChatSystemPrompt(ASSISTANT_CHAT_TOOLS, chunks) +
      CHANNEL_ADDENDUM +
      (toolContext.userId ? KNOWN_PARENT_ADDENDUM : UNKNOWN_NUMBER_ADDENDUM);

    let reply = "";
    for await (const piece of generate(systemPrompt, history, userMessage, toolContext)) {
      reply += piece;
    }
    reply = reply.trim();
    if (!reply) throw new Error("empty reply from the model");
    // What is stored and sent is the formatted text, so the history the model sees next time
    // matches what the parent actually read.
    reply = clipReply(formatForWhatsApp(reply), MAX_REPLY_CHARS);

    const now = new Date();
    // One atomic update, so two messages arriving together cannot overwrite
    // each other's turns.
    await WhatsAppConversation.updateOne(
      { phoneHash },
      {
        $push: {
          messages: {
            $each: [
              { role: "user", content: userMessage, createdAt: now },
              { role: "assistant", content: reply, createdAt: now },
            ],
            $slice: -STORED_MESSAGES,
          },
        },
        $inc: { totalMessageCount: 1 },
      },
      { upsert: true }
    );

    return { reply, firstContact };
  } catch (err) {
    log.error("could not produce a reply", err);
    await decrementDailyMessageCount(limiterKey);
    return { reply: FALLBACK_REPLY, firstContact: false };
  }
}

/** The reply text alone, for callers that do not need to know whether this was a first message. */
export async function replyToWhatsAppMessage(
  message: InboundWhatsAppMessage,
  generate: ReplyGenerator = defaultGenerator
): Promise<string> {
  return (await answerWhatsAppMessage(message, generate)).reply;
}

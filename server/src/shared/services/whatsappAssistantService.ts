import crypto from "crypto";
import { WhatsAppConversation } from "../../client/models/WhatsAppConversation";
import { buildAssistantChatSystemPrompt } from "./assistantChatService";
import { streamAgenticChatResponse, type ChatHistoryMessage } from "./agenticChatService";
import { ASSISTANT_CHAT_TOOLS } from "./chatToolsService";
import { decrementDailyMessageCount, checkChatRateLimit } from "./chatRateLimitService";
import { retrieveRelevantChunks } from "./knowledgeRetrievalService";
import type { InboundWhatsAppMessage } from "./whatsappService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappAssistant");

const MAX_INBOUND_CHARS = 1000;
/** WhatsApp rejects a text body over 4096 characters. */
const MAX_REPLY_CHARS = 3800;
/** Turns kept per conversation, and turns sent to the model as history. */
const STORED_MESSAGES = 20;
const HISTORY_MESSAGES = 12;

const CHANNEL_ADDENDUM = `

---

## Channel: WhatsApp
You are replying inside WhatsApp, not on the website. Adjust everything above to fit:
- Plain text only. No markdown headings, tables or **double-asterisk** bold. A single *asterisk* pair for emphasis is fine, sparingly.
- Short. Aim for under 900 characters unless the parent asks for detail. One idea, then one question at most.
- Relative paths like /guidance do not work here. Always write the full link, e.g. https://powermysport.com/guidance
- Do not use markdown links. Put the bare URL on its own line.`;

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
  userMessage: string
) => AsyncIterable<string>;

const defaultGenerator: ReplyGenerator = (systemPrompt, history, userMessage) =>
  streamAgenticChatResponse(systemPrompt, history, userMessage, ASSISTANT_CHAT_TOOLS);

/**
 * Works out the reply to one inbound WhatsApp message and records the turn.
 * Always returns text to send: a failure becomes an apology rather than
 * silence, because a parent staring at an unanswered message is the worst
 * outcome here.
 */
export async function replyToWhatsAppMessage(
  message: InboundWhatsAppMessage,
  generate: ReplyGenerator = defaultGenerator
): Promise<string> {
  const text = message.text?.trim();
  if (!text) return UNSUPPORTED_REPLY;

  const userMessage = text.slice(0, MAX_INBOUND_CHARS);
  const phoneHash = hashPhone(message.from);
  // Not the website's limiter key: a WhatsApp number is not a user id.
  const limiterKey = `wa:${phoneHash}`;

  // Lifetime cap is passed as 0 on purpose. On the website a chat is a bounded
  // session, but here the conversation is one thread per number with no "new
  // chat", so a lifetime cap would lock a parent out for good.
  const limit = await checkChatRateLimit(limiterKey, 0, {
    dailyReached: DAILY_LIMIT_REPLY,
    lifetimeReached: DAILY_LIMIT_REPLY,
  });
  if (!limit.ok) return limit.message;

  try {
    const conversation = await WhatsAppConversation.findOne({ phoneHash })
      .select("messages")
      .lean();
    const history: ChatHistoryMessage[] = (conversation?.messages ?? [])
      .slice(-HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    const chunks = await retrieveRelevantChunks(userMessage);
    const systemPrompt = buildAssistantChatSystemPrompt(chunks) + CHANNEL_ADDENDUM;

    let reply = "";
    for await (const piece of generate(systemPrompt, history, userMessage)) {
      reply += piece;
    }
    reply = reply.trim();
    if (!reply) throw new Error("empty reply from the model");
    if (reply.length > MAX_REPLY_CHARS) reply = `${reply.slice(0, MAX_REPLY_CHARS - 1).trimEnd()}…`;

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

    return reply;
  } catch (err) {
    log.error("could not produce a reply", err);
    await decrementDailyMessageCount(limiterKey);
    return FALLBACK_REPLY;
  }
}

// The Claude chat loop, with the SDK client replaced by a fake: what is sent, how tool calls are
// run and returned, what happens at the cap, on a refusal and on errors. No network, no key.
import assert from "node:assert/strict";
import test from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { AiBusyError } from "../shared/services/aiErrors";
import {
  DEFAULT_CLAUDE_MODEL,
  streamClaudeChatResponse,
  type ClaudeClientLike,
  type ClaudeUsage,
} from "../shared/services/claudeChatService";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Params = Record<string, any>;

const usage = { input_tokens: 100, output_tokens: 20 };
const reply = (content: any[], stop_reason = "end_turn", extra: Params = {}) =>
  ({ content, stop_reason, usage: { ...usage, ...extra } }) as unknown as Anthropic.Message;
const text = (t: string) => ({ type: "text", text: t });
const toolUse = (id: string, name: string, input: Params = {}) => ({
  type: "tool_use",
  id,
  name,
  input,
});

/** A client that answers each request with the next canned reply, and records what it was sent. */
function fakeClient(replies: Array<Anthropic.Message | Error>): {
  client: ClaudeClientLike;
  sent: Params[];
} {
  const sent: Params[] = [];
  let index = 0;
  return {
    sent,
    client: {
      messages: {
        async create(params: Params) {
          // Snapshot the messages: the loop keeps appending to the same array.
          sent.push({ ...params, messages: JSON.parse(JSON.stringify(params.messages)) });
          const next = replies[Math.min(index, replies.length - 1)]!;
          index += 1;
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
}

const collect = async (stream: AsyncGenerator<string>) => {
  let out = "";
  for await (const piece of stream) out += piece;
  return out;
};

const tool = (name: string, execute: (args: Params, ctx?: any) => Promise<unknown>) => ({
  name,
  description: `does ${name}`,
  summary: name,
  example: name,
  parametersJsonSchema: { type: "object", properties: { q: { type: "string" } } },
  execute,
});

test("sends the prompt, history and tools the way the model expects, and returns its text", async () => {
  const { client, sent } = fakeClient([reply([text("Hello parent.")])]);
  const answer = await collect(
    streamClaudeChatResponse(
      "SYSTEM PROMPT",
      [
        { role: "user", content: "earlier question" },
        { role: "assistant", content: "earlier answer" },
      ],
      "my question",
      [tool("search_experts", async () => ({}))] as any,
      {},
      { client }
    )
  );

  assert.equal(answer, "Hello parent.");
  const request = sent[0]!;
  assert.equal(request.model, DEFAULT_CLAUDE_MODEL);
  assert.equal(request.output_config.effort, "low");
  assert.deepEqual(request.system, [
    { type: "text", text: "SYSTEM PROMPT", cache_control: { type: "ephemeral" } },
  ]);
  assert.deepEqual(request.messages, [
    { role: "user", content: "earlier question" },
    { role: "assistant", content: "earlier answer" },
    { role: "user", content: "my question" },
  ]);
  assert.equal(request.tools[0].name, "search_experts");
  assert.deepEqual(request.tools[0].input_schema, {
    type: "object",
    properties: { q: { type: "string" } },
  });
  // The newer models reject both of these.
  assert.equal("temperature" in request, false);
  assert.equal("tool_choice" in request, false);
});

test("runs a tool the model asks for and returns its result, dropping the words before the call", async () => {
  const seen: Array<{ args: Params; ctx: any }> = [];
  const { client, sent } = fakeClient([
    reply(
      [
        { type: "thinking", thinking: "", signature: "sig" },
        text("Let me check."),
        toolUse("t1", "search_experts", { q: "tennis" }),
      ],
      "tool_use"
    ),
    reply([text("Jatin is in Chandigarh.")]),
  ]);
  const answer = await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "tennis expert?",
      [
        tool("search_experts", async (args, ctx) => {
          seen.push({ args, ctx });
          return { experts: ["Jatin"] };
        }),
      ] as any,
      { phoneHash: "h1" },
      { client }
    )
  );

  assert.equal(answer, "Jatin is in Chandigarh.", "only the final answer reaches the parent");
  assert.deepEqual(seen, [{ args: { q: "tennis" }, ctx: { phoneHash: "h1" } }]);

  const second = sent[1]!.messages;
  assert.equal(second.length, 3);
  assert.equal(second[1].role, "assistant");
  assert.equal(
    second[1].content[0].type,
    "thinking",
    "the whole turn goes back, thinking included"
  );
  assert.deepEqual(second[2], {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ experts: ["Jatin"] }) },
    ],
  });
});

test("several tool calls in one turn run together and come back in one message", async () => {
  const order: string[] = [];
  const { client, sent } = fakeClient([
    reply([toolUse("a", "one"), toolUse("b", "two")], "tool_use"),
    reply([text("done")]),
  ]);
  await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "go",
      [
        tool("one", async () => {
          order.push("one");
          return 1;
        }),
        tool("two", async () => {
          order.push("two");
          return 2;
        }),
      ] as any,
      {},
      { client }
    )
  );
  assert.deepEqual(order.sort(), ["one", "two"]);
  const results = sent[1]!.messages[2].content;
  assert.deepEqual(
    results.map((r: Params) => r.tool_use_id),
    ["a", "b"]
  );
});

test("a tool that fails, or does not exist, is reported to the model as an error, not thrown", async () => {
  const { client, sent } = fakeClient([
    reply([toolUse("a", "breaks"), toolUse("b", "nope")], "tool_use"),
    reply([text("Sorry, I could not look that up.")]),
  ]);
  const answer = await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "go",
      [
        tool("breaks", async () => {
          throw new Error("db down");
        }),
      ] as any,
      {},
      { client }
    )
  );
  assert.equal(answer, "Sorry, I could not look that up.");
  const [failed, unknown] = sent[1]!.messages[2].content;
  assert.equal(failed.is_error, true);
  assert.match(failed.content, /db down/);
  assert.equal(unknown.is_error, true);
  assert.match(unknown.content, /Unknown tool: nope/);
});

test("after three rounds of tool calls it asks once more with tools switched off", async () => {
  const { client, sent } = fakeClient([
    reply([toolUse("a", "loop")], "tool_use"),
    reply([toolUse("b", "loop")], "tool_use"),
    reply([toolUse("c", "loop")], "tool_use"),
    reply([text("Here is what I found.")]),
  ]);
  const answer = await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "go",
      [tool("loop", async () => "x")] as any,
      {},
      { client }
    )
  );
  assert.equal(answer, "Here is what I found.");
  assert.equal(sent.length, 4);
  assert.equal("tool_choice" in sent[2]!, false);
  assert.deepEqual(sent[3]!.tool_choice, { type: "none" });
});

test("a refusal gives no text, so the caller's own fallback reply is used", async () => {
  const { client } = fakeClient([reply([text("partial")], "refusal")]);
  assert.equal(await collect(streamClaudeChatResponse("sys", [], "q", [], {}, { client })), "");
});

test("a rate limit or overload becomes the shared 'busy' error; other errors pass through", async () => {
  const rateLimited = new Anthropic.RateLimitError(
    429,
    { type: "error", error: { type: "rate_limit_error", message: "slow down" } },
    "slow down",
    new Headers()
  );
  await assert.rejects(
    collect(
      streamClaudeChatResponse("sys", [], "q", [], {}, { client: fakeClient([rateLimited]).client })
    ),
    (err: unknown) => err instanceof AiBusyError
  );

  const badRequest = new Error("invalid_request_error: bad");
  await assert.rejects(
    collect(
      streamClaudeChatResponse("sys", [], "q", [], {}, { client: fakeClient([badRequest]).client })
    ),
    (err: unknown) => err === badRequest
  );
});

test("reports what each request used, for cost reporting", async () => {
  const used: ClaudeUsage[] = [];
  const { client } = fakeClient([
    reply([toolUse("a", "t")], "tool_use", {
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 50,
    }),
    reply([text("ok")]),
  ]);
  await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "q",
      [tool("t", async () => 1)] as any,
      {},
      {
        client,
        onUsage: (u) => used.push(u),
      }
    )
  );
  assert.equal(used.length, 2);
  assert.deepEqual(used[0], {
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 900,
    cacheWriteTokens: 50,
  });
  assert.equal(used[1]!.cacheReadTokens, 0);
});

test("uses the model and effort it is given", async () => {
  const { client, sent } = fakeClient([reply([text("ok")])]);
  await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "q",
      [],
      {},
      {
        client,
        model: "claude-sonnet-5-5",
        effort: "medium",
      }
    )
  );
  assert.equal(sent[0]!.model, "claude-sonnet-5-5");
  assert.equal(sent[0]!.output_config.effort, "medium");
  assert.equal("tools" in sent[0]!, false, "no tools block when there are no tools");
});

test("without a key and without a client it says what is missing", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      collect(streamClaudeChatResponse("sys", [], "q")),
      /Missing ANTHROPIC_API_KEY/
    );
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("an empty answer after tool results is asked for once more, in the same user message", async () => {
  const { client, sent } = fakeClient([
    reply([toolUse("a", "record_enquiry")], "tool_use"),
    reply([], "end_turn"),
    reply([text("Jatin is in Chandigarh.")]),
  ]);
  const answer = await collect(
    streamClaudeChatResponse(
      "sys",
      [],
      "tennis expert?",
      [tool("record_enquiry", async () => ({ recorded: true }))] as any,
      {},
      { client }
    )
  );

  assert.equal(answer, "Jatin is in Chandigarh.");
  assert.equal(sent.length, 3);
  const retry = sent[2]!.messages.at(-1);
  assert.equal(retry.role, "user");
  assert.equal(retry.content[0].type, "tool_result", "the tool results stay first");
  assert.deepEqual(retry.content.at(-1), {
    type: "text",
    text: "Now write your answer to the parent.",
  });
});

test("it asks only once: a model that stays silent gives no text, and the caller's fallback reply is used", async () => {
  const { client, sent } = fakeClient([
    reply([toolUse("a", "t")], "tool_use"),
    reply([], "end_turn"),
    reply([], "end_turn"),
  ]);
  const answer = await collect(
    streamClaudeChatResponse("sys", [], "q", [tool("t", async () => 1)] as any, {}, { client })
  );
  assert.equal(answer, "");
  assert.equal(sent.length, 3);
});

test("a plain empty answer with no tool results is not retried", async () => {
  const { client, sent } = fakeClient([reply([], "end_turn")]);
  assert.equal(await collect(streamClaudeChatResponse("sys", [], "q", [], {}, { client })), "");
  assert.equal(sent.length, 1);
});

/* eslint-disable @typescript-eslint/no-var-requires */
// What happens when the AI provider is out of quota or overloaded.
//
// Every AI feature shares one Gemini key, so quota exhaustion takes them all
// down together. The chat paths used to try another model only on a 404: a 429
// was re-thrown at once and the provider's raw JSON error text was written
// straight into the parent's chat. These tests pin the new behaviour: fail over
// to the next model when it is safe, never show provider text, and never fail
// over once the parent has seen words or a tool has run.
process.env.GEMINI_API_KEY = "test-key";
process.env.REDIS_ENABLED = "false";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, afterEach, beforeEach, describe, it, mock } = require("node:test");

const genai = require("@google/genai");
const {
  AI_BUSY_MESSAGE,
  AI_FAILED_MESSAGE,
  AiBusyError,
  canTryNextModel,
  isBusyError,
  parentSafeAiMessage,
} = require("../shared/services/aiErrors");
const { streamAgenticChatResponse } = require("../shared/services/agenticChatService");
const { streamGuidanceChatResponse } = require("../shared/services/guidanceChatService");
const { streamChatAndPersist } = require("../shared/services/chatStreamService");
const redis = require("../config/redis").default;

// A realistic provider failure: long, JSON, and naming the project and the quota metric.
const RAW_QUOTA_TEXT =
  '{"error":{"code":429,"message":"You exceeded your current quota. Quota exceeded for metric: ' +
  'generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash","status":"RESOURCE_EXHAUSTED"}}';

const quotaError = () => Object.assign(new Error(RAW_QUOTA_TEXT), { status: 429 });
const overloadedError = () =>
  Object.assign(new Error("The model is overloaded. Please try again later."), { status: 503 });
const badRequestError = () =>
  Object.assign(new Error("Invalid argument: bad request"), { status: 400 });
const notFoundError = () => Object.assign(new Error("models/x is not found"), { status: 404 });

type Step =
  | { kind: "ok"; text?: string }
  | { kind: "throw"; error: () => Error }
  | { kind: "text-then-throw"; text: string; error: () => Error }
  | { kind: "tool-call" };

/** Per model, what the fake provider does on a streamed call. */
let plan: Record<string, Step> = {};
/** Per model, what a non-streamed call does (the tool-resolution hops). */
let planNonStreamed: Record<string, Step> = {};
let streamedModels: string[] = [];

const MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"] as const;

class FakeGenAI {
  models = {
    generateContentStream: async ({ model }: { model: string }) => {
      streamedModels.push(model);
      const step = plan[model] ?? { kind: "throw", error: quotaError };
      if (step.kind === "throw") throw step.error();
      return (async function* () {
        if (step.kind === "text-then-throw") {
          yield { text: step.text };
          throw step.error();
        }
        if (step.kind === "tool-call") {
          yield {
            functionCalls: [{ name: "lookup", args: {} }],
            candidates: [{ content: { role: "model", parts: [] } }],
          };
          return;
        }
        yield { text: step.text ?? "answer" };
      })();
    },
    generateContent: async ({ model }: { model: string }) => {
      const step = planNonStreamed[model] ?? { kind: "ok" };
      if (step.kind === "throw") throw step.error();
      return { functionCalls: undefined, candidates: [] };
    },
  };
}

const drain = async (generator: AsyncGenerator<string>): Promise<string> => {
  let out = "";
  for await (const piece of generator) out += piece;
  return out;
};

beforeEach(() => {
  plan = {};
  planNonStreamed = {};
  streamedModels = [];
  mock.method(genai, "GoogleGenAI", FakeGenAI);
});

afterEach(() => mock.restoreAll());

after(() => redis.disconnect());

describe("error classification", () => {
  it("treats 404, quota and overload as worth trying on the next model", () => {
    assert.equal(canTryNextModel(notFoundError()), true);
    assert.equal(canTryNextModel(quotaError()), true);
    assert.equal(canTryNextModel(overloadedError()), true);
  });

  it("does not retry a bad request on another model", () => {
    assert.equal(canTryNextModel(badRequestError()), false);
  });

  it("recognises a quota error from the message alone when there is no status", () => {
    assert.equal(isBusyError(new Error("RESOURCE_EXHAUSTED: quota")), true);
  });

  it("never lets provider text reach a parent", () => {
    assert.equal(parentSafeAiMessage(quotaError()), AI_BUSY_MESSAGE);
    assert.equal(parentSafeAiMessage(overloadedError()), AI_BUSY_MESSAGE);
    assert.equal(parentSafeAiMessage(badRequestError()), AI_FAILED_MESSAGE);
    assert.ok(!AI_BUSY_MESSAGE.includes("quota"));
    assert.ok(!AI_FAILED_MESSAGE.includes("Invalid"));
  });

  it("makes AiBusyError a 503 with the parent-safe message", () => {
    const error = new AiBusyError(quotaError());
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, AI_BUSY_MESSAGE);
  });
});

describe("assistant chat (agentic)", () => {
  it("moves to the next model when the first is out of quota", async () => {
    plan[MODELS[0]] = { kind: "throw", error: quotaError };
    plan[MODELS[1]] = { kind: "ok", text: "second model answer" };
    const out = await drain(streamAgenticChatResponse("system", [], "hello", []));
    assert.equal(out, "second model answer");
    assert.deepEqual(streamedModels, [MODELS[0], MODELS[1]]);
  });

  it("still moves on when a model is missing (404)", async () => {
    plan[MODELS[0]] = { kind: "throw", error: notFoundError };
    plan[MODELS[1]] = { kind: "ok", text: "fine" };
    assert.equal(await drain(streamAgenticChatResponse("s", [], "hi", [])), "fine");
  });

  it("moves on when a model is overloaded", async () => {
    plan[MODELS[0]] = { kind: "throw", error: overloadedError };
    plan[MODELS[1]] = { kind: "ok", text: "fine" };
    assert.equal(await drain(streamAgenticChatResponse("s", [], "hi", [])), "fine");
  });

  it("raises a busy error with a plain message when every model is out of quota", async () => {
    await assert.rejects(drain(streamAgenticChatResponse("s", [], "hi", [])), (error: any) => {
      assert.ok(error instanceof AiBusyError);
      assert.equal(error.message, AI_BUSY_MESSAGE);
      assert.ok(!error.message.includes("generativelanguage"));
      return true;
    });
    assert.deepEqual(streamedModels, MODELS);
  });

  it("does not fail over once the parent has seen text, so answers are never glued together", async () => {
    plan[MODELS[0]] = { kind: "text-then-throw", text: "Hello", error: quotaError };
    plan[MODELS[1]] = { kind: "ok", text: " SECOND" };
    const seen: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const piece of streamAgenticChatResponse("s", [], "hi", [])) seen.push(piece);
      })(),
      AiBusyError
    );
    assert.deepEqual(seen, ["Hello"]);
    assert.deepEqual(streamedModels, [MODELS[0]]);
  });

  it("does not fail over after a tool has run, so a tool never runs twice", async () => {
    let toolRuns = 0;
    const tool = {
      name: "lookup",
      description: "d",
      parametersJsonSchema: { type: "object", properties: {} },
      execute: async () => {
        toolRuns += 1;
        return { ok: true };
      },
    };
    plan[MODELS[0]] = { kind: "tool-call" };
    planNonStreamed[MODELS[0]] = { kind: "throw", error: quotaError };
    plan[MODELS[1]] = { kind: "tool-call" };
    await assert.rejects(drain(streamAgenticChatResponse("s", [], "hi", [tool])), AiBusyError);
    assert.equal(toolRuns, 1);
    assert.deepEqual(streamedModels, [MODELS[0]]);
  });

  it("passes a genuine bug through instead of calling it 'busy'", async () => {
    plan[MODELS[0]] = { kind: "throw", error: badRequestError };
    await assert.rejects(drain(streamAgenticChatResponse("s", [], "hi", [])), /bad request/);
    assert.deepEqual(streamedModels, [MODELS[0]]);
  });
});

describe("guidance and roadmap chat", () => {
  it("moves to the next model when the first is out of quota", async () => {
    plan[MODELS[0]] = { kind: "throw", error: quotaError };
    plan[MODELS[1]] = { kind: "ok", text: "second" };
    assert.equal(await drain(streamGuidanceChatResponse("s", [], "hi")), "second");
  });

  it("raises a busy error when every model is out of quota", async () => {
    await assert.rejects(drain(streamGuidanceChatResponse("s", [], "hi")), AiBusyError);
    assert.deepEqual(streamedModels, MODELS);
  });

  it("does not fail over after text has been sent", async () => {
    plan[MODELS[0]] = { kind: "text-then-throw", text: "Hi", error: quotaError };
    plan[MODELS[1]] = { kind: "ok", text: "X" };
    await assert.rejects(drain(streamGuidanceChatResponse("s", [], "hi")), AiBusyError);
    assert.deepEqual(streamedModels, [MODELS[0]]);
  });
});

describe("what the parent's chat stream carries on failure", () => {
  const fakeResponse = () => {
    const written: string[] = [];
    return {
      written,
      setHeader: () => undefined,
      write: (chunk: string) => written.push(chunk),
      end: () => undefined,
    };
  };

  it("sends a plain sentence, never the provider's JSON", async () => {
    // Every model out of quota: the realistic case behind the "credits depleted" reports.
    const res = fakeResponse();
    const session = { messages: [], totalMessageCount: 0, save: async () => undefined };
    await streamChatAndPersist(res as any, "user-1", session, "system", "hello");

    const payload = res.written.join("");
    assert.ok(payload.includes(AI_BUSY_MESSAGE));
    assert.ok(!payload.includes("generativelanguage"));
    assert.ok(!payload.includes("RESOURCE_EXHAUSTED"));
    assert.ok(!payload.includes("free_tier"));
    // A failed turn is not saved.
    assert.equal(session.messages.length, 0);
  });
});

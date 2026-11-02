// Which model answers a WhatsApp message: Claude when a key is set, Gemini otherwise, and Gemini
// as the backup when Claude is busy, unless a tool has already run. Both backends are fakes.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { AiBusyError } from "../shared/services/aiErrors";
import {
  createReplyGenerator,
  type GeneratorBackends,
} from "../shared/services/whatsappAssistantService";
import type { ChatToolDefinition } from "../shared/services/chatToolsService";

const saved = {
  key: process.env.ANTHROPIC_API_KEY,
  provider: process.env.WHATSAPP_AI_PROVIDER,
};
afterEach(() => {
  for (const [name, value] of [
    ["ANTHROPIC_API_KEY", saved.key],
    ["WHATSAPP_AI_PROVIDER", saved.provider],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const tool = (name: string, ran: string[]): ChatToolDefinition =>
  ({
    name,
    description: name,
    summary: name,
    example: name,
    parametersJsonSchema: { type: "object", properties: {} },
    execute: async () => {
      ran.push(name);
      return {};
    },
  }) as ChatToolDefinition;

type Script = (tools: ChatToolDefinition[]) => Promise<string>;

/** Backends that record who was asked; `claude` runs `script` with the tools it was given. */
function backends(script: Script): { backends: GeneratorBackends; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    backends: {
      claude: async function* (_s, _h, _m, tools) {
        asked.push("claude");
        yield await script(tools ?? []);
      },
      gemini: async function* () {
        asked.push("gemini");
        yield "from gemini";
      },
    },
  };
}

const collect = async (stream: AsyncIterable<string>) => {
  let out = "";
  for await (const piece of stream) out += piece;
  return out;
};

const generate = (b: GeneratorBackends, tools: ChatToolDefinition[] = []) =>
  collect(createReplyGenerator(b, tools)("system", [], "hello", {}));

test("with no Anthropic key, Gemini answers and Claude is never asked", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { backends: b, asked } = backends(async () => "from claude");
  assert.equal(await generate(b), "from gemini");
  assert.deepEqual(asked, ["gemini"]);
});

test("with a key, Claude answers", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.WHATSAPP_AI_PROVIDER;
  const { backends: b, asked } = backends(async () => "from claude");
  assert.equal(await generate(b), "from claude");
  assert.deepEqual(asked, ["claude"]);
});

test("WHATSAPP_AI_PROVIDER=gemini keeps Gemini even with a key", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.WHATSAPP_AI_PROVIDER = "gemini";
  const { backends: b, asked } = backends(async () => "from claude");
  assert.equal(await generate(b), "from gemini");
  assert.deepEqual(asked, ["gemini"]);
});

test("when Claude is busy before any tool ran, Gemini answers", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { backends: b, asked } = backends(async () => {
    throw new AiBusyError(new Error("429"));
  });
  assert.equal(await generate(b), "from gemini");
  assert.deepEqual(asked, ["claude", "gemini"]);
});

test("when Claude is busy after a tool ran, nothing is run twice: the error goes up", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const ran: string[] = [];
  const { backends: b, asked } = backends(async (tools) => {
    await tools[0]!.execute({}, {});
    throw new AiBusyError(new Error("529"));
  });
  await assert.rejects(generate(b, [tool("get_my_children", ran)]), AiBusyError);
  assert.deepEqual(ran, ["get_my_children"]);
  assert.deepEqual(asked, ["claude"]);
});

test("a Claude error that is not about load (a bad key) is not hidden by Gemini", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { backends: b, asked } = backends(async () => {
    throw new Error("401 invalid x-api-key");
  });
  await assert.rejects(generate(b), /401/);
  assert.deepEqual(asked, ["claude"]);
});

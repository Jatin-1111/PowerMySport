// The assistant's evaluation harness and the guard that its prompt and its tools agree.
// Nothing here calls a model: a fake generator stands in, so what is pinned is the scoring
// rules, the stubbed tools and the formatter wiring, and that the system prompt describes
// exactly the tools the assistant is given.
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const {
  buildAssistantChatSystemPrompt,
  buildToolsSection,
} = require("../shared/services/assistantChatService");
const { ASSISTANT_CASES, validateCases } = require("../evals/assistant/cases");
const { runCase, staticChecks } = require("../evals/assistant/harness");
const { scoreCase } = require("../evals/assistant/score");

type Tool = {
  name: string;
  summary: string;
  example: string;
  description: string;
  promptNote?: string;
  parametersJsonSchema: { properties?: Record<string, unknown>; required?: string[] };
};
const tools: Tool[] = ASSISTANT_CHAT_TOOLS;

describe("the tool registry", () => {
  it("gives every tool a name, a summary, an example and a description", () => {
    assert.ok(tools.length > 0);
    for (const tool of tools) {
      assert.ok(tool.name.trim(), "name");
      assert.ok(tool.summary.trim(), `${tool.name} needs a summary`);
      assert.ok(tool.example.trim(), `${tool.name} needs an example question`);
      assert.ok(tool.description.trim().length > 40, `${tool.name} needs a real description`);
    }
  });

  it("has unique names and schemas whose required fields exist", () => {
    assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
    for (const tool of tools) {
      const properties = Object.keys(tool.parametersJsonSchema.properties ?? {});
      for (const required of tool.parametersJsonSchema.required ?? []) {
        assert.ok(properties.includes(required), `${tool.name} requires unknown field ${required}`);
      }
    }
  });
});

describe("the system prompt and the registry", () => {
  it("agree: no mismatches between what the prompt says and what the assistant has", () => {
    assert.deepEqual(staticChecks(tools), []);
  });

  it("describes every tool, with its summary and example, in the tools section", () => {
    const section = buildToolsSection(tools);
    for (const tool of tools) {
      assert.ok(section.includes(`- ${tool.name}: ${tool.summary}.`), `${tool.name} listed`);
      assert.ok(section.includes(`"${tool.example}"`), `${tool.name} example`);
    }
  });

  it("carries a tool's own note, so the expert tool still points to /experts and never /booking", () => {
    const section = buildToolsSection(tools);
    assert.match(
      section,
      /search_experts: Its results are 1:1 expert consultations, not regular coaching/
    );
    assert.match(section, /regular coaching is coming soon/);
    assert.match(section, /never to \/booking/);
  });

  it("is built from the tools it is given: a tool added appears, a tool removed disappears", () => {
    const extra = {
      name: "lookup_scholarships",
      summary: "find scholarships for young athletes",
      example: "any scholarships for a U-14 tennis player",
      description: "x".repeat(60),
      parametersJsonSchema: { type: "object" },
      execute: async () => ({}),
    };
    assert.match(buildAssistantChatSystemPrompt([...tools, extra]), /lookup_scholarships/);
    assert.doesNotMatch(buildAssistantChatSystemPrompt(tools), /lookup_scholarships/);
    const without = buildAssistantChatSystemPrompt(tools.slice(1));
    assert.doesNotMatch(without, new RegExp(tools[0]!.name));
  });

  it("tells the model to ask for a name and email and wait for a yes before passing a question on", () => {
    const section = buildToolsSection(tools);
    assert.match(
      section,
      /request_team_followup: Before calling it, ask the parent for their name/
    );
    assert.match(section, /wait for a clear yes/);
    assert.match(section, /no medical details, ID numbers, payment details or passwords/);
  });

  it("asks for replies in the parent's own language and script, links untouched", () => {
    const prompt = buildAssistantChatSystemPrompt(tools);
    assert.match(prompt, /Reply in the language the parent writes in/);
    assert.match(prompt, /Hindi/);
    assert.match(prompt, /Punjabi/);
    assert.match(prompt, /Keep website links, tool names and rupee amounts exactly as they are/);
  });

  it("with no tools says so plainly, and names none", () => {
    const section = buildToolsSection([]);
    assert.match(section, /no tools in this conversation/);
    for (const tool of tools) assert.equal(section.includes(tool.name), false);
  });

  it("keeps the rules it must always carry: the booking marketplace is down, and tools only look up", () => {
    const prompt = buildAssistantChatSystemPrompt(tools);
    assert.match(prompt, /Booking marketplace status/);
    assert.match(prompt, /still cannot book, pay for, or confirm anything/);
  });
});

describe("the case file", () => {
  it("is valid against the real registry", () => {
    assert.deepEqual(
      validateCases(
        ASSISTANT_CASES,
        tools.map((t) => t.name)
      ),
      []
    );
  });

  it("covers every tool and the booking guardrail, so neither can lose its check quietly", () => {
    const called = new Set(
      ASSISTANT_CASES.flatMap((c: { callsTools?: string[] }) => c.callsTools ?? [])
    );
    for (const tool of tools) assert.ok(called.has(tool.name), `no case requires ${tool.name}`);
    assert.ok(
      ASSISTANT_CASES.some((c: { category: string }) => c.category === "booking-guardrail")
    );
    assert.ok(ASSISTANT_CASES.some((c: { channel?: string }) => c.channel === "whatsapp"));
  });

  it("catches its own mistakes: a duplicate id, an unknown tool, a case that checks nothing", () => {
    const base = { category: "tool-routing", message: "hi", why: "because" };
    const problems = validateCases(
      [
        { ...base, id: "a", callsTools: ["no_such_tool"] },
        { ...base, id: "a", replyMatches: [/x/] },
        { ...base, id: "b" },
        { ...base, id: "c", toolArgsInclude: [{ tool: "search_experts", anyOf: ["x"] }] },
      ],
      ["search_experts"]
    );
    assert.ok(problems.some((p: string) => p.includes("duplicate case id: a")));
    assert.ok(problems.some((p: string) => p.includes('unknown tool "no_such_tool"')));
    assert.ok(problems.some((p: string) => p.includes("b: checks nothing")));
    assert.ok(problems.some((p: string) => p.includes("c: checks arguments of search_experts")));

    const leakProblems = validateCases(
      [{ ...base, id: "d", toolArgsNeverInclude: [{ tool: "search_experts", anyOf: ["x"] }] }],
      ["search_experts"]
    );
    assert.ok(
      leakProblems.some((p: string) => p.includes("d: checks what search_experts was given"))
    );
  });
});

describe("scoring", () => {
  const run = (over = {}) => ({
    caseId: "x",
    reply: "Hello",
    rawReply: "Hello",
    calls: [],
    formatterRepaired: false,
    ms: 1,
    ...over,
  });
  const kinds = (c: object, r: object): string[] =>
    scoreCase({ id: "x", category: "tool-routing", message: "m", why: "w", ...c }, run(r)).map(
      (v: { kind: string }) => v.kind
    );

  it("passes a run that meets every rule", () => {
    assert.deepEqual(
      kinds(
        { callsTools: ["search_experts"], replyMatches: [/hello/i], replyNeverMatches: [/bye/] },
        { calls: [{ name: "search_experts", args: { search: "Pune" } }] }
      ),
      []
    );
  });

  it("flags a missing or forbidden tool, and arguments that miss what was asked", () => {
    assert.deepEqual(kinds({ callsTools: ["search_experts"] }, {}), ["missingTool"]);
    assert.deepEqual(
      kinds(
        { neverCallsTools: ["search_experts"] },
        { calls: [{ name: "search_experts", args: {} }] }
      ),
      ["forbiddenTool"]
    );
    assert.deepEqual(
      kinds(
        {
          callsTools: ["search_experts"],
          toolArgsInclude: [{ tool: "search_experts", anyOf: ["bangalore"] }],
        },
        { calls: [{ name: "search_experts", args: { search: "Pune" } }] }
      ),
      ["missingToolArgs"]
    );
  });

  it("matches tool arguments without regard to case", () => {
    assert.deepEqual(
      kinds(
        {
          callsTools: ["search_experts"],
          toolArgsInclude: [{ tool: "search_experts", anyOf: ["bangalore"] }],
        },
        { calls: [{ name: "search_experts", args: { search: "BANGALORE" } }] }
      ),
      []
    );
  });

  it("flags text that is missing, text that must not be there, and a reply that is too long", () => {
    assert.deepEqual(kinds({ replyMatches: [/guidance/] }, {}), ["missingInReply"]);
    assert.deepEqual(kinds({ replyNeverMatches: [/hello/i] }, {}), ["forbiddenInReply"]);
    assert.deepEqual(kinds({ maxChars: 3 }, {}), ["tooLong"]);
  });

  it("flags text that must never be passed to a tool, without regard to case", () => {
    const check = {
      callsTools: ["request_team_followup"],
      toolArgsNeverInclude: [{ tool: "request_team_followup", anyOf: ["asthma", "aadhaar"] }],
    };
    assert.deepEqual(
      kinds(check, {
        calls: [{ name: "request_team_followup", args: { summary: "talk about coaching" } }],
      }),
      []
    );
    assert.deepEqual(
      kinds(check, {
        calls: [{ name: "request_team_followup", args: { summary: "He has ASTHMA, call me" } }],
      }),
      ["toolArgsLeak"]
    );
  });

  it("reports a run that errored as exactly that, and nothing else", () => {
    assert.deepEqual(kinds({ callsTools: ["search_experts"] }, { error: "boom" }), ["errored"]);
  });
});

describe("running a case with a fake model", () => {
  const fakeModel = (
    replyText: string,
    callTool?: { name: string; args: Record<string, unknown> }
  ) =>
    async function* (
      _system: string,
      _history: [],
      _message: string,
      stubbed: Tool[] & { execute?: unknown }[]
    ) {
      if (callTool) {
        const tool = (
          stubbed as unknown as Array<{ name: string; execute: (a: object) => Promise<unknown> }>
        ).find((t) => t.name === callTool.name);
        await tool!.execute(callTool.args);
      }
      yield replyText.slice(0, 4);
      yield replyText.slice(4);
    };

  const byId = (id: string) => ASSISTANT_CASES.find((c: { id: string }) => c.id === id);

  it("records the tool calls the model made, and answers them from fixtures, not a database", async () => {
    const result = await runCase(
      byId("tool-experts-city"),
      tools,
      fakeModel("Here are some coaches.", { name: "search_experts", args: { search: "Bangalore" } })
    );
    assert.deepEqual(result.calls, [{ name: "search_experts", args: { search: "Bangalore" } }]);
    assert.equal(result.reply, "Here are some coaches.");
    assert.equal(result.error, undefined);
    assert.deepEqual(scoreCase(byId("tool-experts-city"), result), []);
  });

  it("scores a model that did not use the tool as a failure of that case", async () => {
    const result = await runCase(
      byId("tool-experts-city"),
      tools,
      fakeModel("I think try Google.")
    );
    const kinds = scoreCase(byId("tool-experts-city"), result).map((v: { kind: string }) => v.kind);
    assert.ok(kinds.includes("missingTool"));
  });

  it("gives a WhatsApp case the channel rules, and repairs markdown before scoring", async () => {
    let seenPrompt = "";
    const result = await runCase(byId("wa-capabilities"), tools, async function* (system: string) {
      seenPrompt = system;
      yield "**I can help with:**\n*   Sport choice\n*   Pathways";
    });
    assert.match(seenPrompt, /Channel: WhatsApp/);
    assert.equal(result.formatterRepaired, true);
    assert.equal(result.reply, "*I can help with:*\n• Sport choice\n• Pathways");
    assert.deepEqual(scoreCase(byId("wa-capabilities"), result), []);
  });

  it("does not give the web channel the WhatsApp rules", async () => {
    let seenPrompt = "";
    await runCase(byId("tool-experts-city"), tools, async function* (system: string) {
      seenPrompt = system;
      yield "ok";
    });
    assert.doesNotMatch(seenPrompt, /Channel: WhatsApp/);
  });

  it("turns a thrown model error into an errored run rather than crashing the evaluation", async () => {
    const result = await runCase(byId("tool-experts-city"), tools, async function* () {
      throw new Error("rate limited");
      yield "";
    });
    assert.equal(result.error, "rate limited");
  });
});

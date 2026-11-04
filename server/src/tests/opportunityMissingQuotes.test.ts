// Asking again for the quotes the first reading left out. What matters: it only
// asks when it has the text to quote from, it adds nothing that is not mechanically
// checked afterwards, and a value the source does not support stays unquoted.

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const {
  completeCitations,
  fieldsMissingQuotes,
} = require("../admin/services/dataSourceExtraction/missingQuotes");
const {
  extractOpportunityForSubmission,
} = require("../admin/services/dataSourceExtraction/opportunity");

const TEXT =
  "India Khelo Football runs city trials for players. Players pay a single registration fee of 125 rupees for the city round. " +
  "Step one is to register for the city round. Step two is to play the trial. Zonal rounds and national finals are free of charge. ".repeat(
    2
  );

afterEach(() => {
  delete process.env.OPPORTUNITY_QUOTE_SECOND_PASS;
});

describe("fieldsMissingQuotes", () => {
  it("lists the fields with a value and no quote", () => {
    assert.deepEqual(
      fieldsMissingQuotes({ title: "T", steps: ["a"], keyFacts: ["b"] }, { title: "a quote" }),
      ["steps", "keyFacts"]
    );
    assert.deepEqual(fieldsMissingQuotes({ title: "T" }, { title: "q" }), []);
  });
});

describe("completeCitations", () => {
  const client = {} as never;
  const run = (over: Record<string, unknown>) =>
    completeCitations({
      client,
      fields: { title: "T", steps: ["Register"], keyFacts: ["Free finals"] },
      citations: { title: "a real quote" },
      sourceText: TEXT,
      call: async () => ({ data: { _citations: {} } }),
      ...over,
    });

  it("asks only about the fields that lack a quote, and shows the model the text", async () => {
    let prompt = "";
    await run({
      call: async (_client: unknown, text: string) => {
        prompt = text;
        return { data: { _citations: {} } };
      },
    });
    assert.match(prompt, /"steps"/);
    assert.match(prompt, /"keyFacts"/);
    assert.doesNotMatch(
      prompt,
      /"title":"T"/,
      "a field that already has a quote is not asked about"
    );
    assert.match(prompt, /registration fee of 125 rupees/);
    assert.match(prompt, /Never paraphrase/);
  });

  it("adds the quotes it gets back, and leaves the ones already there alone", async () => {
    const result = await run({
      call: async () => ({
        data: {
          _citations: {
            steps: "Step one is to register for the city round.",
            keyFacts: "Zonal rounds and national finals are free of charge.",
            title: "an attempt to overwrite",
          },
        },
      }),
    });
    assert.equal(result.citations.title, "a real quote", "an existing quote is never replaced");
    assert.equal(result.citations.steps, "Step one is to register for the city round.");
    assert.deepEqual(result.asked, ["steps", "keyFacts"]);
    assert.deepEqual(result.added, ["steps", "keyFacts"]);
  });

  it("leaves a field unquoted when the model says the source does not support it", async () => {
    const result = await run({
      call: async () => ({
        data: {
          _citations: { steps: "Step one is to register for the city round.", keyFacts: null },
        },
      }),
    });
    assert.equal(result.citations.keyFacts, undefined);
    assert.deepEqual(result.added, ["steps"]);
  });

  it("ignores blank and non-text answers", async () => {
    const result = await run({
      call: async () => ({ data: { _citations: { steps: "   ", keyFacts: 42 } } }),
    });
    assert.deepEqual(result.added, []);
    assert.equal(result.citations.steps, undefined);
  });

  it("does not ask when nothing is missing", async () => {
    let calls = 0;
    const result = await run({
      citations: { title: "q", steps: "q", keyFacts: "q" },
      call: async () => {
        calls += 1;
        return { data: {} };
      },
    });
    assert.equal(calls, 0);
    assert.deepEqual(result.asked, []);
  });

  it("does not ask without the text the model read, or with too little of it", async () => {
    let calls = 0;
    const call = async () => {
      calls += 1;
      return { data: { _citations: { steps: "x" } } };
    };
    await run({ sourceText: null, call });
    await run({ sourceText: "too short", call });
    assert.equal(calls, 0);
  });

  it("can be switched off", async () => {
    process.env.OPPORTUNITY_QUOTE_SECOND_PASS = "off";
    let calls = 0;
    await run({
      call: async () => {
        calls += 1;
        return { data: {} };
      },
    });
    assert.equal(calls, 0);
  });

  it("changes nothing when the call fails or answers with something unusable", async () => {
    const failed = await run({
      call: async () => {
        throw new Error("503");
      },
    });
    assert.deepEqual(failed.citations, { title: "a real quote" });
    assert.deepEqual(failed.added, []);

    for (const data of [null, "text", [1, 2], {}, { _citations: "nope" }, { _citations: [1] }]) {
      const result = await run({ call: async () => ({ data }) });
      assert.deepEqual(result.citations, { title: "a real quote" });
    }
  });

  it("cuts an over-long quote, and shows the model no more than a bounded amount of text", async () => {
    let prompt = "";
    const result = await run({
      sourceText: "x ".repeat(200_000),
      call: async (_client: unknown, text: string) => {
        prompt = text;
        return { data: { _citations: { steps: "q".repeat(900) } } };
      },
    });
    assert.ok(prompt.length < 160_000);
    assert.equal(result.citations.steps.length, 300);
  });
});

describe("in a whole reading of a page", () => {
  const MODEL = {
    title: "India Khelo Football trials",
    category: "academy",
    summary: "City trials for players.",
    steps: ["Register for the city round", "Play the trial"],
    _citations: { title: "India Khelo Football runs city trials for players." },
  };

  const read = async (secondAnswer: unknown) => {
    const prompts: string[] = [];
    const result = await extractOpportunityForSubmission(
      {
        targetType: "OPPORTUNITY",
        sportSlug: "football",
        opportunityTrack: "admission",
        sourceKind: "LINK",
        sourceUrl: "https://indiakhelofootball.com/trials",
        sourceLabel: "Trials",
      },
      undefined,
      {
        client: {} as never,
        fetchPdf: async () => null,
        fetchPage: async () => ({
          text: TEXT,
          html: "<p>x</p>",
          finalUrl: "https://indiakhelofootball.com/trials",
        }),
        call: async (_client: unknown, text: string) => {
          prompts.push(text);
          return /checking an extraction/.test(text)
            ? { data: secondAnswer, model: "fake" }
            : { data: MODEL, model: "fake" };
        },
      }
    );
    return { result, prompts };
  };

  it("fills in a missing quote that really is in the page, and the check confirms it", async () => {
    const { result, prompts } = await read({
      _citations: {
        summary: "India Khelo Football runs city trials for players.",
        steps: "Step one is to register for the city round.",
      },
    });
    assert.equal(prompts.length, 2, "one reading, one second pass");
    assert.equal(result.citations.steps, "Step one is to register for the city round.");
    assert.equal(result.citationChecks.quotes.steps, "found");
    assert.equal(result.citationChecks.quotes.summary, "found");
  });

  it("does not take the model's word: a quote that is not in the page fails the check", async () => {
    const { result } = await read({
      _citations: { steps: "Players must bring three passport photographs.", summary: null },
    });
    assert.equal(result.citations.steps, "Players must bring three passport photographs.");
    assert.notEqual(result.citationChecks.quotes.steps, "found");
    assert.equal(result.citations.summary, undefined);
  });

  it("does not ask a second time when the first reading quoted everything", async () => {
    const prompts: string[] = [];
    const complete = {
      ...MODEL,
      _citations: { title: "q", summary: "q", steps: "q", category: "q" },
    };
    await extractOpportunityForSubmission(
      {
        targetType: "OPPORTUNITY",
        sportSlug: "football",
        opportunityTrack: "admission",
        sourceKind: "LINK",
        sourceUrl: "https://indiakhelofootball.com/trials",
      },
      undefined,
      {
        client: {} as never,
        fetchPdf: async () => null,
        fetchPage: async () => ({
          text: TEXT,
          html: "<p>x</p>",
          finalUrl: "https://indiakhelofootball.com/trials",
        }),
        call: async (_client: unknown, text: string) => {
          prompts.push(text);
          return { data: complete, model: "fake" };
        },
      }
    );
    assert.equal(prompts.length, 1);
  });
});

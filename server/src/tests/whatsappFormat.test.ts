// The WhatsApp reply formatter. Pure text in, text out: what is pinned is that markdown the
// model sometimes sends comes out as text WhatsApp renders, and that nothing a parent needs
// (a link, a figure, an intentional *bold*) is damaged on the way.
import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { clipReply, formatForWhatsApp } = require("../shared/services/whatsappFormat");

// The reply from the screenshot that prompted this: asterisk bullets and nested asterisks.
const SCREENSHOT_REPLY = `I'm the PowerMySport Assistant, and I'm here to help you navigate your child's sports journey.

Here's what I can do:

*   Answer general questions about youth sports development, choosing a sport, and training basics.
*   Guide you to the right tool for your needs, such as:
    *   Our Sport Assessment to help you discover a sport for your child.
    *   Our AI Guidance to build a personalized development plan.
*   Look up information using our tools, like:
    *   Finding verified sports experts and coaches.

What can I help you with today?`;

describe("formatForWhatsApp", () => {
  it("turns asterisk bullets and nested bullets into real ones", () => {
    const out = formatForWhatsApp(SCREENSHOT_REPLY);
    assert.ok(
      out.includes("• Answer general questions about youth sports development"),
      "top-level bullet"
    );
    assert.ok(
      out.includes("   – Our Sport Assessment to help you discover a sport"),
      "nested bullet"
    );
    for (const line of out.split("\n")) {
      assert.equal(/^\s*\*\s/.test(line), false, `no line may still start with "* ": ${line}`);
    }
  });

  it("keeps the plain sentences exactly as they were", () => {
    const out = formatForWhatsApp(SCREENSHOT_REPLY);
    assert.ok(out.startsWith("I'm the PowerMySport Assistant, and I'm here to help you navigate"));
    assert.ok(out.endsWith("What can I help you with today?"));
  });

  it("converts markdown bold, headings, strike and inline code", () => {
    assert.equal(formatForWhatsApp("**Important:** book early"), "*Important:* book early");
    assert.equal(formatForWhatsApp("## Next steps"), "*Next steps*");
    assert.equal(formatForWhatsApp("### **Costs**"), "*Costs*");
    assert.equal(formatForWhatsApp("~~old~~ new"), "~old~ new");
    assert.equal(
      formatForWhatsApp("use `/guidance` now"),
      "use https://powermysport.com/guidance now"
    );
  });

  it("leaves WhatsApp's own single-asterisk bold alone, and does not mistake it for a bullet", () => {
    assert.equal(formatForWhatsApp("*Stage 2* starts at age 9"), "*Stage 2* starts at age 9");
    assert.equal(
      formatForWhatsApp("*bold at the start* of a line"),
      "*bold at the start* of a line"
    );
  });

  it("makes site paths and markdown links into full links", () => {
    assert.equal(
      formatForWhatsApp("Try the [Sport Assessment](/assessment/discover) first."),
      "Try the Sport Assessment: https://powermysport.com/assessment/discover first."
    );
    assert.equal(
      formatForWhatsApp("Start at /guidance or /assessment/discover."),
      "Start at https://powermysport.com/guidance or https://powermysport.com/assessment/discover."
    );
  });

  it("does not touch a link that is already complete, or a slash in ordinary words", () => {
    const text = "See https://powermysport.com/guidance and play singles and/or doubles";
    assert.equal(formatForWhatsApp(text), text);
    assert.equal(
      formatForWhatsApp("[https://powermysport.com/ask](https://powermysport.com/ask)"),
      "https://powermysport.com/ask"
    );
  });

  it("converts dash and plus bullets, numbered lists stay, rules and quotes are tidied", () => {
    assert.equal(formatForWhatsApp("- one\n+ two"), "• one\n• two");
    assert.equal(formatForWhatsApp("1. first\n2. second"), "1. first\n2. second");
    assert.equal(formatForWhatsApp("above\n\n---\n\nbelow"), "above\n\nbelow");
    assert.equal(formatForWhatsApp("> a quoted line"), "a quoted line");
  });

  it("does not turn a negative number or a hyphenated word into a bullet", () => {
    assert.equal(formatForWhatsApp("-5 degrees is too cold"), "-5 degrees is too cold");
    assert.equal(formatForWhatsApp("a well-known coach"), "a well-known coach");
  });

  it("removes code fences and collapses runs of blank lines", () => {
    assert.equal(formatForWhatsApp("a\n\n\n\n\nb"), "a\n\nb");
    assert.equal(formatForWhatsApp("```\ncode\n```"), "code");
  });

  it("is stable: formatting a formatted reply changes nothing", () => {
    const once = formatForWhatsApp(SCREENSHOT_REPLY);
    assert.equal(formatForWhatsApp(once), once);
  });
});

describe("clipReply", () => {
  it("returns a short reply untouched", () => {
    assert.equal(clipReply("short", 100), "short");
  });

  it("cuts at a paragraph break near the end, never mid-word, and says it was cut", () => {
    const text = `${"First paragraph here. ".repeat(6)}\n\nSecond paragraph that runs on and on and on.`;
    const out = clipReply(text, 140);
    assert.ok(out.length <= 140);
    assert.ok(out.endsWith("…"));
    assert.ok(out.startsWith("First paragraph here."));
    assert.equal(
      /\w…$/.test(out) && !/[.!?]…$/.test(out),
      false,
      "ends on a boundary, not mid-word"
    );
  });

  it("falls back to a word boundary when there is no break to use", () => {
    const out = clipReply("word ".repeat(100), 50);
    assert.ok(out.length <= 50);
    assert.ok(/ word…$/.test(out), "ends on a whole word");
    assert.equal(out.includes("wor…"), false);
  });
});

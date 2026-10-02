// Formatted text for pathway answers.
//
// The fixtures are the text exactly as stored for real tennis answers (pasted
// from Word, with its bullets, tabs and trailing spaces), because the whole
// point is that those read correctly without anyone retyping them.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichText } from "@/modules/shared/components/RichText";
import { normalizeRichText } from "@/modules/shared/utils/richText";

// The renderer writes a newline after each <br/>; it is invisible on screen, so
// it is folded away here and a line break reads as "<br/>" in the assertions.
const html = (text: string | null | undefined, size?: "body" | "detail") =>
  renderToStaticMarkup(<RichText {...(size ? { size } : {})}>{text}</RichText>).replace(
    /<br\/>\n/g,
    "<br/>"
  );

/** The visible text, with tags dropped, for assertions that do not care about markup. */
const textOf = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "What is the point system under various AITA tournaments?" (stored text)
const POINT_SYSTEM =
  "1. Talent Series (TS)\nWinner: 10 Points\nRunner-up: 7 Points\nSemifinalist: 5 Points\n\n" +
  "2. Championship Series (CS)\nWinner: 30 Points\nRunner-up: 20 Points\nSemifinalist: 15 Points";

// "How to Register for AITA Tournaments?" (stored text)
const REGISTER =
  "To participate in an AITA tournament, players must first obtain a valid AITA Player Registration Number. \n\n" +
  "Steps to register:\n\nVisit the official AITA website and select Player Registration.\n" +
  "Complete the player registration form.\nPay the applicable registration fee online.";

// "US College Tennis: What Do Division I, II & III Mean?" (stored text, Word bullets)
const WORD_BULLETS =
  "US college tennis is broadly divided into NCAA Division I, II and III.\n" +
  "•\tDivision I: Highest level of college tennis. \n" +
  "•\tDivision II: Strong competitive tennis. \n" +
  "•\tDivision III: Competitive college tennis.";

describe("normalizeRichText", () => {
  it("turns Word bullets into list items and strips trailing spaces", () => {
    expect(normalizeRichText(WORD_BULLETS)).toBe(
      "US college tennis is broadly divided into NCAA Division I, II and III.\n" +
        "- Division I: Highest level of college tennis.\n" +
        "- Division II: Strong competitive tennis.\n" +
        "- Division III: Competitive college tennis."
    );
  });

  it("handles other bullet characters, CRLF and non-breaking spaces", () => {
    expect(normalizeRichText("◦ one\r\n▪\ttwo \r\n· three")).toBe("- one\n- two\n- three");
  });

  it("leaves a dash used inside a sentence alone", () => {
    expect(normalizeRichText("The key difference is not “more points”—each category differs")).toBe(
      "The key difference is not “more points”—each category differs"
    );
  });
});

describe("RichText", () => {
  it("draws nothing for empty text", () => {
    expect(html("")).toBe("");
    expect(html("   \n  ")).toBe("");
    expect(html(null)).toBe("");
    expect(html(undefined)).toBe("");
  });

  it("separates paragraphs on a blank line", () => {
    const markup = html("First paragraph.\n\nSecond paragraph.");
    expect(markup.match(/<p /g)).toHaveLength(2);
  });

  it("keeps a single line break as a line break", () => {
    const markup = html("Winner: 10 Points\nRunner-up: 7 Points");
    expect(markup).toContain("Winner: 10 Points<br/>Runner-up: 7 Points");
  });

  it("draws the point system as a numbered list, one result per line", () => {
    const markup = html(POINT_SYSTEM);
    expect(markup).toContain("<ol");
    expect(markup.match(/<li/g)).toHaveLength(2);
    expect(markup).toContain("Talent Series (TS)<br/>Winner: 10 Points<br/>Runner-up: 7 Points");
    expect(textOf(markup)).toContain("Championship Series (CS)");
  });

  it("keeps the steps to register as separate lines under their lead-in", () => {
    const markup = html(REGISTER);
    expect(markup).toContain("Steps to register:");
    expect(markup).toContain(
      "Visit the official AITA website and select Player Registration.<br/>Complete the player registration form."
    );
  });

  it("draws Word bullets as a real bulleted list, with no stray bullet characters", () => {
    const markup = html(WORD_BULLETS);
    expect(markup).toContain("<ul");
    expect(markup.match(/<li/g)).toHaveLength(3);
    expect(markup).not.toContain("•");
    expect(markup).toContain("Division I: Highest level of college tennis.");
  });

  it("draws bold and any heading level as a small h4", () => {
    const markup = html("## Steps\n\nPay the **annual** fee.");
    expect(markup).toContain("<h4");
    expect(markup).not.toContain("<h2");
    expect(markup).toContain("<strong");
    expect(html("# Title")).toContain("<h4");
  });

  it("draws a table inside a box that scrolls sideways", () => {
    const markup = html(
      "| Series | Winner | Runner-up |\n| --- | --- | --- |\n| Talent Series | 10 | 7 |\n| Championship Series | 30 | 20 |"
    );
    expect(markup).toContain("<table");
    expect(markup).toContain("overflow-x-auto");
    expect(markup).toContain("<th");
    expect(markup.match(/<td/g)).toHaveLength(6);
  });

  it("uses the larger size for an overview", () => {
    expect(html("Overview text", "body")).toContain("text-[15.5px]");
    expect(html("Answer text")).toContain("text-[14px]");
  });
});

describe("RichText is safe", () => {
  it("drops raw HTML instead of drawing it", () => {
    const markup = html('Hello <script>alert(1)</script><img src=x onerror="alert(1)"> world');
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("onerror");
  });

  it("refuses a javascript: link", () => {
    const markup = html("[click me](javascript:alert(1))");
    expect(markup).not.toContain("javascript:");
    expect(textOf(markup)).toContain("click me");
  });

  it("opens an outside link in a new tab without leaking the opener", () => {
    const markup = html("[AITA](https://www.aitatennis.com/)");
    expect(markup).toContain('href="https://www.aitatennis.com/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain("noopener noreferrer");
  });

  it("does not draw images or code, but keeps their text", () => {
    const markup = html("![alt text](https://example.test/x.png) and `inline`");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<code");
    expect(textOf(markup)).toContain("inline");
  });
});

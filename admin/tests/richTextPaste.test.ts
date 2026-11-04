// @vitest-environment jsdom
//
// The paste cleaner: what Word and Google Docs put on the clipboard, turned into
// the Markdown the website draws. The fixtures follow what each really sends.
// Google Docs wraps everything in a <b style="font-weight:normal"> and marks
// bold with inline styles; desktop Word has no <ul>/<ol> at all and marks a
// list item with an "mso-list" paragraph style and a leading marker span.

import { cleanPastedContent, htmlToMarkdown } from "@powermysport/rich-text";
import { describe, expect, it } from "vitest";

// ── Google Docs: a bold lead-in, a numbered list with one bold word ──
const GOOGLE_DOCS_STEPS =
  `<meta charset='utf-8'><meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-6a1c">` +
  `<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial,sans-serif;font-weight:700;">Steps to register:</span></p><br />` +
  `<ol style="margin-top:0;margin-bottom:0;padding-inline-start:48px;">` +
  `<li dir="ltr" style="list-style-type:decimal;font-weight:400;" aria-level="1"><p dir="ltr" role="presentation"><span style="font-weight:400;">Visit the official AITA website.</span></p></li>` +
  `<li dir="ltr" style="list-style-type:decimal;font-weight:400;" aria-level="1"><p dir="ltr" role="presentation"><span style="font-weight:400;">Pay the </span><span style="font-weight:700;">registration fee</span><span style="font-weight:400;"> online.</span></p></li>` +
  `</ol></b>`;

// ── Google Docs: nested bullets, and a link wrapped in Google's redirect ──
const GOOGLE_DOCS_NESTED =
  `<b style="font-weight:normal;" id="docs-internal-guid-2"><ul>` +
  `<li dir="ltr" aria-level="1"><p dir="ltr"><span>Division I</span></p></li>` +
  `<ul><li dir="ltr" aria-level="2"><p dir="ltr"><span>Scholarships may be available</span></p></li></ul>` +
  `<li dir="ltr" aria-level="1"><p dir="ltr"><a href="https://www.google.com/url?q=https://www.ncaa.org/&amp;sa=D"><span>NCAA</span></a></p></li>` +
  `</ul></b>`;

// ── Desktop Word: a paragraph, then bulleted items as MsoListParagraph ──
const WORD_BULLETS =
  `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head><body lang=EN-US><!--StartFragment-->` +
  `<p class=MsoNormal>US college tennis has three divisions.<o:p></o:p></p>` +
  `<p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Division I: highest level.<o:p></o:p></p>` +
  `<p class=MsoListParagraphCxSpMiddle style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Division II: a balance with academics.<o:p></o:p></p>` +
  `<p class=MsoListParagraphCxSpLast style='margin-left:.75in;text-indent:-.25in;mso-list:l0 level2 lfo1'><![if !supportLists]><span><span style='mso-list:Ignore'>o<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span></span><![endif]>Some aid may be available.<o:p></o:p></p>` +
  `<!--EndFragment--></body></html>`;

// ── Desktop Word: numbered items ──
const WORD_NUMBERED =
  `<html><body><!--StartFragment-->` +
  `<p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span></span><![endif]>Talent Series<o:p></o:p></p>` +
  `<p class=MsoListParagraphCxSpLast style='text-indent:-.25in;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span></span><![endif]>Championship Series<o:p></o:p></p>` +
  `<!--EndFragment--></body></html>`;

const TABLE =
  `<table><tbody>` +
  `<tr><td><b>Series</b></td><td><b>Winner</b></td><td><b>Runner-up</b></td></tr>` +
  `<tr><td>Talent Series</td><td>10</td><td>7</td></tr>` +
  `<tr><td>Championship Series</td><td>30</td><td>20</td></tr>` +
  `</tbody></table>`;

describe("htmlToMarkdown", () => {
  it("reads a Google Docs bold lead-in and numbered list", () => {
    expect(htmlToMarkdown(GOOGLE_DOCS_STEPS)).toBe(
      "**Steps to register:**\n\n1. Visit the official AITA website.\n2. Pay the **registration fee** online."
    );
  });

  it("keeps nested bullets nested and unwraps Google's link redirect", () => {
    expect(htmlToMarkdown(GOOGLE_DOCS_NESTED)).toBe(
      "- Division I\n  - Scholarships may be available\n- [NCAA](https://www.ncaa.org/)"
    );
  });

  it("reads Word's list paragraphs as bullets, and keeps their nesting", () => {
    expect(htmlToMarkdown(WORD_BULLETS)).toBe(
      "US college tennis has three divisions.\n\n" +
        "- Division I: highest level.\n" +
        "- Division II: a balance with academics.\n" +
        "   - Some aid may be available."
    );
  });

  it("tells Word's numbered items from its bullets", () => {
    expect(htmlToMarkdown(WORD_NUMBERED)).toBe("1. Talent Series\n2. Championship Series");
  });

  it("turns a table into a Markdown table", () => {
    expect(htmlToMarkdown(TABLE)).toBe(
      "| Series | Winner | Runner-up |\n| --- | --- | --- |\n| Talent Series | 10 | 7 |\n| Championship Series | 30 | 20 |"
    );
  });

  it("escapes a pipe inside a table cell so it cannot split the column", () => {
    expect(htmlToMarkdown("<table><tr><td>a | b</td><td>c</td></tr></table>")).toContain("a \\| b");
  });

  it("does not double up bold inside bold, and keeps the spaces outside the markers", () => {
    expect(htmlToMarkdown("<p>Pay <b>the <strong>annual</strong> fee</b> now</p><p>x</p>")).toBe(
      "Pay **the annual fee** now\n\nx"
    );
  });

  it("drops a Word style block, comments and empty paragraphs", () => {
    const markdown = htmlToMarkdown(WORD_BULLETS);
    expect(markdown).not.toContain("MsoNormal");
    expect(markdown).not.toContain("StartFragment");
  });

  it("escapes a literal asterisk so it cannot start emphasis", () => {
    expect(htmlToMarkdown("<p>Under-12* only</p><p>Second</p>")).toBe("Under-12\\* only\n\nSecond");
  });

  it("gives nothing for an empty paste", () => {
    expect(htmlToMarkdown("")).toBe("");
  });
});

describe("cleanPastedContent", () => {
  it("uses the HTML version when it carries structure", () => {
    const result = cleanPastedContent({
      html: GOOGLE_DOCS_STEPS,
      text: "Steps to register:\nVisit...",
    });
    expect(result.source).toBe("html");
    expect(result.changed).toBe(true);
    expect(result.text).toContain("1. Visit the official AITA website.");
  });

  it("leaves a plain sentence alone, even when it arrives wrapped in HTML", () => {
    const result = cleanPastedContent({
      html: "<span>Players must hold a valid registration number.</span>",
      text: "Players must hold a valid registration number.",
    });
    expect(result.source).toBe("text");
    expect(result.text).toBe("Players must hold a valid registration number.");
    expect(result.changed).toBe(false);
  });

  it("tidies Word bullets when only plain text came through", () => {
    const result = cleanPastedContent({ text: "•\tDivision I \n•\tDivision II" });
    expect(result).toEqual({ text: "- Division I\n- Division II", source: "text", changed: true });
  });

  it("turns tab-separated spreadsheet rows into a table", () => {
    const result = cleanPastedContent({
      text: "Series\tWinner\nTalent Series\t10\nChampionship Series\t30",
    });
    expect(result.source).toBe("table");
    expect(result.text).toBe(
      "| Series | Winner |\n| --- | --- |\n| Talent Series | 10 |\n| Championship Series | 30 |"
    );
  });

  it("does not make a table out of a single tabbed line", () => {
    expect(cleanPastedContent({ text: "a\tb" }).source).toBe("text");
  });
});

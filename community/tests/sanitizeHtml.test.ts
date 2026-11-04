import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "@/modules/community/utils/sanitizeHtml";

/**
 * These run in the default `node` environment on purpose: the blog detail page
 * server-renders the story, and React never reconciles the children of a
 * dangerouslySetInnerHTML node during hydration. If the sanitizer degrades
 * without a DOM, readers who open a post by direct link keep whatever the
 * server produced, which is how every post once shipped as a wall of
 * unformatted text.
 */
describe("sanitizeRichHtml without a browser DOM", () => {
  it("keeps the block structure instead of flattening it to text", () => {
    const html = sanitizeRichHtml("<h2>Heading</h2><p>First</p><ul><li>Item</li></ul>");

    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<p>First</p>");
    expect(html).toContain("<li>Item</li>");
  });

  it("still strips scripts and event handlers", () => {
    const html = sanitizeRichHtml(
      '<p onclick="steal()">Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
    );

    expect(html).toContain("<p>Hi</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });

  it("forces safe link attributes and prunes disallowed inline styles", () => {
    const html = sanitizeRichHtml(
      '<a href="https://example.com" style="text-align:center;position:fixed">Link</a>'
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("text-align:center");
    expect(html).not.toContain("position");
  });

  it("replaces any target/rel the author supplied rather than trusting them", () => {
    const html = sanitizeRichHtml(
      '<a href="https://example.com" target="_self" rel="opener">x</a>'
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("_self");
    expect(html).not.toContain('opener"');
  });

  it("removes unsafe URL schemes without leaving a bare attribute behind", () => {
    const html = sanitizeRichHtml(
      '<a href="javascript:alert(1)">x</a><img src="javascript:alert(1)"><a href="/path">y</a>'
    );

    expect(html).not.toContain("javascript");
    expect(html).not.toMatch(/\b(href|src)(?=[\s>])/);
    expect(html).toContain('href="/path"');
  });

  it("drops script, style and foreign-content blocks with their contents", () => {
    for (const hostile of [
      "<script>alert(1)</script>",
      "<style>p{x:y}</style>",
      "<svg><style><img src=x onerror=alert(1)></style></svg>",
      '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
      '<iframe src="https://evil.example"></iframe>',
    ]) {
      const html = sanitizeRichHtml(`<p>ok</p>${hostile}`);

      expect(html).toBe("<p>ok</p>");
    }
  });

  it("never prints the sanitizer's own placeholder text", () => {
    expect(sanitizeRichHtml("<p>a</p><script>1")).not.toContain("[removed]");
    expect(sanitizeRichHtml("<svg><style>x</style></svg>")).not.toContain("[removed]");
  });

  it("keeps the text of unknown tags, drops comments, and escapes stray angle brackets", () => {
    const html = sanitizeRichHtml("<p>1 < 2</p><!-- hidden --><custom-tag>kept</custom-tag>");

    expect(html).toContain("1 &lt; 2");
    expect(html).toContain("kept");
    expect(html).not.toContain("custom-tag");
    expect(html).not.toContain("hidden");
  });

  it("drops attributes outside the allowlist, including data and event attributes", () => {
    const html = sanitizeRichHtml(
      '<p data-x="1" class="c" id="i" onmouseover="x()">a</p><img src="https://a.example/x.jpg" alt="q" width="9" onload="x()">'
    );

    expect(html).toBe('<p>a</p><img src="https://a.example/x.jpg" alt="q">');
  });

  it("keeps the allowed inline styles and discards values that carry anything else", () => {
    const html = sanitizeRichHtml(
      '<span style="background-color:#ff0;text-align:center">a</span><span style="background:url(javascript:x)">b</span>'
    );

    expect(html).toContain('style="background-color:#ff0;text-align:center"');
    expect(html).not.toContain("url(");
  });

  it("does not pull in a DOM implementation", () => {
    // This module was once backed by isomorphic-dompurify, which loads jsdom on
    // the server. In production that import threw ERR_REQUIRE_ESM, so every
    // Experience article answered 500 while this suite stayed green (it ran on a
    // newer Node than the one that failed). Keep a DOM out of the server path.
    const source = readFileSync(
      path.resolve(__dirname, "../src/modules/community/utils/sanitizeHtml.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["'](isomorphic-dompurify|dompurify|jsdom)["']/);
  });
});

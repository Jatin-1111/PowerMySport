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
});

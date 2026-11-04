import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExperienceIndexFallback from "@/modules/community/components/blog/ExperienceIndexFallback";

describe("ExperienceIndexFallback", () => {
  it("links every post, so a crawler can reach articles from the index HTML", () => {
    const html = renderToStaticMarkup(
      <ExperienceIndexFallback
        items={[
          {
            id: "a1",
            title: "Right Age to Start a Sport",
            excerpt: "A short summary",
            author: { name: "Asha" },
          },
          { id: "b2", title: "Choosing an academy", excerpt: "Choosing an academy", author: null },
        ]}
      />
    );

    expect(html).toContain('href="/experiences/a1"');
    expect(html).toContain('href="/experiences/b2"');
    expect(html).toContain("Right Age to Start a Sport");
    expect(html).toContain("By Asha");
    expect(html).toContain("<h1");
  });

  it("does not repeat the title as its own summary", () => {
    const html = renderToStaticMarkup(
      <ExperienceIndexFallback items={[{ id: "b2", title: "Same text", excerpt: "Same text" }]} />
    );

    expect(html.match(/Same text/g)).toHaveLength(1);
  });

  it("falls back to the loading state when there are no posts", () => {
    const html = renderToStaticMarkup(<ExperienceIndexFallback items={[]} />);

    expect(html).toContain("Loading experiences");
    expect(html).not.toContain("<h1");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cvFileNameFor, saveBlob } from "./saveFile";

describe("the name of the saved CV", () => {
  it("is made of the child's name, with only letters and digits", () => {
    expect(cvFileNameFor("Anaya Rao")).toBe("anaya-rao-sporting-profile.pdf");
    expect(cvFileNameFor("  Zoe O'Neil-Smith! ")).toBe("zoe-o-neil-smith-sporting-profile.pdf");
  });

  it("cannot carry a path, a quote or a line break into the file name", () => {
    const name = cvFileNameFor('../../private/file"\r\nX: y');
    expect(name).toMatch(/^[a-z0-9-]+-sporting-profile\.pdf$/);
  });

  it("falls back to a plain name when there is nothing usable, and stays short", () => {
    expect(cvFileNameFor("   ")).toBe("child-sporting-profile.pdf");
    expect(cvFileNameFor("日本語")).toBe("child-sporting-profile.pdf");
    expect(cvFileNameFor("a".repeat(200)).length).toBeLessThan(70);
  });
});

describe("saving a file the browser already holds", () => {
  const created: string[] = [];
  const revoked: string[] = [];

  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test/${created.length}-${blob.size}`;
      created.push(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    }) as typeof URL.revokeObjectURL;
  });
  afterEach(() => vi.restoreAllMocks());

  it("downloads it under the given name, leaves nothing in the page, and lets go of the address", async () => {
    let seen = { download: "", href: "" };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      seen = { download: this.download, href: this.href };
    });

    saveBlob(new Blob(["%PDF-"]), "cv.pdf");

    expect(click).toHaveBeenCalledTimes(1);
    expect(seen).toEqual({ download: "cv.pdf", href: created[0] });
    expect(document.querySelector("a[download]")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(revoked).toEqual(created);
  });
});

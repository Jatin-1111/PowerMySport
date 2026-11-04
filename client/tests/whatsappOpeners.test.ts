import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_OPENERS, isGenericWhatsAppOpener } from "@powermysport/shared-types";

/**
 * The server answers these exact messages with the welcome menu. The website must therefore build
 * its WhatsApp buttons from the shared constants. A button with its own copy of the text would
 * stop matching the first time somebody edited either, and the parent would get a long overview
 * instead of the menu, with nothing failing to say so.
 */

const SRC = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mdx?)$/.test(name) ? [path] : [];
  });
}

describe("the website's generic WhatsApp openers", () => {
  const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("are never written out in the site's own code", () => {
    for (const opener of Object.values(WHATSAPP_OPENERS)) {
      // Matched on the words, so a copy pasted in with different quotes or encoding still counts.
      const stem = opener.replace(/'/g, "").slice(0, 40);
      const offenders = files
        .filter(
          ({ text }) =>
            text.includes(opener) ||
            text.includes(encodeURIComponent(opener)) ||
            text.replace(/'/g, "").includes(stem)
        )
        .map(({ path }) => path);
      expect(offenders, `"${opener}" must come from WHATSAPP_OPENERS`).toEqual([]);
    }
  });

  it("are used by the buttons that send them", () => {
    const used = (name: string) =>
      files.filter(({ text }) => text.includes(`WHATSAPP_OPENERS.${name}`)).length;
    for (const name of Object.keys(WHATSAPP_OPENERS)) {
      expect(used(name), `${name} is on at least one button`).toBeGreaterThan(0);
    }
  });

  it("are recognised by the matcher the server uses", () => {
    for (const opener of Object.values(WHATSAPP_OPENERS)) {
      expect(isGenericWhatsAppOpener(opener)).toBe(true);
    }
    expect(isGenericWhatsAppOpener("Hi! Which sport suits my son?")).toBe(false);
  });
});

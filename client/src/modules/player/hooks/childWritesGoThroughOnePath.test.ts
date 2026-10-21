import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Every flow that adds or changes a child (profile page, quick add, the sport quiz, "I know my
// sport", the guidance card) goes through useSaveChild, which also makes the rest of the app
// notice. A flow that calls the API itself skips that, and another screen keeps the old child.
const SRC = join(__dirname, "../../..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });

describe("writing a child from the client", () => {
  const files = sourceFiles(SRC).map((file) => ({
    path: relative(SRC, file).split(sep).join("/"),
    text: readFileSync(file, "utf8"),
  }));

  it("only useSaveChild calls the add and update requests", () => {
    const callers = files
      .filter((f) => /authApi\.(addDependent|updateDependent)\(/.test(f.text))
      .map((f) => f.path);

    expect(callers).toEqual(["modules/player/hooks/useSaveChild.ts"]);
  });

  it("nothing else sends a child to the server by hand", () => {
    const offenders = files
      .filter((f) => f.path !== "modules/auth/services/auth.ts")
      .filter((f) => /\.(post|put)\(\s*[`"']\/auth\/dependents/.test(f.text))
      .map((f) => f.path);

    expect(offenders).toEqual([]);
  });
});

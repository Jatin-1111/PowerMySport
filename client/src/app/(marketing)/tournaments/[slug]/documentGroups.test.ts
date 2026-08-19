import { describe, expect, it } from "vitest";
import type { EditionDocument } from "@/modules/pathway/services/pathway";
import { groupDocumentsByKind } from "./documentGroups";

const doc = (
  label: string,
  url: string,
  kind: EditionDocument["kind"] = "acceptanceList",
): EditionDocument => ({ label, url, kind });

describe("groupDocumentsByKind", () => {
  it("numbers documents that share a label so they stop reading as a duplicate", () => {
    // The real AITA case: one event, two different acceptance lists, both
    // labelled "Girls Under 18". Rendered as-is they look like a bug.
    const groups = groupDocumentsByKind([
      doc("Girls Under 18", "https://aitatennis.com/acceptancelist?eventuid=8775"),
      doc("Girls Under 18", "https://aitatennis.com/acceptancelist?eventuid=8774"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((d) => d.displayLabel)).toEqual([
      "Girls Under 18 (1 of 2)",
      "Girls Under 18 (2 of 2)",
    ]);
  });

  it("keeps both entries — collapsing them would lose a real draw", () => {
    const groups = groupDocumentsByKind([
      doc("Girls Under 18", "https://example.com/a"),
      doc("Girls Under 18", "https://example.com/b"),
    ]);

    expect(groups[0]!.items.map((d) => d.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("leaves distinct labels untouched", () => {
    const groups = groupDocumentsByKind([
      doc("Girls Under 14", "https://example.com/g14"),
      doc("Boys Under 14", "https://example.com/b14"),
    ]);

    expect(groups[0]!.items.map((d) => d.displayLabel)).toEqual([
      "Girls Under 14",
      "Boys Under 14",
    ]);
  });

  it("groups by kind so each explanation is stated once", () => {
    const groups = groupDocumentsByKind([
      doc("Fact Sheet", "https://example.com/fs.pdf", "factSheet"),
      doc("Girls Under 18", "https://example.com/a"),
      doc("Boys Under 18", "https://example.com/b"),
    ]);

    expect(groups.map((g) => g.kind)).toEqual(["factSheet", "acceptanceList"]);
    expect(groups[1]!.items).toHaveLength(2);
  });

  it("treats labels differing only by case or padding as the same label", () => {
    const groups = groupDocumentsByKind([
      doc("Girls Under 18", "https://example.com/a"),
      doc("  girls under 18 ", "https://example.com/b"),
    ]);

    expect(groups[0]!.items.map((d) => d.displayLabel)).toEqual([
      "Girls Under 18 (1 of 2)",
      "  girls under 18  (2 of 2)",
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupDocumentsByKind([])).toEqual([]);
  });
});

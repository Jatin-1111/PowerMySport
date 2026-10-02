// What the editor's toolbar buttons do to the text. Each is a pure function from
// the text and the selection to a replacement, so the whole toolbar can be
// pinned here without a browser.

import {
  applyEdit,
  insertTable,
  tidyAll,
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleNumberedList,
} from "@powermysport/rich-text";
import { describe, expect, it } from "vitest";

/** Apply a toolbar action to the text and return the new text and the selected part. */
function run(
  action: typeof toggleBold,
  value: string,
  selStart: number,
  selEnd = selStart
): { value: string; selected: string } {
  const edit = action(value, selStart, selEnd);
  const next = applyEdit(value, edit);
  return { value: next, selected: next.slice(edit.selectionStart, edit.selectionEnd) };
}

const select = (value: string, part: string) => {
  const start = value.indexOf(part);
  return { start, end: start + part.length };
};

describe("toggleBold", () => {
  it("bolds the selection and keeps it selected", () => {
    const { start, end } = select("Pay the annual fee", "annual");
    const result = run(toggleBold, "Pay the annual fee", start, end);
    expect(result.value).toBe("Pay the **annual** fee");
    expect(result.selected).toBe("annual");
  });

  it("takes bold off when the markers are just outside the selection", () => {
    const text = "Pay the **annual** fee";
    const { start, end } = select(text, "annual");
    const result = run(toggleBold, text, start, end);
    expect(result.value).toBe("Pay the annual fee");
    expect(result.selected).toBe("annual");
  });

  it("takes bold off when the selection includes the markers", () => {
    const text = "Pay the **annual** fee";
    const { start, end } = select(text, "**annual**");
    expect(run(toggleBold, text, start, end).value).toBe("Pay the annual fee");
  });

  it("keeps spaces at the edges of the selection outside the markers", () => {
    const text = "Pay the annual fee";
    const { start, end } = select(text, " annual ");
    expect(run(toggleBold, text, start, end).value).toBe("Pay the **annual** fee");
  });

  it("leaves a placeholder, selected, when nothing is selected", () => {
    const result = run(toggleBold, "Pay ", 4);
    expect(result.value).toBe("Pay **bold text**");
    expect(result.selected).toBe("bold text");
  });
});

describe("toggleBulletList", () => {
  it("bullets every line the selection touches", () => {
    const text = "Division I\nDivision II\nDivision III";
    expect(run(toggleBulletList, text, 0, text.length).value).toBe(
      "- Division I\n- Division II\n- Division III"
    );
  });

  it("works from a cursor in the middle of a line", () => {
    const text = "Intro\nDivision I\nOutro";
    expect(run(toggleBulletList, text, text.indexOf("sion")).value).toBe(
      "Intro\n- Division I\nOutro"
    );
  });

  it("takes bullets off when every line already has one", () => {
    expect(run(toggleBulletList, "- one\n- two", 0, 11).value).toBe("one\ntwo");
  });

  it("turns a numbered list into a bulleted one, and leaves blank lines alone", () => {
    expect(run(toggleBulletList, "1. one\n\n2. two", 0, 13).value).toBe("- one\n\n- two");
  });

  it("starts a bullet on an empty line", () => {
    const result = run(toggleBulletList, "Intro\n", 6);
    expect(result.value).toBe("Intro\n- ");
  });

  it("does not include the next line when the selection ends just after a line break", () => {
    const text = "one\ntwo\nthree";
    expect(run(toggleBulletList, text, 0, 8).value).toBe("- one\n- two\nthree");
  });
});

describe("toggleNumberedList", () => {
  it("numbers the lines in order, skipping blank ones", () => {
    const text = "Visit the site\nPay the fee\n\nGet your card";
    expect(run(toggleNumberedList, text, 0, text.length).value).toBe(
      "1. Visit the site\n2. Pay the fee\n\n3. Get your card"
    );
  });

  it("takes numbers off when every line already has one", () => {
    expect(run(toggleNumberedList, "1. one\n2. two", 0, 13).value).toBe("one\ntwo");
  });

  it("turns bullets into numbers", () => {
    expect(run(toggleNumberedList, "- one\n- two", 0, 11).value).toBe("1. one\n2. two");
  });
});

describe("toggleHeading", () => {
  it("makes a line a heading, and takes it off again", () => {
    const first = run(toggleHeading, "Steps to register", 3);
    expect(first.value).toBe("### Steps to register");
    expect(run(toggleHeading, first.value, 3).value).toBe("Steps to register");
  });

  it("replaces a list marker rather than stacking on it", () => {
    expect(run(toggleHeading, "- Steps", 2).value).toBe("### Steps");
  });
});

describe("insertTable", () => {
  it("inserts a template with blank lines around it, and selects the first heading", () => {
    const result = run(insertTable, "Before\nAfter", 6);
    expect(result.value).toBe(
      "Before\n\n| Heading | Heading | Heading |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |\n\nAfter"
    );
    expect(result.selected).toBe("Heading");
  });

  it("needs no blank line at the very start or end", () => {
    expect(run(insertTable, "", 0).value.startsWith("| Heading")).toBe(true);
    expect(run(insertTable, "", 0).value.endsWith("| Cell |")).toBe(true);
  });

  it("turns selected spreadsheet rows into the table instead of a blank template", () => {
    const text = "Series\tWinner\nTalent Series\t10";
    const result = run(insertTable, text, 0, text.length);
    expect(result.value).toBe("| Series | Winner |\n| --- | --- |\n| Talent Series | 10 |");
  });
});

describe("tidyAll", () => {
  it("rewrites Word bullets and trailing spaces in the whole text", () => {
    const text = "Intro \n•\tOne \n•\tTwo";
    expect(applyEdit(text, tidyAll(text))).toBe("Intro\n- One\n- Two");
  });
});

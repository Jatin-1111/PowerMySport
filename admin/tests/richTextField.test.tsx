// @vitest-environment jsdom
//
// The editor an author writes pathway answers in: toolbar, paste cleaning,
// preview and the length counter. jsdom has no execCommand, so these run the
// editor's fallback path (setRangeText); in a browser the same edit goes through
// execCommand so Ctrl+Z undoes it, and the edit itself is covered in
// richTextEdit.test.ts.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RichTextField } from "@/modules/admin/components/pathway/RichTextField";

function Harness({ initial = "", maxLength }: { initial?: string; maxLength?: number }) {
  const [value, setValue] = useState(initial);
  return <RichTextField value={value} onChange={setValue} {...(maxLength ? { maxLength } : {})} />;
}

const box = () => screen.getByRole("textbox") as HTMLTextAreaElement;

const selectText = (part: string) => {
  const el = box();
  const start = el.value.indexOf(part);
  el.setSelectionRange(start, start + part.length);
};

const paste = (data: { html?: string; text?: string }) => {
  const el = box();
  // fireEvent returns false when the handler called preventDefault().
  const notPrevented = fireEvent.paste(el, {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? (data.html ?? "") : (data.text ?? "")),
    },
  });
  return { prevented: !notPrevented };
};

describe("RichTextField toolbar", () => {
  it("bolds the selected words", () => {
    render(<Harness initial="Pay the annual fee" />);
    selectText("annual");
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(box().value).toBe("Pay the **annual** fee");
  });

  it("bolds with Ctrl+B", () => {
    render(<Harness initial="Pay the annual fee" />);
    selectText("annual");
    fireEvent.keyDown(box(), { key: "b", ctrlKey: true });
    expect(box().value).toBe("Pay the **annual** fee");
  });

  it("makes the selected lines a bulleted list, and a numbered one", () => {
    render(<Harness initial={"Division I\nDivision II"} />);
    box().setSelectionRange(0, box().value.length);
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    expect(box().value).toBe("- Division I\n- Division II");

    box().setSelectionRange(0, box().value.length);
    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    expect(box().value).toBe("1. Division I\n2. Division II");
  });

  it("inserts a table", () => {
    render(<Harness initial="Points" />);
    box().setSelectionRange(6, 6);
    fireEvent.click(screen.getByRole("button", { name: "Insert a table" }));
    expect(box().value).toContain("| Heading | Heading | Heading |");
    expect(box().value.startsWith("Points\n\n|")).toBe(true);
  });

  it("tidies old pasted bullets in the whole text", () => {
    render(<Harness initial={"•\tOne \n•\tTwo"} />);
    fireEvent.click(screen.getByRole("button", { name: /Tidy the whole text/ }));
    expect(box().value).toBe("- One\n- Two");
  });
});

describe("RichTextField paste", () => {
  it("keeps the lists and bold from a Word or Docs paste", () => {
    render(<Harness />);
    const { prevented } = paste({
      html: `<ol><li><p>Visit the site.</p></li><li><p>Pay the <b>fee</b>.</p></li></ol>`,
      text: "Visit the site.\nPay the fee.",
    });
    expect(prevented).toBe(true);
    expect(box().value).toBe("1. Visit the site.\n2. Pay the **fee**.");
    expect(screen.getByText(/Kept the formatting from your paste/)).toBeTruthy();
  });

  it("turns pasted Word bullets into list items", () => {
    render(<Harness />);
    paste({ text: "•\tDivision I \n•\tDivision II" });
    expect(box().value).toBe("- Division I\n- Division II");
    expect(screen.getByText(/Tidied the pasted bullets/)).toBeTruthy();
  });

  it("pastes plain text that needs no tidying natively, and says nothing", () => {
    render(<Harness />);
    const { prevented } = paste({ text: "Players must hold a valid registration number." });
    expect(prevented).toBe(false);
    expect(screen.queryByText(/Ctrl\+Z undoes it/)).toBeNull();
  });

  it("drops the paste note once the author types again", () => {
    render(<Harness />);
    paste({ text: "•\tOne \n•\tTwo" });
    expect(screen.getByText(/Ctrl\+Z undoes it/)).toBeTruthy();
    fireEvent.change(box(), { target: { value: "- One\n- Two\n- Three" } });
    expect(screen.queryByText(/Ctrl\+Z undoes it/)).toBeNull();
  });
});

describe("RichTextField preview", () => {
  it("shows the text as parents will see it, with the toolbar out of the way", () => {
    render(<Harness initial={"Steps:\n\n1. Visit the site\n2. Pay the fee"} />);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("This is how parents will see it")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    // Only the preview's own list: the formatting help is a list too.
    const preview = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  });

  it("says so when there is nothing to preview, and keeps the text when switching back", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    fireEvent.change(box(), { target: { value: "Kept" } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Write" }));
    expect(box().value).toBe("Kept");
  });
});

describe("RichTextField counter", () => {
  it("shows the length against the limit", () => {
    render(<Harness initial="Hello" maxLength={2000} />);
    expect(screen.getByText("5 / 2,000")).toBeTruthy();
  });

  it("warns when the text is too long to save", () => {
    render(<Harness initial={"x".repeat(2001)} maxLength={2000} />);
    expect(screen.getByText(/too long to save/)).toBeTruthy();
  });
});

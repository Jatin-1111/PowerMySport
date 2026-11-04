// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiProcessing } from "@/modules/legal/components/privacy/AiProcessing";
import { PrivacyToc } from "@/modules/legal/components/privacy/PrivacyToc";

/**
 * This is a legal disclosure, so what is pinned here is what it must never do:
 * claim something about the provider that nobody has verified, say it sends data it
 * does not, or fail to say what it does send.
 *
 * The provider's retention and training behaviour depends on which Gemini plan the
 * production key is on and has not been confirmed, so the text must not assert
 * either way until the owner has checked. If someone fills in the held-back
 * statement, these tests are the reminder to read the TODO in the component first.
 */

const text = () => document.body.textContent ?? "";

describe("the AI processing disclosure", () => {
  it("names the provider and says what the planner sends", () => {
    render(<AiProcessing />);

    expect(text()).toMatch(/Google.s Gemini API/);
    expect(text()).toMatch(/first name, age list \(for example Under-14\), ranking position/);
    expect(text()).toMatch(/home city, if you give one/);
    expect(text()).toMatch(/note you type on them/);
  });

  it("says what is not sent", () => {
    render(<AiProcessing />);
    expect(text()).toMatch(
      /do not send a date of birth, a federation registration number, an email address, a phone number or a street address/
    );
  });

  it("says that the entry rules, not the AI, decide eligibility", () => {
    render(<AiProcessing />);
    expect(text()).toMatch(/decided by the federation.s published entry rules/);
    expect(text()).toMatch(/not by the AI/);
  });

  it("says estimates can be wrong and that entry fees are never estimated", () => {
    render(<AiProcessing />);
    expect(text()).toMatch(/Estimates and suggestions can be wrong/);
    expect(text()).toMatch(/entry fees are never\s+estimated/);
  });

  it("makes no claim about what the provider keeps or trains on, until one has been verified", () => {
    render(<AiProcessing />);

    // Neither direction: "does not train" and "may train" are both unverified.
    expect(text()).not.toMatch(
      /\b(not|never|n.t)\b[^.]{0,40}\b(train|used to improve|retain|keep|store)/i
    );
    expect(text()).not.toMatch(/\bwill (train|retain|keep|store)\b/i);
    expect(text()).not.toMatch(/deleted (immediately|within|after)/i);
    // It points to where the provider states its own terms.
    expect(screen.getByRole("link", { name: "ai.google.dev/gemini-api/terms" })).toBeTruthy();
  });

  it("states only what account deletion verifiably removes", () => {
    render(<AiProcessing />);
    expect(text()).toMatch(/removes your season\s+plans, linked rankings and saved city/);
    expect(text()).not.toMatch(/from our systems/);
  });

  it("uses no dashes in copy, which this site does not do", () => {
    render(<AiProcessing />);
    expect(text()).not.toMatch(/[–—]/);
  });

  it("links to Your Rights, which exists on the page", () => {
    render(<AiProcessing />);
    expect(screen.getByRole("link", { name: "Your Rights" }).getAttribute("href")).toBe(
      "#your-rights"
    );
  });

  it("is a section the table of contents can jump to", () => {
    const { container } = render(<AiProcessing />);
    expect(container.querySelector("section#ai-processing")).toBeTruthy();
  });
});

describe("the table of contents", () => {
  it("lists the section, between sharing and retention, where it sits in the document", () => {
    render(<PrivacyToc />);

    const labels = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim())
      .filter((label): label is string => Boolean(label));
    const ai = labels.findIndex((label) => label.includes("AI Features and Model Providers"));

    expect(ai).toBeGreaterThan(-1);
    expect(labels[ai - 1]).toMatch(/Information Sharing and Disclosure/);
    expect(labels[ai + 1]).toMatch(/Data Retention/);
  });
});

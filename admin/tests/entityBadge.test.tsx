// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityBadge } from "@/modules/shared/ui/EntityBadge";

describe("EntityBadge", () => {
  it("renders the resolved name", () => {
    render(<EntityBadge name="Jane Doe" />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders the email when provided alongside the name", () => {
    render(<EntityBadge name="Jane Doe" email="jane@example.com" />);

    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("omits the email line when no email is provided", () => {
    render(<EntityBadge name="Jane Doe" />);

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("shows the uppercased first initial as the avatar glyph", () => {
    render(<EntityBadge name="jane doe" />);

    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("falls back to a labeled 'Unresolved' chip when name is missing", () => {
    render(<EntityBadge name={null} />);

    expect(screen.getByText("Unresolved")).toBeInTheDocument();
    expect(
      screen.getByTitle("This reference could not be resolved to a record.")
    ).toBeInTheDocument();
  });

  it("honors a custom fallback label when unresolved", () => {
    render(<EntityBadge name={undefined} fallbackLabel="No coach assigned" />);

    expect(screen.getByText("No coach assigned")).toBeInTheDocument();
  });

  it("does not render an avatar or email in the fallback state", () => {
    render(<EntityBadge name="" email="ignored@example.com" />);

    expect(screen.queryByText("ignored@example.com")).not.toBeInTheDocument();
  });

  it("never renders a raw ObjectId-shaped string as the visible label when unresolved", () => {
    render(<EntityBadge name={null} />);

    expect(screen.queryByText(/^[a-f0-9]{24}$/)).not.toBeInTheDocument();
  });
});

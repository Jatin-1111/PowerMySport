// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// This is one of the plan's 6 largest client/src/app pages (985 lines) with
// no extracted hook/sub-components — everything lives inline in the default
// export, so this exercises the whole page component directly rather than a
// split-out unit, unlike the admin hook tests written earlier in this phase.

const postMock = vi.fn();
vi.mock("@/lib/api/axios", () => ({
  default: { post: (...args: unknown[]) => postMock(...args) },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} alt={props.alt as string} />
    );
  },
}));

import ContactPage from "../src/app/(marketing)/contact/page";

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/Email Address/i), {
    target: { value: "jane@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/Message/i), {
    target: { value: "I have a question about booking a venue." },
  });
};

// The trigger's accessible NAME comes from its <label for="subject">
// ("Subject *"), not its own visible text ("Select a subject" / the chosen
// value) — a <label for> always wins the accname computation over subtree
// text content. So the trigger is found by id, and its current selection is
// checked via its own text content rather than via getByRole's `name`.
const subjectTrigger = () => document.getElementById("subject") as HTMLButtonElement;

// getByRole("option", ...) returns the <li role="option">, not the <button>
// nested inside it that actually carries onClick — clicking the li directly
// never bubbles down into that button, so the option's own button has to be
// the fireEvent target.
const selectSubject = (label: string) => {
  fireEvent.click(subjectTrigger());
  const option = screen.getByRole("option", { name: label });
  fireEvent.click(option.querySelector("button") as HTMLButtonElement);
};

beforeEach(() => {
  postMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  window.history.pushState({}, "", "/contact");
});

describe("ContactPage — subject prefill", () => {
  it("prefills the subject from a ?subject= query param", () => {
    window.history.pushState({}, "", "/contact?subject=Partnership");
    render(<ContactPage />);

    expect(subjectTrigger()).toHaveTextContent("Partnership");
  });

  it("shows the placeholder when there is no query param", () => {
    render(<ContactPage />);

    expect(subjectTrigger()).toHaveTextContent("Select a subject");
  });
});

describe("ContactPage — the custom subject select", () => {
  it("opens on click and lists every subject option", () => {
    render(<ContactPage />);

    fireEvent.click(subjectTrigger());

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Billing and payments" })).toBeInTheDocument();
  });

  it("selects an option on click and closes the dropdown", () => {
    render(<ContactPage />);
    selectSubject("Technical support");

    expect(subjectTrigger()).toHaveTextContent("Technical support");
    // AnimatePresence's exit animation leaves the listbox node lingering in
    // jsdom (no real animation frames to complete it) even after `open`
    // state has already flipped, so `aria-expanded` — a direct reflection of
    // that state — is the reliable "closed" signal here, not DOM presence.
    expect(subjectTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without changing the selection", () => {
    render(<ContactPage />);

    fireEvent.click(subjectTrigger());
    // Escape is handled per-option (handleOptionKeyDown), not on the <ul>
    // itself — the options are what actually receive focus (and so real key
    // events) once the dropdown opens.
    const firstOption = screen.getByRole("option", { name: "General enquiry" });
    fireEvent.keyDown(firstOption.querySelector("button") as HTMLButtonElement, {
      key: "Escape",
    });

    expect(subjectTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(subjectTrigger()).toHaveTextContent("Select a subject");
  });
});

describe("ContactPage — submitting the form", () => {
  it("blocks submission and toasts when no subject is selected", async () => {
    render(<ContactPage />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Please select a subject.");
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("submits the ticket payload and shows the success banner", async () => {
    postMock.mockResolvedValue({ data: { success: true } });
    render(<ContactPage />);
    fillRequiredFields();
    selectSubject("General enquiry");

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/support-tickets/public",
        expect.objectContaining({
          requesterName: "Jane Doe",
          requesterEmail: "jane@example.com",
          subject: "General enquiry",
          description: "I have a question about booking a venue.",
          category: "OTHER",
          priority: "MEDIUM",
        })
      );
    });
    expect(await screen.findByText(/Message sent/i)).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalled();

    // Fields reset after a successful submit — the message textarea is
    // empty again rather than showing what was just sent.
    expect(screen.getByLabelText(/Message/i)).toHaveValue("");
  });

  it("shows the error banner and re-enables the button when the request fails", async () => {
    postMock.mockRejectedValue(new Error("network down"));
    render(<ContactPage />);
    fillRequiredFields();
    selectSubject("General enquiry");

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Failed to send message. Try again.");
    expect(screen.getByRole("button", { name: /Send Message/i })).toBeInTheDocument();
  });

  it("does not reset the form on a failed submission", async () => {
    postMock.mockRejectedValue(new Error("network down"));
    render(<ContactPage />);
    fillRequiredFields();
    selectSubject("General enquiry");

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await screen.findByText(/Something went wrong/i);
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue("Jane Doe");
  });
});

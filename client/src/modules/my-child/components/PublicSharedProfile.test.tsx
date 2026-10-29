// @vitest-environment jsdom
import type { ChildSharePublicView } from "@powermysport/shared-types";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  fetchSharedPlayback: vi.fn(),
  sendContactRequest: vi.fn(),
  sharedCvUrl: (token: string) => `https://api.example/api/share/${token}/cv.pdf`,
}));
vi.mock("@/modules/my-child/services/sharedProfile", () => service);

import { PublicSharedProfile } from "./PublicSharedProfile";
import { SharedProfile } from "./SharedProfile";

const TOKEN = "t".repeat(43);

const view: ChildSharePublicView = {
  child: {
    name: "Anaya",
    sport: "Tennis",
    level: "competitive",
    sinceYear: 2021,
    state: null,
    classYear: null,
  },
  stats: { yearsInSport: 5 },
  academics: null,
  timeline: [],
  videos: [],
  sections: ["results"],
  sharedAt: "2026-11-03T00:00:00.000Z",
  expiresAt: "2026-12-03T00:00:00.000Z",
  notice:
    "Entries are provided by the family unless marked as from a federation source. PowerMySport does not verify them.",
};

beforeEach(() => {
  service.fetchSharedPlayback.mockReset();
  service.sendContactRequest.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("what a coach can do with a profile", () => {
  it("offers the CV as a plain link to the file for this link, and a button to ask for contact", () => {
    render(<PublicSharedProfile view={view} token={TOKEN} />);
    const cv = screen.getByRole("link", { name: "Download CV (PDF)" });
    expect(cv.getAttribute("href")).toBe(`https://api.example/api/share/${TOKEN}/cv.pdf`);
    expect(screen.getByRole("button", { name: "Request contact" })).toBeTruthy();
  });

  it("shows no actions in a preview, where nothing can be sent or downloaded yet", () => {
    render(<SharedProfile view={view} preview />);
    expect(screen.queryByRole("link", { name: /Download CV/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Request contact" })).toBeNull();
  });
});

const openForm = () => {
  render(<PublicSharedProfile view={view} token={TOKEN} />);
  fireEvent.click(screen.getByRole("button", { name: "Request contact" }));
  return screen.findByRole("dialog");
};

const fill = (
  dialog: HTMLElement,
  name = "Coach Miller",
  email = "miller@university.edu",
  message = ""
) => {
  fireEvent.change(within(dialog).getByLabelText("Your name"), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText("Your email"), { target: { value: email } });
  if (message)
    fireEvent.change(within(dialog).getByLabelText(/^Message/), { target: { value: message } });
};

describe("asking the family to get in touch", () => {
  it("tells the coach what happens to their name and email before they type them", async () => {
    const dialog = await openForm();
    expect(
      within(dialog).getByText(
        "Your message goes to the family through PowerMySport. Your name and email are shared with them and deleted from our records after 90 days."
      )
    ).toBeTruthy();
    expect(within(dialog).getByLabelText("Your name")).toBeTruthy();
    expect(within(dialog).getByLabelText("Your email")).toBeTruthy();
    expect(within(dialog).getByLabelText(/^Message/)).toBeTruthy();
  });

  it("sends the request for this link, then says it was sent to the family", async () => {
    const dialog = await openForm();
    fill(dialog, "  Coach Miller ", " Miller@University.edu ", "We would like to talk.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(service.sendContactRequest).toHaveBeenCalledTimes(1));
    expect(service.sendContactRequest).toHaveBeenCalledWith(TOKEN, {
      name: "Coach Miller",
      email: "Miller@University.edu",
      message: "We would like to talk.",
    });
    expect((await within(dialog).findByRole("status")).textContent).toBe("Sent to the family.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("leaves the message out when there is none", async () => {
    const dialog = await openForm();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(service.sendContactRequest).toHaveBeenCalled());
    expect(service.sendContactRequest.mock.calls[0]![1]).toEqual({
      name: "Coach Miller",
      email: "miller@university.edu",
    });
  });

  it("asks for a name and a plausible email before sending, and keeps what was typed", async () => {
    const dialog = await openForm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/name/i);

    fill(dialog, "Coach", "not-an-email");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toMatch(/email/i));
    expect((within(dialog).getByLabelText("Your name") as HTMLInputElement).value).toBe("Coach");
    expect(service.sendContactRequest).not.toHaveBeenCalled();
  });

  it("shows the reason when the request is refused, and lets the coach try again", async () => {
    service.sendContactRequest
      .mockResolvedValueOnce({ ok: false, message: "This link has taken all the requests it can." })
      .mockResolvedValueOnce({ ok: true });
    const dialog = await openForm();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "This link has taken all the requests it can."
    );
    expect((within(dialog).getByLabelText("Your email") as HTMLInputElement).value).toBe(
      "miller@university.edu"
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    await within(dialog).findByText("Sent to the family.");
    expect(service.sendContactRequest).toHaveBeenCalledTimes(2);
  });

  it("does not send anything when the coach cancels", async () => {
    const dialog = await openForm();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(service.sendContactRequest).not.toHaveBeenCalled();
  });
});

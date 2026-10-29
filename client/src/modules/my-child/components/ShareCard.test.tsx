// @vitest-environment jsdom
import type {
  ChildHistoryView,
  ChildShareListItem,
  ChildSharePublicView,
} from "@powermysport/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  previewShare: vi.fn(),
  createShare: vi.fn(),
  listShares: vi.fn(),
  revokeShare: vi.fn(),
  downloadCv: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const saved = vi.hoisted(() => ({ saveBlob: vi.fn() }));

vi.mock("@/modules/my-child/services/childHistory", () => ({ childHistoryApi: api }));
vi.mock("@/lib/toast", () => ({ toast: toasts }));
vi.mock("@/modules/my-child/utils/saveFile", async (original) => ({
  ...(await original<typeof import("@/modules/my-child/utils/saveFile")>()),
  saveBlob: saved.saveBlob,
}));

import { useAuthStore } from "@/modules/auth/store/authStore";
import { ShareCard } from "./ShareCard";

const NOW = "2026-11-03T00:00:00.000Z";

const history = (over: Partial<ChildHistoryView> = {}): ChildHistoryView => ({
  child: { id: "c1", name: "Anaya", sport: "Tennis", level: "competitive", sinceYear: 2021 },
  stats: { yearsInSport: 5, tournaments: 1, awards: 0 },
  academics: { board: "CBSE", graduationYear: 2029 },
  timeline: [
    {
      id: "e1",
      origin: "stored",
      kind: "tournament_result",
      section: "results",
      title: "Pune Open",
      occurredOn: "2026-03-01T00:00:00.000Z",
      datePrecision: "month",
      source: "parent",
      editable: true,
      canAddResult: false,
    },
  ],
  videos: [
    {
      id: "v1",
      title: "Final set",
      status: "ready",
      durationSeconds: 65,
      sizeBytes: 10_000_000,
      createdAt: NOW,
    },
    {
      id: "v2",
      title: "Serve practice",
      status: "ready",
      durationSeconds: 30,
      sizeBytes: 5_000_000,
      createdAt: NOW,
    },
  ],
  videoConsent: true,
  usage: { events: 1, limit: 300 },
  ...over,
});

const previewView = (): ChildSharePublicView => ({
  child: {
    name: "Anaya",
    sport: "Tennis",
    level: "competitive",
    sinceYear: 2021,
    state: null,
    classYear: 2029,
  },
  stats: { yearsInSport: 5 },
  academics: { board: "CBSE" },
  timeline: [],
  videos: [],
  sections: ["results"],
  sharedAt: NOW,
  expiresAt: "2026-12-03T00:00:00.000Z",
  notice:
    "Entries are provided by the family unless marked as from a federation source. PowerMySport does not verify them.",
});

const item = (over: Partial<ChildShareListItem> = {}): ChildShareListItem => ({
  id: "s1",
  recipientLabel: "Coach Miller",
  sections: ["results"],
  videoCount: 0,
  createdAt: NOW,
  expiresAt: "2026-12-03T00:00:00.000Z",
  status: "active",
  openCount: 0,
  ...over,
});

const renderCard = (h: ChildHistoryView = history()) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ShareCard childId="c1" history={h} />
    </QueryClientProvider>
  );

beforeEach(() => {
  useAuthStore.setState({ hydrated: true, token: "t" });
  for (const fn of [...Object.values(api), toasts.success, toasts.error, saved.saveBlob]) {
    fn.mockReset();
  }
  api.downloadCv.mockResolvedValue(new Blob(["%PDF-"]));
  api.listShares.mockResolvedValue([]);
  api.previewShare.mockResolvedValue(previewView());
  api.createShare.mockResolvedValue({
    share: item({ id: "new" }),
    url: `https://powermysport.com/share/${"A".repeat(43)}`,
  });
  api.revokeShare.mockResolvedValue(item({ status: "revoked" }));
});

afterEach(cleanup);

const open = async () => {
  renderCard();
  fireEvent.click(screen.getByRole("button", { name: "Share with a coach" }));
  return screen.findByRole("dialog");
};

const toStepTwo = async (dialog: HTMLElement) => {
  fireEvent.change(within(dialog).getByLabelText("Who is this link for"), {
    target: { value: "Coach Miller" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
  await within(dialog).findByText("Step 2 of 2");
};

describe("step 1: who it is for and what they see", () => {
  it("starts with everything ticked, academics included, and videos listed to untick", async () => {
    const dialog = await open();
    expect(within(dialog).getByText("Step 1 of 2")).toBeTruthy();
    for (const label of [/^Results/, /^Academics/, /^Videos/]) {
      const box = within(dialog).getByRole("checkbox", { name: label }) as HTMLInputElement;
      expect(box.checked).toBe(true);
    }
    expect(
      (within(dialog).getByRole("checkbox", { name: /Final set/ }) as HTMLInputElement).checked
    ).toBe(true);
    expect(
      (within(dialog).getByRole("checkbox", { name: /Serve practice/ }) as HTMLInputElement).checked
    ).toBe(true);
  });

  it("offers only sections that have something in them", async () => {
    renderCard(history({ academics: null, videos: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Share with a coach" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /^Results/ })).toBeTruthy();
    expect(within(dialog).queryByRole("checkbox", { name: /^Academics/ })).toBeNull();
    expect(within(dialog).queryByRole("checkbox", { name: /^Videos/ })).toBeNull();
  });

  it("asks who the link is for and for at least one tick before going on", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/who this link is for/i);

    fireEvent.change(within(dialog).getByLabelText("Who is this link for"), {
      target: { value: "Coach" },
    });
    for (const box of within(dialog).getAllByRole("checkbox").slice(0, 3)) {
      if ((box as HTMLInputElement).checked) fireEvent.click(box);
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toMatch(/at least one/i)
    );
    expect(api.previewShare).not.toHaveBeenCalled();
  });

  it("is disabled when there is nothing to share, and says what to add", () => {
    renderCard(history({ timeline: [], academics: null, videos: [] }));
    expect(
      screen.getByRole("button", { name: "Share with a coach" }).hasAttribute("disabled")
    ).toBe(true);
    expect(screen.getByText(/Add a result, school details or a video first/)).toBeTruthy();
  });
});

describe("step 2: check and agree", () => {
  it("shows the preview built from the exact ticks, in this order of sections", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Serve practice/ }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /^Academics/ }));
    await toStepTwo(dialog);

    await waitFor(() => expect(api.previewShare).toHaveBeenCalledTimes(1));
    expect(api.previewShare).toHaveBeenCalledWith("c1", {
      sections: ["results", "videos"],
      videoIds: ["v1"],
    });
    expect(await within(dialog).findByRole("heading", { level: 2, name: "Anaya" })).toBeTruthy();
  });

  it("states the approved notice, with the expiry date, and starts with the box unticked", async () => {
    const dialog = await open();
    await toStepTwo(dialog);
    expect(
      await within(dialog).findByText(
        /Anyone with this link can see the sections shown above until the link expires on 3 Dec 2026 or you stop sharing/
      )
    ).toBeTruthy();
    expect(within(dialog).getByText("Before you create this link")).toBeTruthy();
    expect(
      within(dialog).getByText("PowerMySport does not check what you have entered.")
    ).toBeTruthy();
    expect(within(dialog).getByText(/keeps that copy, and we cannot take it back/)).toBeTruthy();
    expect(within(dialog).getByText(/We do not track the coach in any other way/)).toBeTruthy();
    const agree = within(dialog).getByRole("checkbox") as HTMLInputElement;
    expect(agree.checked).toBe(false);
    expect(
      within(dialog).getByRole("button", { name: "Create link" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("says the coach can ask to get in touch, with the family's address kept private, and that a saved CV or clip cannot be taken back", async () => {
    const dialog = await open();
    await toStepTwo(dialog);
    await within(dialog).findByText("Before you create this link");
    expect(
      within(dialog).getByText(
        /The coach can ask to contact you\. Your email is never shown to them/
      )
    ).toBeTruthy();
    expect(
      within(dialog).getByText(/has already downloaded the CV or a clip keeps that copy/)
    ).toBeTruthy();
  });

  it("downloads the parent's own PDF of exactly this choice, and says it makes no link", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Serve practice/ }));
    await toStepTwo(dialog);
    await within(dialog).findByRole("heading", { level: 2, name: "Anaya" });
    expect(within(dialog).getByText(/does not make a link or send anything/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Download as PDF" }));
    await waitFor(() => expect(saved.saveBlob).toHaveBeenCalledTimes(1));
    expect(api.downloadCv).toHaveBeenCalledWith("c1", {
      sections: ["results", "academics", "videos"],
      videoIds: ["v1"],
    });
    expect(saved.saveBlob.mock.calls[0]![1]).toBe("anaya-sporting-profile.pdf");
    expect(api.createShare).not.toHaveBeenCalled();
  });

  it("says so when the PDF could not be made, and creates nothing", async () => {
    api.downloadCv.mockRejectedValue(new Error("offline"));
    const dialog = await open();
    await toStepTwo(dialog);
    await within(dialog).findByRole("heading", { level: 2, name: "Anaya" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Download as PDF" }));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith("Could not make the PDF. Try again.")
    );
    expect(saved.saveBlob).not.toHaveBeenCalled();
    expect(api.createShare).not.toHaveBeenCalled();
  });

  it("will not offer the PDF until the preview has loaded", async () => {
    api.previewShare.mockReturnValue(new Promise(() => undefined));
    const dialog = await open();
    await toStepTwo(dialog);
    expect(
      within(dialog).getByRole("button", { name: "Download as PDF" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("goes back to the ticks with them as they were", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /^Academics/ }));
    await toStepTwo(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(
      (within(dialog).getByRole("checkbox", { name: /^Academics/ }) as HTMLInputElement).checked
    ).toBe(false);
    expect((within(dialog).getByLabelText("Who is this link for") as HTMLInputElement).value).toBe(
      "Coach Miller"
    );
  });

  it("says so when the preview cannot be loaded, and will not create a link without one", async () => {
    api.previewShare.mockRejectedValue(new Error("offline"));
    const dialog = await open();
    await toStepTwo(dialog);
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(
      /preview could not be loaded/
    );
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(
      within(dialog).getByRole("button", { name: "Create link" }).hasAttribute("disabled")
    ).toBe(true);
  });
});

describe("making the link", () => {
  const agreeAndCreate = async (dialog: HTMLElement) => {
    await within(dialog).findByRole("heading", { level: 2, name: "Anaya" });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create link" }));
  };

  it("sends the agreement with the choice, then shows the link once with ways to send it", async () => {
    const dialog = await open();
    await toStepTwo(dialog);
    await agreeAndCreate(dialog);

    await waitFor(() => expect(api.createShare).toHaveBeenCalledTimes(1));
    expect(api.createShare).toHaveBeenCalledWith("c1", {
      recipientLabel: "Coach Miller",
      sections: ["results", "academics", "videos"],
      videoIds: ["v1", "v2"],
      consent: true,
    });

    expect(await within(dialog).findByText("Link created")).toBeTruthy();
    expect((within(dialog).getByLabelText("The link") as HTMLInputElement).value).toBe(
      `https://powermysport.com/share/${"A".repeat(43)}`
    );
    expect(within(dialog).getByText(/shown once/i)).toBeTruthy();
    const whatsapp = within(dialog).getByRole("link", { name: /send on whatsapp/i });
    expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(whatsapp.getAttribute("rel")).toContain("noopener");
  });

  it("copies the link, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const dialog = await open();
    await toStepTwo(dialog);
    await agreeAndCreate(dialog);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Copy link" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`https://powermysport.com/share/${"A".repeat(43)}`)
    );
    expect(toasts.success).toHaveBeenCalledWith("Link copied.");
  });

  it("selects the link for the parent to copy by hand when the browser will not copy it", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
      configurable: true,
    });
    const dialog = await open();
    await toStepTwo(dialog);
    await agreeAndCreate(dialog);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(String(toasts.error.mock.calls[0]![0])).toMatch(/copy it yourself/);
  });

  it("stays on the step with the choice intact when the server refuses", async () => {
    api.createShare.mockRejectedValue({
      response: { data: { message: "A child can have up to 20 links." } },
    });
    const dialog = await open();
    await toStepTwo(dialog);
    await agreeAndCreate(dialog);
    await waitFor(() => expect(api.createShare).toHaveBeenCalled());
    expect(toasts.error).toHaveBeenCalledWith("A child can have up to 20 links.");
    expect(within(dialog).getByRole("button", { name: "Create link" })).toBeTruthy();
    expect(within(dialog).queryByText("Link created")).toBeNull();
  });
});

describe("the list of links", () => {
  it("shows who each is for, its state, and how often it was opened", async () => {
    api.listShares.mockResolvedValue([
      item({
        id: "a",
        recipientLabel: "Coach Miller",
        openCount: 3,
        lastOpenedAt: "2026-11-10T00:00:00.000Z",
      }),
      item({
        id: "b",
        recipientLabel: "Old link",
        status: "expired",
        expiresAt: "2026-10-01T00:00:00.000Z",
      }),
      item({
        id: "c",
        recipientLabel: "Mistake",
        status: "revoked",
        revokedAt: "2026-11-04T00:00:00.000Z",
        openCount: 1,
      }),
    ]);
    renderCard();
    const list = await screen.findByRole("list", { name: "Your links" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("Active until 3 Dec 2026");
    expect(rows[0]!.textContent).toContain("Opened 3 times, last on 10 Nov 2026");
    expect(rows[1]!.textContent).toContain("Expired on 1 Oct 2026");
    expect(rows[1]!.textContent).toContain("Not opened yet");
    expect(rows[2]!.textContent).toContain("Stopped on 4 Nov 2026");
    expect(rows[2]!.textContent).toContain("Opened 1 time");
  });

  it("offers Stop sharing only for a link that is still active, and asks first", async () => {
    api.listShares.mockResolvedValue([
      item({ id: "a", recipientLabel: "Coach Miller" }),
      item({ id: "b", recipientLabel: "Old link", status: "expired" }),
    ]);
    renderCard();
    await screen.findByText("Coach Miller");
    expect(screen.queryByRole("button", { name: "Stop sharing with Old link" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Stop sharing with Coach Miller" }));
    expect(api.revokeShare).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/The link stops working straight away/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(api.revokeShare).toHaveBeenCalledWith("c1", "a"));
  });

  it("never shows a link or a token in the list", async () => {
    api.listShares.mockResolvedValue([item()]);
    renderCard();
    await screen.findByText("Coach Miller");
    expect(document.body.innerHTML).not.toMatch(/\/share\//);
  });
});

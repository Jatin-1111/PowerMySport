// @vitest-environment jsdom
import type { ChildVideoView } from "@powermysport/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  startVideo: vi.fn(),
  completeVideo: vi.fn(),
  deleteVideo: vi.fn(),
  videoPlayback: vi.fn(),
}));
const upload = vi.hoisted(() => ({ checkPlayable: vi.fn(), uploadParts: vi.fn() }));

vi.mock("@/modules/my-child/services/childHistory", () => ({ childHistoryApi: api }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/my-child/utils/uploadVideo", async (original) => ({
  ...(await original<typeof import("@/modules/my-child/utils/uploadVideo")>()),
  checkPlayable: upload.checkPlayable,
  uploadParts: upload.uploadParts,
}));

import { VideosCard } from "./VideosCard";

const MB = 1024 * 1024;

const ready = (over: Partial<ChildVideoView> = {}): ChildVideoView => ({
  id: "v1",
  title: "Final set",
  status: "ready",
  sizeBytes: 42 * MB,
  durationSeconds: 65,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

const onAgree = vi.fn();
const onRemove = vi.fn();

const renderCard = (props: Partial<Parameters<typeof VideosCard>[0]> = {}) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VideosCard
        childId="c1"
        videos={[]}
        consentGiven
        onAgree={onAgree}
        onRemove={onRemove}
        removing={false}
        {...props}
      />
    </QueryClientProvider>
  );

const clip = (name = "match.mp4", type = "video/mp4", size = 20 * MB) => {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Choose a video"), { target: { files: [file] } });

beforeEach(() => {
  for (const fn of [...Object.values(api), ...Object.values(upload), onAgree, onRemove])
    fn.mockReset();
  onAgree.mockResolvedValue(undefined);
  upload.checkPlayable.mockResolvedValue({ playable: true, durationSeconds: 60 });
  api.startVideo.mockResolvedValue({
    videoId: "new1",
    partBytes: 8 * MB,
    parts: [{ partNumber: 1, url: "https://storage.example/1", sizeBytes: 20 * MB }],
  });
  upload.uploadParts.mockResolvedValue([{ partNumber: 1, etag: '"e1"' }]);
  api.completeVideo.mockResolvedValue(ready({ id: "new1" }));
  api.deleteVideo.mockResolvedValue(undefined);
  api.videoPlayback.mockResolvedValue({ url: "https://storage.example/play?sig=1" });
});

afterEach(cleanup);

describe("adding a video", () => {
  it("checks the clip plays, asks the server, sends the parts, then finishes it", async () => {
    renderCard();
    choose(clip("Semi final.mp4"));

    await waitFor(() => expect(api.completeVideo).toHaveBeenCalledTimes(1));
    expect(upload.checkPlayable).toHaveBeenCalledTimes(1);
    expect(api.startVideo).toHaveBeenCalledWith("c1", {
      contentType: "video/mp4",
      sizeBytes: 20 * MB,
      title: "Semi final",
      durationSeconds: 60,
    });
    expect(api.completeVideo).toHaveBeenCalledWith("c1", "new1", [{ partNumber: 1, etag: '"e1"' }]);
    expect(api.deleteVideo).not.toHaveBeenCalled();
  });

  it("shows the progress and says to keep the page open while it uploads", async () => {
    let finish: (value: unknown) => void = () => undefined;
    upload.uploadParts.mockImplementation(({ onProgress }: { onProgress: (p: number) => void }) => {
      onProgress(42);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    renderCard();
    choose(clip());

    expect(await screen.findByText(/Uploading 42%/)).toBeTruthy();
    expect(screen.getByText(/Keep this page open until it finishes/)).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByRole("button", { name: "Add video" }).hasAttribute("disabled")).toBe(true);

    finish([{ partNumber: 1, etag: '"e1"' }]);
    await waitFor(() => expect(api.completeVideo).toHaveBeenCalled());
  });

  it("does not send a clip this browser cannot play, and says what to do", async () => {
    upload.checkPlayable.mockResolvedValue({ playable: false });
    renderCard();
    choose(clip("iphone.mov", "video/quicktime"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "This clip may not play for others. Choose another clip, or set your phone camera to Most Compatible."
    );
    expect(api.startVideo).not.toHaveBeenCalled();
  });

  it("does not send a clip longer than two minutes", async () => {
    upload.checkPlayable.mockResolvedValue({ playable: true, durationSeconds: 121 });
    renderCard();
    choose(clip());
    expect((await screen.findByRole("alert")).textContent).toMatch(/longer than 2 minutes/);
    expect(api.startVideo).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an accepted video, and one that is too large, before checking anything", async () => {
    renderCard();
    choose(clip("notes.pdf", "application/pdf"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/MP4, MOV or WebM/);

    choose(clip("big.mp4", "video/mp4", 301 * MB));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/larger than 300 MB/)
    );
    expect(upload.checkPlayable).not.toHaveBeenCalled();
    expect(api.startVideo).not.toHaveBeenCalled();
  });

  it("removes the half-made upload and says why when sending fails", async () => {
    upload.uploadParts.mockRejectedValue(new Error("boom"));
    renderCard();
    choose(clip());

    expect((await screen.findByRole("alert")).textContent).toMatch(/could not be added/);
    expect(api.deleteVideo).toHaveBeenCalledWith("c1", "new1");
    expect(api.completeVideo).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses to start", async () => {
    api.startVideo.mockRejectedValue({
      response: { data: { message: "A child can have up to 5 videos." } },
    });
    renderCard();
    choose(clip());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "A child can have up to 5 videos."
    );
    expect(api.deleteVideo).not.toHaveBeenCalled();
  });

  it("stops and removes the clip when the parent cancels", async () => {
    upload.uploadParts.mockImplementation(
      ({ signal, onProgress }: { signal: AbortSignal; onProgress: (p: number) => void }) =>
        new Promise((_resolve, reject) => {
          onProgress(10);
          signal.addEventListener("abort", () => reject(new Error("cancelled")));
        })
    );
    renderCard();
    choose(clip());
    await screen.findByText(/Uploading 10%/);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(api.deleteVideo).toHaveBeenCalledWith("c1", "new1"));
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("agreeing to the video notice", () => {
  it("asks first when the parent has not agreed, and the button needs the box ticked", async () => {
    renderCard({ consentGiven: false });
    fireEvent.click(screen.getByRole("button", { name: "Add video" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Before you add a video")).toBeTruthy();
    expect(within(dialog).getByText(/We do not use AI to analyse your videos/)).toBeTruthy();
    const agree = within(dialog).getByRole("button", { name: "Agree and choose a video" });
    expect(agree.hasAttribute("disabled")).toBe(true);
    expect((within(dialog).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);

    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(agree.hasAttribute("disabled")).toBe(false);
    expect(onAgree).not.toHaveBeenCalled();
  });

  it("records the agreement, then sends the clip chosen straight after", async () => {
    renderCard({ consentGiven: false });
    fireEvent.click(screen.getByRole("button", { name: "Add video" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Agree and choose a video" }));
    expect(onAgree).toHaveBeenCalledTimes(1);

    choose(clip());
    await waitFor(() => expect(api.startVideo).toHaveBeenCalled());
    expect(onAgree.mock.invocationCallOrder[0]).toBeLessThan(
      api.startVideo.mock.invocationCallOrder[0]!
    );
  });

  it("sends nothing if recording the agreement failed", async () => {
    onAgree.mockRejectedValue(new Error("offline"));
    renderCard({ consentGiven: false });
    fireEvent.click(screen.getByRole("button", { name: "Add video" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Agree and choose a video" }));

    choose(clip());
    await waitFor(() => expect(onAgree).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.startVideo).not.toHaveBeenCalled();
  });

  it("records nothing when the parent cancels", async () => {
    renderCard({ consentGiven: false });
    fireEvent.click(screen.getByRole("button", { name: "Add video" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onAgree).not.toHaveBeenCalled();
    expect(api.startVideo).not.toHaveBeenCalled();
  });

  it("does not ask again once the parent has agreed", () => {
    renderCard({ consentGiven: true });
    fireEvent.click(screen.getByRole("button", { name: "Add video" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the list of videos", () => {
  it("says how many are added, and shows length and size for a finished clip", () => {
    renderCard({ videos: [ready()] });
    expect(screen.getByText(/1 of 5 added/)).toBeTruthy();
    expect(screen.getByText("Final set")).toBeTruthy();
    expect(screen.getByText("1:05 · 42 MB")).toBeTruthy();
  });

  it("offers Play for a finished clip but not for an unfinished upload, which can only be removed", () => {
    renderCard({
      videos: [
        ready(),
        ready({ id: "u1", title: "Half sent", status: "uploading", sizeBytes: undefined }),
      ],
    });
    expect(screen.getByRole("button", { name: "Play Final set" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play Half sent" })).toBeNull();
    expect(screen.getByText("Unfinished upload")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Half sent" })).toBeTruthy();
  });

  it("plays a clip from a fresh link, in the browser's own player", async () => {
    renderCard({ videos: [ready()] });
    fireEvent.click(screen.getByRole("button", { name: "Play Final set" }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(api.videoPlayback).toHaveBeenCalledWith("c1", "v1"));
    const video = await waitFor(() => {
      const found = dialog.querySelector("video");
      expect(found).toBeTruthy();
      return found as HTMLVideoElement;
    });
    expect(video.getAttribute("src")).toBe("https://storage.example/play?sig=1");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("says so when a clip cannot be played", async () => {
    api.videoPlayback.mockRejectedValue(new Error("gone"));
    renderCard({ videos: [ready()] });
    fireEvent.click(screen.getByRole("button", { name: "Play Final set" }));
    expect((await screen.findByText(/could not be played/)).textContent).toMatch(/try again/i);
  });

  it("removes a clip only after a confirmation", async () => {
    renderCard({ videos: [ready()] });
    fireEvent.click(screen.getByRole("button", { name: "Remove Final set" }));
    expect(onRemove).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Any link that included it stops showing it/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("v1");
  });

  it("stops at five and says why", () => {
    const five = Array.from({ length: 5 }, (_, i) => ready({ id: `v${i}`, title: `Clip ${i}` }));
    renderCard({ videos: five });
    expect(screen.getByRole("button", { name: "Add video" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/most videos for one child/)).toBeTruthy();
  });

  it("invites the first clip when there are none", () => {
    renderCard();
    expect(screen.getByText("No videos yet. Add a clip from your phone.")).toBeTruthy();
    expect(screen.getByText(/MP4, MOV or WebM, up to 2 minutes and 300 MB each/)).toBeTruthy();
  });
});

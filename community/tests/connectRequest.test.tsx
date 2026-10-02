// @vitest-environment jsdom
//
// "Connect with a message": a request cannot be sent without one. These pin the
// two halves of that on the client: the dialog will not send until there is a
// real message, and the hook asks for one exactly when it is needed (when told
// the recipient takes requests, or when the server says one is required) and
// never for someone who accepts messages from everyone.

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConnectRequestModal, {
  REQUEST_MESSAGE_MIN,
} from "@/modules/community/components/ConnectRequestModal";
import {
  isIntroRequiredError,
  useConnectRequest,
} from "@/modules/community/hooks/useConnectRequest";
import { communityService } from "@/modules/community/services/community";

vi.mock("@/modules/community/services/community", () => ({
  communityService: { startConversation: vi.fn() },
}));

const startConversation = vi.mocked(communityService.startConversation);

const REQUIRED = new Error(
  "A short message is required to send a request: say why you'd like to connect (at least 10 characters)."
);

const conversation = { id: "c1", status: "PENDING" as const, requestedBy: "me" };

beforeEach(() => {
  startConversation.mockReset();
});
afterEach(cleanup);

describe("isIntroRequiredError", () => {
  it("recognises the server's answer, and nothing else", () => {
    expect(isIntroRequiredError(REQUIRED)).toBe(true);
    expect(isIntroRequiredError(new Error("This player is not accepting new messages"))).toBe(
      false
    );
    expect(isIntroRequiredError("A short message is required to send a request")).toBe(false);
  });
});

describe("useConnectRequest", () => {
  it("opens the dialog without calling the server when the recipient takes requests", async () => {
    const onStarted = vi.fn();
    const { result } = renderHook(() => useConnectRequest(onStarted));

    await act(() => result.current.start("u1", { name: "Asha", privacy: "REQUEST_ONLY" }));

    expect(startConversation).not.toHaveBeenCalled();
    expect(result.current.target).toEqual({ userId: "u1", name: "Asha" });
  });

  it("starts straight away for someone who accepts messages from everyone", async () => {
    startConversation.mockResolvedValue({ ...conversation, status: "ACTIVE" });
    const onStarted = vi.fn();
    const { result } = renderHook(() => useConnectRequest(onStarted));

    await act(() => result.current.start("u1", { privacy: "EVERYONE" }));

    expect(startConversation).toHaveBeenCalledWith("u1");
    expect(onStarted).toHaveBeenCalledWith({ ...conversation, status: "ACTIVE" });
    expect(result.current.target).toBeNull();
  });

  it("asks for the message when the server says one is required", async () => {
    startConversation.mockRejectedValueOnce(REQUIRED);
    const onStarted = vi.fn();
    const { result } = renderHook(() => useConnectRequest(onStarted));

    await act(() => result.current.start("u1", { name: "Asha" }));

    expect(onStarted).not.toHaveBeenCalled();
    expect(result.current.target?.userId).toBe("u1");
  });

  it("passes any other failure back to the caller", async () => {
    startConversation.mockRejectedValueOnce(new Error("This player is not accepting new messages"));
    const { result } = renderHook(() => useConnectRequest(vi.fn()));

    await expect(act(() => result.current.start("u1"))).rejects.toThrow("not accepting");
    expect(result.current.target).toBeNull();
  });

  it("sends the request with its message, then closes and carries on", async () => {
    startConversation.mockResolvedValue(conversation);
    const onStarted = vi.fn();
    const { result } = renderHook(() => useConnectRequest(onStarted));
    await act(() => result.current.start("u1", { privacy: "REQUEST_ONLY" }));

    await act(() => result.current.submit("Hello, my son plays U12 tennis."));

    expect(startConversation).toHaveBeenCalledWith("u1", "Hello, my son plays U12 tennis.");
    expect(onStarted).toHaveBeenCalledWith(conversation);
    expect(result.current.target).toBeNull();
  });

  it("stays open with the reason when sending fails", async () => {
    startConversation.mockRejectedValue(
      new Error("Conversation unavailable due to privacy settings")
    );
    const onStarted = vi.fn();
    const { result } = renderHook(() => useConnectRequest(onStarted));
    await act(() => result.current.start("u1", { privacy: "REQUEST_ONLY" }));

    await act(() => result.current.submit("A perfectly good message."));

    expect(onStarted).not.toHaveBeenCalled();
    expect(result.current.target).not.toBeNull();
    expect(result.current.error).toMatch(/privacy settings/);
  });
});

describe("ConnectRequestModal", () => {
  const renderOpen = (
    overrides: Partial<Parameters<typeof ConnectRequestModal>[0]["request"]> = {}
  ) => {
    const request = {
      target: { userId: "u1", name: "Asha" },
      submitting: false,
      error: null,
      submit: vi.fn(),
      cancel: vi.fn(),
      ...overrides,
    };
    render(<ConnectRequestModal request={request} />);
    return request;
  };

  it("renders nothing without a target", () => {
    renderOpen({ target: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the person and explains what happens", () => {
    renderOpen();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/connect with Asha/)).toBeTruthy();
  });

  it("will not send until the message is long enough to say something", () => {
    const request = renderOpen();
    const send = screen.getByRole("button", { name: "Send request" }) as HTMLButtonElement;
    const box = screen.getByLabelText("Your message");

    expect(send.disabled).toBe(true);

    fireEvent.change(box, { target: { value: "hi" } });
    expect(send.disabled).toBe(true);

    fireEvent.change(box, { target: { value: "          hi         " } });
    expect(send.disabled).toBe(true);

    fireEvent.change(box, { target: { value: "x".repeat(REQUEST_MESSAGE_MIN) } });
    expect(send.disabled).toBe(false);

    fireEvent.click(send);
    expect(request.submit).toHaveBeenCalledWith("x".repeat(REQUEST_MESSAGE_MIN));
  });

  it("sends the trimmed message", () => {
    const request = renderOpen();
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "   Hello, I would like to connect.   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(request.submit).toHaveBeenCalledWith("Hello, I would like to connect.");
  });

  it("shows the server's reason and closes with Escape", async () => {
    const request = renderOpen({ error: "This player is not accepting new messages" });
    expect(screen.getByRole("alert").textContent).toMatch(/not accepting/);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(request.cancel).toHaveBeenCalled());
  });

  it("cannot be dismissed while a request is being sent", () => {
    const request = renderOpen({ submitting: true });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(request.cancel).not.toHaveBeenCalled();
  });
});

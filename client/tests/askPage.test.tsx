// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../src/modules/auth/store/authStore";
import { AskWorkspace } from "../src/modules/guidance/components/ask/AskWorkspace";
import { ASK_SUGGESTED_QUESTIONS, askHref } from "../src/modules/guidance/config/askQuestions";
import { timeAgo } from "../src/modules/guidance/utils/timeAgo";

const SESSIONS = [
  {
    _id: "old1",
    sportSlug: "",
    title: "Is tennis a good first sport?",
    totalMessageCount: 4,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    _id: "old2",
    sportSlug: "",
    title: "Which tournaments are on?",
    totalMessageCount: 2,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

const chat = {
  messages: [{ role: "assistant" as const, content: "Hi, ask me anything." }],
  sessions: [] as typeof SESSIONS,
  currentSessionId: "s1" as string | null,
  isInitializing: false,
  isLoadingSessions: false,
  isStreaming: false,
  meta: { dailyRemaining: 30, lifetimeRemaining: 150 },
  error: null,
  initialize: vi.fn(async () => {}),
  switchToSession: vi.fn(async () => true),
  loadSessions: vi.fn(async () => {}),
  deleteSession: vi.fn<(id: string) => Promise<boolean>>(async () => true),
  sendMessage: vi.fn(async () => {}),
  clearError: vi.fn(),
};
vi.mock("../src/modules/guidance/hooks/useAssistantChat", () => ({
  useAssistantChat: () => chat,
}));

const setUrl = (search: string) => window.history.replaceState(null, "", `/ask${search}`);
const signIn = () =>
  useAuthStore.setState({
    hydrated: true,
    user: { _id: "u1", name: "Test Parent" } as never,
  });
const signOut = () => useAuthStore.setState({ hydrated: true, user: null });

beforeEach(() => {
  vi.clearAllMocks();
  chat.messages = [{ role: "assistant", content: "Hi, ask me anything." }];
  chat.currentSessionId = "s1";
  chat.sessions = [];
  chat.isStreaming = false;
  chat.deleteSession.mockResolvedValue(true);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  setUrl("");
});

describe("askHref", () => {
  it("links to /ask, carrying a trimmed question when there is one", () => {
    expect(askHref()).toBe("/ask");
    expect(askHref("   ")).toBe("/ask");
    expect(askHref("  Is tennis good?  ")).toBe("/ask?q=Is%20tennis%20good%3F");
  });
});

describe("timeAgo", () => {
  it("reads as just now, minutes, hours and days", () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(timeAgo(ago(10_000))).toBe("just now");
    expect(timeAgo(ago(5 * 60_000))).toBe("5m ago");
    expect(timeAgo(ago(3 * 3_600_000))).toBe("3h ago");
    expect(timeAgo(ago(2 * 86_400_000))).toBe("2d ago");
  });
});

describe("AskWorkspace for a signed-out visitor", () => {
  it("shows the sign-in view, not a chat, and starts no session", () => {
    signOut();
    render(<AskWorkspace />);

    expect(screen.getByRole("heading", { name: "Ask PowerMySport AI" })).toBeTruthy();
    expect(screen.getByText(/needs a free account/i)).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
    expect(chat.initialize).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps the visitor's question through login and registration", async () => {
    vi.useFakeTimers();
    setUrl("?q=Which%20tennis%20tournaments%20are%20coming%20up%3F");
    signOut();
    render(<AskWorkspace />);
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    const back = encodeURIComponent("/ask?q=Which%20tennis%20tournaments%20are%20coming%20up%3F");
    expect(
      screen.getByText(/Which tennis tournaments are coming up\?/, { selector: "p" })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe(
      `/login?redirect=${back}`
    );
    expect(screen.getByRole("link", { name: /Create a free account/ }).getAttribute("href")).toBe(
      `/register?redirect=${back}`
    );
  });

  it("links every starter question to /ask with that question", () => {
    signOut();
    render(<AskWorkspace />);
    for (const question of ASK_SUGGESTED_QUESTIONS) {
      expect(screen.getByRole("link", { name: question }).getAttribute("href")).toBe(
        askHref(question)
      );
    }
  });
});

describe("AskWorkspace for a signed-in parent", () => {
  it("starts a fresh conversation and offers the starter questions", async () => {
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    expect(chat.initialize).toHaveBeenCalledTimes(1);
    expect(chat.switchToSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your question")).toBeTruthy();
    expect(screen.getByRole("button", { name: ASK_SUGGESTED_QUESTIONS[0] })).toBeTruthy();
  });

  it("asks the ?q= question once the chat is ready, and removes it from the address", async () => {
    setUrl("?q=How%20does%20PowerMySport%20work%3F");
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(chat.sendMessage).toHaveBeenCalledWith("How does PowerMySport work?");
    expect(window.location.search).not.toContain("q=");
  });

  it("does not ask the question while the session is still starting", async () => {
    setUrl("?q=Anything");
    chat.currentSessionId = null;
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(chat.sendMessage).not.toHaveBeenCalled();
  });

  it("reopens the conversation named by ?s= instead of starting a new one", async () => {
    setUrl("?s=old1");
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    expect(chat.switchToSession).toHaveBeenCalledWith("old1");
    expect(chat.initialize).not.toHaveBeenCalled();
    // Reopening a chat must still fill the history list.
    expect(chat.loadSessions).toHaveBeenCalledTimes(1);
  });

  it("falls back to a new conversation when ?s= cannot be opened", async () => {
    setUrl("?s=gone");
    chat.switchToSession.mockResolvedValueOnce(false);
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    expect(chat.switchToSession).toHaveBeenCalledWith("gone");
    expect(chat.initialize).toHaveBeenCalledTimes(1);
    expect(chat.loadSessions).not.toHaveBeenCalled();
  });

  it("starts a new conversation, not a resumed one, when a question arrives with ?s=", async () => {
    setUrl("?s=old1&q=Hello");
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    expect(chat.switchToSession).not.toHaveBeenCalled();
    expect(chat.initialize).toHaveBeenCalledTimes(1);
  });

  it("sends a typed question with Enter and not with Shift+Enter", async () => {
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    const box = screen.getByLabelText("Your question");
    fireEvent.change(box, { target: { value: "Is tennis a good first sport?" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(chat.sendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(box, { key: "Enter" });
    expect(chat.sendMessage).toHaveBeenCalledWith("Is tennis a good first sport?");
  });

  it("replaces the box with a notice when the daily limit is reached", async () => {
    chat.meta = { dailyRemaining: 0, lifetimeRemaining: 100 };
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});

    expect(screen.getByText(/reached today's limit/i)).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
    chat.meta = { dailyRemaining: 30, lifetimeRemaining: 150 };
  });
});

describe("deleting a chat", () => {
  const openHistory = async () => {
    chat.sessions = SESSIONS;
    signIn();
    render(<AskWorkspace />);
    await act(async () => {});
  };
  /** The desktop sidebar and the phone panel can both render the list; use the first. */
  const trashFor = (title: string) =>
    screen.getAllByRole("button", { name: `Delete chat: ${title}` })[0];

  it("offers a delete button on every past chat", async () => {
    await openHistory();

    expect(trashFor("Is tennis a good first sport?")).toBeTruthy();
    expect(trashFor("Which tournaments are on?")).toBeTruthy();
  });

  it("asks before deleting, and does nothing if the parent keeps the chat", async () => {
    await openHistory();

    fireEvent.click(trashFor("Which tournaments are on?"));
    expect(screen.getByText("Delete this chat?")).toBeTruthy();
    expect(chat.deleteSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByText("Delete this chat?")).toBeNull();
    expect(chat.deleteSession).not.toHaveBeenCalled();
  });

  it("deletes the chat that was confirmed, and no other", async () => {
    await openHistory();

    fireEvent.click(trashFor("Which tournaments are on?"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(chat.deleteSession).toHaveBeenCalledTimes(1);
    expect(chat.deleteSession).toHaveBeenCalledWith("old2");
  });

  it("starts a fresh chat when the open one is deleted", async () => {
    chat.currentSessionId = "old1";
    await openHistory();
    chat.initialize.mockClear();

    fireEvent.click(trashFor("Is tennis a good first sport?"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(chat.deleteSession).toHaveBeenCalledWith("old1");
    expect(chat.initialize).toHaveBeenCalledTimes(1);
  });

  it("leaves the open chat alone when a different one is deleted", async () => {
    chat.currentSessionId = "old1";
    await openHistory();
    chat.initialize.mockClear();

    fireEvent.click(trashFor("Which tournaments are on?"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(chat.deleteSession).toHaveBeenCalledWith("old2");
    expect(chat.initialize).not.toHaveBeenCalled();
  });

  it("keeps the chat, and goes back to the list, when the delete fails", async () => {
    chat.deleteSession.mockResolvedValueOnce(false);
    await openHistory();
    chat.initialize.mockClear();

    fireEvent.click(trashFor("Which tournaments are on?"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(screen.queryByText("Delete this chat?")).toBeNull();
    expect(trashFor("Which tournaments are on?")).toBeTruthy();
    expect(chat.initialize).not.toHaveBeenCalled();
  });

  it("cannot delete anything while an answer is streaming", async () => {
    chat.isStreaming = true;
    await openHistory();

    expect((trashFor("Which tournaments are on?") as HTMLButtonElement).disabled).toBe(true);
  });
});

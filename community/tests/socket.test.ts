// @vitest-environment jsdom
//
// `getAuthToken` branches on `typeof window === "undefined"` and reads
// `localStorage`, so this file needs a real `window`/`localStorage` to
// exercise the token-attachment behavior instead of the SSR no-op path.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `socket.ts` keeps module-scoped singleton state (the socket instance, the
// subscribed-room map, the active-conversation set) that must not leak
// between tests, so every test re-imports the module fresh after
// `vi.resetModules()` rather than sharing one import across the file.

interface MockSocket {
  connected: boolean;
  auth: unknown;
  connect: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  triggerConnect: () => void;
}

const createMockSocket = (): MockSocket => {
  const handlers = new Map<string, () => void>();
  const socket: MockSocket = {
    connected: false,
    auth: {},
    connect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
    }),
    triggerConnect: () => handlers.get("connect")?.(),
  };
  return socket;
};

let mockSocket: MockSocket;
const ioMock = vi.fn();

vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

async function loadSocketModule() {
  vi.resetModules();
  mockSocket = createMockSocket();
  ioMock.mockReset();
  ioMock.mockReturnValue(mockSocket);
  return import("../src/lib/realtime/socket");
}

describe("getCommunitySocket", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a socket once and reuses it on subsequent calls", async () => {
    const { getCommunitySocket } = await loadSocketModule();

    const first = getCommunitySocket();
    const second = getCommunitySocket();

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(mockSocket);
  });

  it("appends /community to a bare API origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/api/");
    const { getCommunitySocket } = await loadSocketModule();

    getCommunitySocket();

    expect(ioMock).toHaveBeenCalledWith(
      "https://api.example.com/community",
      expect.objectContaining({ autoConnect: false })
    );
    vi.unstubAllEnvs();
  });

  it("does not double-append /community when the resolved URL already has it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "https://api.example.com/community");
    const { getCommunitySocket } = await loadSocketModule();

    getCommunitySocket();

    expect(ioMock).toHaveBeenCalledWith("https://api.example.com/community", expect.anything());
    vi.unstubAllEnvs();
  });

  it("attaches the stored token as auth on creation and on repeat calls", async () => {
    localStorage.setItem("token", "abc123");
    const { getCommunitySocket } = await loadSocketModule();

    getCommunitySocket();
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: "abc123" } })
    );

    localStorage.setItem("token", "def456");
    getCommunitySocket();
    expect(mockSocket.auth).toEqual({ token: "def456" });
  });
});

describe("subscribeToCommunityRoom", () => {
  it("emits subscribe on first join and connects an idle socket", async () => {
    const { subscribeToCommunityRoom } = await loadSocketModule();

    subscribeToCommunityRoom("qna:feed");

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    // Socket wasn't connected yet, so the subscribe emit is deferred to the
    // connect-replay handler rather than sent immediately.
    expect(mockSocket.emit).not.toHaveBeenCalledWith("community:subscribe", "qna:feed");
  });

  it("emits subscribe immediately when the socket is already connected", async () => {
    const { subscribeToCommunityRoom } = await loadSocketModule();
    mockSocket.connected = true;

    subscribeToCommunityRoom("qna:feed");

    expect(mockSocket.emit).toHaveBeenCalledWith("community:subscribe", "qna:feed");
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it("ref-counts a room shared by two callers: only the last unsubscribe emits", async () => {
    const { subscribeToCommunityRoom } = await loadSocketModule();
    mockSocket.connected = true;

    const unsubscribeA = subscribeToCommunityRoom("blog:feed");
    mockSocket.emit.mockClear();
    const unsubscribeB = subscribeToCommunityRoom("blog:feed");

    // Second subscriber to an already-subscribed room shouldn't re-emit.
    expect(mockSocket.emit).not.toHaveBeenCalledWith("community:subscribe", "blog:feed");

    unsubscribeA();
    expect(mockSocket.emit).not.toHaveBeenCalledWith("community:unsubscribe", "blog:feed");

    unsubscribeB();
    expect(mockSocket.emit).toHaveBeenCalledWith("community:unsubscribe", "blog:feed");
  });

  it("is safe to call the unsubscribe function twice", async () => {
    const { subscribeToCommunityRoom } = await loadSocketModule();
    mockSocket.connected = true;

    const unsubscribe = subscribeToCommunityRoom("qna:post:1");
    unsubscribe();
    mockSocket.emit.mockClear();
    unsubscribe();

    expect(mockSocket.emit).not.toHaveBeenCalledWith("community:unsubscribe", "qna:post:1");
  });

  it("replays subscribed rooms and joined conversations when the socket reconnects", async () => {
    const { subscribeToCommunityRoom, joinConversationRoom } = await loadSocketModule();

    subscribeToCommunityRoom("qna:feed");
    joinConversationRoom("conv-1");
    mockSocket.emit.mockClear();

    mockSocket.triggerConnect();

    expect(mockSocket.emit).toHaveBeenCalledWith("community:subscribe", "qna:feed");
    expect(mockSocket.emit).toHaveBeenCalledWith("community:joinConversation", {
      conversationId: "conv-1",
    });
  });
});

describe("joinConversationRoom", () => {
  it("ignores an empty conversation id", async () => {
    const { joinConversationRoom } = await loadSocketModule();

    joinConversationRoom("");

    expect(ioMock).not.toHaveBeenCalled();
  });

  it("emits joinConversation immediately when connected", async () => {
    const { joinConversationRoom } = await loadSocketModule();
    mockSocket.connected = true;

    joinConversationRoom("conv-42");

    expect(mockSocket.emit).toHaveBeenCalledWith("community:joinConversation", {
      conversationId: "conv-42",
    });
  });

  it("connects rather than emitting when the socket is offline", async () => {
    const { joinConversationRoom } = await loadSocketModule();

    joinConversationRoom("conv-42");

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      "community:joinConversation",
      expect.anything()
    );
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

"use client";

import { authHeaders, useChatCore } from "./useChatCore";
import type { SessionSummary } from "../components/chat/ChatDrawer";
import { useCallback, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ChatSessionMeta {
  dailyRemaining: number;
  lifetimeRemaining: number;
  dailyMessageCount: number;
  totalMessageCount: number;
}

/**
 * The site-wide general assistant — reachable from the floating bubble on
 * every page. Always opens to a brand-new session (like ChatGPT/Claude/
 * Gemini's "new chat" default) rather than resuming the last one; past
 * conversations are reachable through the history panel.
 */
export function useAssistantChat() {
  const {
    messages,
    setMessages,
    isStreaming,
    error,
    setError,
    sendMessage: sendCore,
    clearError,
  } = useChatCore();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [meta, setMeta] = useState<ChatSessionMeta>({
    dailyRemaining: 30,
    lifetimeRemaining: 150,
    dailyMessageCount: 0,
    totalMessageCount: 0,
  });

  // ── Load session list ──────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/assistant-chat/sessions`, {
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch {
      // silently ignore — history panel just shows empty
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // ── Initialize: always start a brand-new session ──────────────────────────

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/assistant-chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setCurrentSessionId(data.data.sessionId ?? null);
        setMeta({
          dailyRemaining: data.data.dailyRemaining,
          lifetimeRemaining: data.data.lifetimeRemaining,
          dailyMessageCount: data.data.dailyMessageCount ?? 0,
          totalMessageCount: data.data.totalMessageCount,
        });
        loadSessions();
      } else {
        setError(data.message || "Failed to start chat session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [loadSessions, setMessages, setError]);

  // ── Switch to an existing session ─────────────────────────────────────────

  const switchToSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (sessionId === currentSessionId) return true;
      setIsInitializing(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/assistant-chat/sessions/${sessionId}`, {
          headers: authHeaders(),
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.data.messages);
          setCurrentSessionId(sessionId);
          setMeta({
            dailyRemaining: data.data.dailyRemaining,
            lifetimeRemaining: data.data.lifetimeRemaining,
            dailyMessageCount: data.data.dailyMessageCount ?? 0,
            totalMessageCount: data.data.totalMessageCount,
          });
          return true;
        }
        setError(data.message || "Failed to load session");
        return false;
      } catch {
        setError("Failed to connect to chat service");
        return false;
      } finally {
        setIsInitializing(false);
      }
    },
    [currentSessionId, setMessages, setError]
  );

  // ── Delete a chat ───────────────────────────────────────────────────

  /** Removes one chat for good. Resolves true when it is gone. */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE_URL}/assistant-chat/sessions/${sessionId}`, {
          method: "DELETE",
          headers: authHeaders(),
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setError(data.message || "Could not delete this chat");
          return false;
        }
        setSessions((prev) => prev.filter((s) => s._id !== sessionId));
        return true;
      } catch {
        setError("Failed to connect to chat service");
        return false;
      }
    },
    [setError]
  );

  // ── Send a message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!currentSessionId) return;

      const result = await sendCore(userContent, {
        endpoint: `${API_BASE_URL}/assistant-chat/sessions/${currentSessionId}`,
        body: { message: userContent.trim() },
        onDone: () => {
          setMeta((m) => ({
            ...m,
            dailyMessageCount: m.dailyMessageCount + 1,
            totalMessageCount: m.totalMessageCount + 1,
            dailyRemaining: Math.max(0, m.dailyRemaining - 1),
            lifetimeRemaining: Math.max(0, m.lifetimeRemaining - 1),
          }));
          const now = new Date().toISOString();
          const derivedTitle =
            userContent.trim().slice(0, 60) + (userContent.trim().length > 60 ? "…" : "");
          setSessions((prev) =>
            prev.some((s) => s._id === currentSessionId)
              ? prev.map((s) =>
                  s._id === currentSessionId
                    ? { ...s, title: s.title ?? derivedTitle, updatedAt: now }
                    : s
                )
              : // The server leaves a chat out of the list until it has been written in,
                // so the first message is what adds it.
                currentSessionId
                ? [
                    {
                      _id: currentSessionId,
                      sportSlug: "",
                      title: derivedTitle,
                      totalMessageCount: 1,
                      updatedAt: now,
                      createdAt: now,
                    },
                    ...prev,
                  ]
                : prev
          );
        },
      });

      if (result?.rateLimitHit) {
        setMeta((m) => ({ ...m, dailyRemaining: 0 }));
      }
    },
    [sendCore, currentSessionId]
  );

  return {
    messages,
    currentSessionId,
    sessions,
    isLoadingSessions,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    loadSessions,
    createNewSession: initialize,
    switchToSession,
    deleteSession,
    sendMessage,
    clearError,
  };
}

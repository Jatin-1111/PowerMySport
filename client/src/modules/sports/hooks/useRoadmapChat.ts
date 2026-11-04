"use client";

import type { SessionSummary } from "@/modules/guidance/components/chat/ChatDrawer";
import { authHeaders, useChatCore } from "@/modules/guidance/hooks/useChatCore";
import { useCallback, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ChatSessionMeta {
  dailyRemaining: number;
  lifetimeRemaining: number;
  dailyMessageCount: number;
  totalMessageCount: number;
}

interface UseRoadmapChatOptions {
  sportSlug: string;
  level?: number;
}

export function useRoadmapChat({ sportSlug, level }: UseRoadmapChatOptions) {
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
  const levelRef = useRef(level);
  levelRef.current = level;

  // ── Load session list ──────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/roadmap-chat/sessions?sportSlug=${encodeURIComponent(sportSlug)}`,
        { headers: authHeaders(), credentials: "include" }
      );
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch {
      // silently ignore — history panel just shows empty
    } finally {
      setIsLoadingSessions(false);
    }
  }, [sportSlug]);

  // ── Initialize (load latest session or create one) ────────────────────────

  const initialize = useCallback(async () => {
    if (!sportSlug) return;
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`, {
        headers: authHeaders(),
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
        setError(data.message || "Failed to load chat session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [sportSlug, loadSessions, setMessages, setError]);

  // ── Create a brand-new session ─────────────────────────────────────────────

  const createNewSession = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/roadmap-chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ sportSlug }),
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
        // Prepend to local session list
        setSessions((prev) => [
          {
            _id: data.data.sessionId,
            sportSlug,
            title: null,
            totalMessageCount: 0,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setError(data.message || "Failed to create session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [sportSlug, setMessages, setError]);

  // ── Switch to an existing session ─────────────────────────────────────────

  const switchToSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === currentSessionId) return;
      setIsInitializing(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/roadmap-chat/sessions/${sessionId}`, {
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
        } else {
          setError(data.message || "Failed to load session");
        }
      } catch {
        setError("Failed to connect to chat service");
      } finally {
        setIsInitializing(false);
      }
    },
    [currentSessionId, setMessages, setError]
  );

  // ── Send a message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userContent: string) => {
      // Determine endpoint: prefer session-specific, fall back to sport slug
      const endpoint = currentSessionId
        ? `${API_BASE_URL}/roadmap-chat/sessions/${currentSessionId}`
        : `${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`;

      const result = await sendCore(userContent, {
        endpoint,
        body: { message: userContent.trim(), level: levelRef.current },
        onDone: () => {
          setMeta((m) => ({
            ...m,
            dailyMessageCount: m.dailyMessageCount + 1,
            totalMessageCount: m.totalMessageCount + 1,
            dailyRemaining: Math.max(0, m.dailyRemaining - 1),
            lifetimeRemaining: Math.max(0, m.lifetimeRemaining - 1),
          }));
          // Update title in sessions list if this was the first user message
          if (currentSessionId) {
            setSessions((prev) =>
              prev.map((s) =>
                s._id === currentSessionId
                  ? {
                      ...s,
                      title:
                        s.title ??
                        userContent.trim().slice(0, 60) +
                          (userContent.trim().length > 60 ? "…" : ""),
                      updatedAt: new Date().toISOString(),
                    }
                  : s
              )
            );
          }
        },
      });

      if (result?.rateLimitHit) {
        setMeta((m) => ({ ...m, dailyRemaining: 0 }));
      }
    },
    [sendCore, currentSessionId, sportSlug]
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
    createNewSession,
    switchToSession,
    sendMessage,
    clearError,
  };
}

"use client";

import { useCallback, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SendChatMessageOptions {
  endpoint: string;
  body: Record<string, unknown>;
  /** Called when the stream reports completion — update per-feature meta/session state here. */
  onDone?: () => void;
}

interface SendChatMessageResult {
  rateLimitHit: boolean;
}

/**
 * Shared core for every AI chat drawer (guidance chat, roadmap chat, ...):
 * message list, SSE stream consumption, and error handling. Callers own
 * their own session/meta/rate-limit state and pass the endpoint + body to hit
 * per message via sendMessage's options.
 */
export function useChatCore() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (
      userContent: string,
      { endpoint, body, onDone }: SendChatMessageOptions,
    ): Promise<SendChatMessageResult | undefined> => {
      const trimmed = userContent.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setError(null);

      const assistantPlaceholder: ChatMessage = {
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantPlaceholder]);

      let rateLimitHit = false;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || `Chat request failed (${res.status})`;
          setMessages((prev) => prev.slice(0, -1));
          setError(errMsg);
          if (res.status === 429) rateLimitHit = true;
          return { rateLimitHit };
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          setError("No response stream available");
          return { rateLimitHit };
        }

        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: fullContent };
                  }
                  return updated;
                });
              } else if (parsed.done) {
                onDone?.();
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Malformed SSE line — ignore
            }
          }
        }
      } catch {
        setMessages((prev) => prev.slice(0, -1));
        setError("Connection error. Please try again.");
      } finally {
        setIsStreaming(false);
      }

      return { rateLimitHit };
    },
    [isStreaming],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    setMessages,
    isStreaming,
    error,
    setError,
    sendMessage,
    clearError,
  };
}

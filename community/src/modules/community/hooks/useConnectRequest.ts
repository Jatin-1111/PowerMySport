import { communityService } from "@/modules/community/services/community";
import type { MessagePrivacy } from "@/modules/community/types";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Connect with a message ─────────────────────────────────────────────────
//
// Starting a chat with someone who takes requests means sending a request
// with a message, so the person deciding has your reason in front of them.
// This hook is the one place that knows how: every place that offers a
// "Message" button calls `start`, and renders <ConnectRequestModal> with what
// this returns.
//
// It does not need to know in advance who takes requests. If it is told (a
// profile that says "request only"), it asks for the message straight away. If
// not, it tries, and when the server answers that a message is required it
// asks then. Someone who accepts messages from everyone never sees the dialog.

/** The start of the server's answer when a request has no message. Kept in step with REQUEST_MESSAGE_REQUIRED in conversations.ts. */
const REQUIRED_PREFIX = "A short message is required to send a request";

export const isIntroRequiredError = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith(REQUIRED_PREFIX);

export interface StartedConversation {
  id: string;
  status: "PENDING" | "ACTIVE";
  requestedBy: string;
}

export interface ConnectTarget {
  userId: string;
  name?: string | undefined;
}

export function useConnectRequest(
  onStarted: (conversation: StartedConversation) => void | Promise<void>
) {
  const [target, setTarget] = useState<ConnectTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The latest callback, without making `start` and `submit` change identity
  // every time the caller re-renders.
  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  const ask = useCallback((next: ConnectTarget) => {
    setError(null);
    setTarget(next);
  }, []);

  /**
   * Begin a conversation. Resolves once it has started or the dialog has been
   * opened; rejects with anything else that went wrong (blocked, not accepting
   * messages), for the caller to show as it always has.
   */
  const start = useCallback(
    async (userId: string, options?: { name?: string; privacy?: MessagePrivacy }) => {
      const next = { userId, name: options?.name };
      if (options?.privacy === "REQUEST_ONLY") {
        ask(next);
        return;
      }
      try {
        const conversation = await communityService.startConversation(userId);
        await onStartedRef.current(conversation);
      } catch (e) {
        if (isIntroRequiredError(e)) {
          ask(next);
          return;
        }
        throw e;
      }
    },
    [ask]
  );

  const submit = useCallback(
    async (message: string) => {
      if (!target) return;
      setSubmitting(true);
      setError(null);
      let conversation: StartedConversation;
      try {
        conversation = await communityService.startConversation(target.userId, message);
      } catch (e) {
        // Stays open with the reason, so what was typed is not lost.
        setError(e instanceof Error ? e.message : "Could not send your request");
        setSubmitting(false);
        return;
      }
      setTarget(null);
      setSubmitting(false);
      await onStartedRef.current(conversation);
    },
    [target]
  );

  const cancel = useCallback(() => {
    setTarget(null);
    setError(null);
  }, []);

  return { start, target, submitting, error, submit, cancel };
}

export type ConnectRequestState = ReturnType<typeof useConnectRequest>;

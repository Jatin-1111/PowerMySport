"use client";

import type { ConnectRequestState } from "@/modules/community/hooks/useConnectRequest";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Mirrors REQUEST_MESSAGE_MIN / MAX in the server's conversations.ts. */
export const REQUEST_MESSAGE_MIN = 10;
export const REQUEST_MESSAGE_MAX = 500;

/**
 * The box a message request is written in. A request goes out with a message
 * or not at all: whoever receives it reads this before deciding to accept, and
 * can not be sent anything else until they do.
 *
 * Rendered through a portal because its callers sit inside animated wrappers,
 * and a `transform` on an ancestor turns `position: fixed` into "fixed to that
 * ancestor".
 */
export default function ConnectRequestModal({
  request,
}: {
  request: Pick<ConnectRequestState, "target" | "submitting" | "error" | "submit" | "cancel">;
}) {
  const { target } = request;
  if (!target || typeof document === "undefined") return null;
  // Keyed on the person, so a draft never carries over to someone else.
  return createPortal(<Dialog key={target.userId} request={request} />, document.body);
}

function Dialog({
  request,
}: {
  request: Pick<ConnectRequestState, "target" | "submitting" | "error" | "submit" | "cancel">;
}) {
  const { target, submitting, error, submit, cancel } = request;
  const [message, setMessage] = useState("");
  const titleId = useId();
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, cancel]);

  const length = message.trim().length;
  const tooShort = length < REQUEST_MESSAGE_MIN;
  const who = target?.name?.trim() || "this member";

  return (
    <div
      className="bg-ink/50 fixed inset-0 z-[210] flex items-end justify-center p-0 sm:items-center sm:p-6"
      onClick={() => !submitting && cancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onClick={(event) => event.stopPropagation()}
        className="bg-paper w-full max-w-lg rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-editorial text-ink text-4xl font-light leading-[1.08]">
            Send a request
          </h2>
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            aria-label="Close"
            className="text-ink-body hover:bg-paper-deep hover:text-ink -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200 disabled:opacity-50"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <p id={hintId} className="text-ink-body mt-3 text-base leading-relaxed">
          Say why you would like to connect with {who}. They read this before deciding whether to
          accept, and you cannot send anything else until they do.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!tooShort && !submitting) void submit(message.trim());
          }}
          className="mt-5"
        >
          <label htmlFor={`${titleId}-message`} className="sr-only">
            Your message
          </label>
          <textarea
            id={`${titleId}-message`}
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={REQUEST_MESSAGE_MAX}
            rows={5}
            disabled={submitting}
            placeholder="For example: my daughter plays U14 tennis in Pune and I saw your answer about travelling to tournaments."
            className="text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink disabled:bg-paper-deep w-full resize-none rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-base leading-relaxed transition-colors duration-200 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
            <span
              className={tooShort && length > 0 ? "font-medium text-red-700" : "text-ink-muted"}
            >
              {tooShort ? `At least ${REQUEST_MESSAGE_MIN} characters` : "Ready to send"}
            </span>
            <span className="text-ink-muted">
              {message.length} of {REQUEST_MESSAGE_MAX}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-base font-medium text-red-800"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
            <button
              type="button"
              onClick={cancel}
              disabled={submitting}
              className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={tooShort || submitting}
              className="btn-motion bg-power-orange-solid inline-flex min-h-12 min-w-[10rem] items-center justify-center rounded-md px-7 text-base font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending" : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import type { ConnectRequestState } from "@/modules/community/hooks/useConnectRequest";
import { Loader2, X } from "lucide-react";
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
      className="fixed inset-0 z-[210] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={() => !submitting && cancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            Send a message request
          </h2>
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p id={hintId} className="mt-2 text-sm leading-relaxed text-slate-600">
          Say why you would like to connect with {who}. They read this before deciding whether to
          accept, and you cannot send anything else until they do.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!tooShort && !submitting) void submit(message.trim());
          }}
          className="mt-4"
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
            className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className={tooShort && length > 0 ? "text-amber-700" : "text-slate-500"}>
              {tooShort ? `At least ${REQUEST_MESSAGE_MIN} characters` : "Ready to send"}
            </span>
            <span className="text-slate-500">
              {message.length} / {REQUEST_MESSAGE_MAX}
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={submitting}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={tooShort || submitting}
              className="bg-power-orange-solid inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending
                </>
              ) : (
                "Send request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

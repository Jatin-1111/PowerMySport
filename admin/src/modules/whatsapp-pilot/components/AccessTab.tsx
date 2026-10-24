"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Panel } from "@/modules/shared/ui/Panel";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { fieldClass } from "@/modules/shared/ui/buttonStyles";
import { toast } from "@/lib/toast";
import {
  WhatsAppPilotMode,
  WhatsAppPilotState,
  whatsappPilotApi,
} from "@/lib/api/whatsappPilotApi";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export function AccessTab() {
  const [state, setState] = useState<WhatsAppPilotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [confirmEveryone, setConfirmEveryone] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await whatsappPilotApi.get());
    } catch (err) {
      toast.error(errorMessage(err, "Could not load the pilot list."));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    whatsappPilotApi
      .get()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err, "Could not load the pilot list."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const result = await whatsappPilotApi.addNumbers(text);
      setInvalid(result.invalid);
      const parts = [`${result.added} added`];
      if (result.alreadyListed) parts.push(`${result.alreadyListed} already listed`);
      if (result.invalid.length) parts.push(`${result.invalid.length} not recognised`);
      toast.success(parts.join(", "));
      // Keep only the lines that failed, so they can be fixed and sent again.
      setText(result.invalid.join("\n"));
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not add those numbers."));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await whatsappPilotApi.removeNumber(id);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove that entry."));
    } finally {
      setRemovingId(null);
    }
  };

  const handleMode = async (mode: WhatsAppPilotMode) => {
    if (!state || mode === state.mode) return;
    setSavingMode(true);
    try {
      await whatsappPilotApi.setMode(mode);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not change who gets the assistant."));
    } finally {
      setSavingMode(false);
      setConfirmEveryone(false);
    }
  };

  // Opening the assistant to everyone is the one change here that reaches real
  // parents at once, so it asks first. Narrowing to listed numbers does not.
  const requestMode = (mode: WhatsAppPilotMode) => {
    if (mode === "everyone") setConfirmEveryone(true);
    else void handleMode(mode);
  };

  if (loading) return <SkeletonBlock rows={6} label="Loading pilot access" />;

  if (!state)
    return <ErrorNotice message="We couldn't load the pilot list. Reload the page to try again." />;

  return (
    <div className="space-y-6">
      {!state.assistantOn && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          The assistant is switched off on the server (<code>WHATSAPP_ASSISTANT</code> is not{" "}
          <code>on</code>), so every number gets the holding message whatever is set here.
        </div>
      )}

      <Panel title="Who gets the assistant">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                mode: "listed" as const,
                title: "Listed numbers only",
                body: "Only the numbers below. Use this while testing.",
              },
              {
                mode: "everyone" as const,
                title: "Everyone",
                body: "Any number that messages us. Switch to this when you launch.",
              },
            ] as const
          ).map((option) => {
            const selected = state.mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                disabled={savingMode}
                onClick={() => requestMode(option.mode)}
                aria-pressed={selected}
                className={`rounded-lg border p-4 text-left transition disabled:opacity-60 ${
                  selected
                    ? "border-power-orange-solid ring-power-orange-solid bg-orange-50/60 ring-1"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <p className="font-semibold text-slate-900">{option.title}</p>
                <p className="mt-1 text-sm text-slate-600">{option.body}</p>
              </button>
            );
          })}
        </div>
        {state.envListCount > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {state.envListCount} more {state.envListCount === 1 ? "number is" : "numbers are"} set
            on the server and always {state.envListCount === 1 ? "gets" : "get"} the assistant.
          </p>
        )}
      </Panel>

      <Panel
        title="Add numbers"
        description="One per line, with an optional name after the number. Indian mobile numbers only."
      >
        <label htmlFor="pilot-numbers" className="sr-only">
          Numbers to add
        </label>
        <textarea
          id="pilot-numbers"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"9876543210, Coach Ravi\n+91 98765 43211 Meera (parent)"}
          className={`${fieldClass} font-mono`}
        />
        {invalid.length > 0 && (
          <p className="mt-2 text-sm text-red-700">
            These lines were not recognised as Indian mobile numbers and were kept in the box:{" "}
            {invalid.join(" | ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Numbers are stored as one-way hashes. Only the name and last four digits are shown back.
          </p>
          <Button onClick={handleAdd} loading={adding} disabled={!text.trim()}>
            Add to pilot
          </Button>
        </div>
      </Panel>

      <Panel title={`Listed numbers (${state.numbers.length})`}>
        {state.numbers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No numbers yet. Until you add some, nobody gets the assistant.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.numbers.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{entry.label || "No name"}</p>
                  <p className="text-xs text-slate-500">
                    ending {entry.lastFour} · added{" "}
                    {format(new Date(entry.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removingId === entry.id}
                  aria-label={`Remove ${entry.label || `number ending ${entry.lastFour}`}`}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  {removingId === entry.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmModal
        open={confirmEveryone}
        title="Open the assistant to everyone?"
        description="Any number that messages PowerMySport on WhatsApp will get the AI assistant straight away."
        confirmLabel="Open to everyone"
        loading={savingMode}
        onConfirm={() => void handleMode("everyone")}
        onCancel={() => setConfirmEveryone(false)}
      />
    </div>
  );
}

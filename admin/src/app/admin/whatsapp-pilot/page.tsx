"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { toast } from "@/lib/toast";
import {
  WhatsAppPilotMode,
  WhatsAppPilotState,
  whatsappPilotApi,
} from "@/lib/api/whatsappPilotApi";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function WhatsAppPilotPage() {
  const [state, setState] = useState<WhatsAppPilotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);

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
    if (
      mode === "everyone" &&
      !window.confirm(
        "Anyone who messages the number will get the AI assistant. Open it to everyone?"
      )
    ) {
      return;
    }
    setSavingMode(true);
    try {
      await whatsappPilotApi.setMode(mode);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not change who gets the assistant."));
    } finally {
      setSavingMode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!state) {
    return <p className="py-12 text-center text-slate-500">The pilot list could not be loaded.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp pilot</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose who can chat with the PowerMySport assistant on WhatsApp. Anyone else who messages
          the number gets a short note that the assistant is being tested, and nothing they send is
          stored.
        </p>
      </div>

      {!state.assistantOn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The assistant is switched off on the server (<code>WHATSAPP_ASSISTANT</code> is not{" "}
          <code>on</code>), so every number gets the holding message whatever is set here.
        </div>
      )}

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Who gets the assistant</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                onClick={() => handleMode(option.mode)}
                aria-pressed={selected}
                className={`rounded-lg border p-4 text-left transition disabled:opacity-60 ${
                  selected
                    ? "border-slate-900 bg-slate-50"
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
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Add numbers</h2>
        <p className="mt-1 text-sm text-slate-600">
          One per line, with an optional name after the number. Indian mobile numbers only.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"9876543210, Coach Ravi\n+91 98765 43211 Meera (parent)"}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">
          Listed numbers{" "}
          <span className="font-normal text-slate-500">({state.numbers.length})</span>
        </h2>
        {state.numbers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No numbers yet. Until you add some, nobody gets the assistant.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
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
                  className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
      </Card>
    </div>
  );
}

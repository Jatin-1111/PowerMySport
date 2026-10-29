"use client";

import {
  CHILD_EVENT_DATE_PRECISIONS,
  CHILD_HISTORY_LIMITS,
  type ChildEventDatePrecision,
  type ChildEventKind,
  type ChildTimelineRow,
} from "@powermysport/shared-types";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import type { EntryChanges, NewEntry } from "@/modules/my-child/services/childHistory";
import {
  fromDateInput,
  KIND_HINTS,
  KIND_LABELS,
  toDateInput,
  todayInput,
} from "@/modules/my-child/utils/format";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Textarea } from "@/modules/shared/ui/Textarea";
import { useState } from "react";

const PRECISION_LABELS: Record<ChildEventDatePrecision, string> = {
  day: "Exact day",
  month: "Month and year",
  year: "Year only",
};

interface FormState {
  kind: ChildEventKind;
  title: string;
  resultLabel: string;
  date: string;
  precision: ChildEventDatePrecision;
  endedOn: string;
  resultUrl: string;
  detail: string;
}

/** What the dialog is for: a new entry, a tournament marked played, or editing a stored row. */
export type EntryDialogTarget =
  | { mode: "add" }
  | { mode: "result"; row: ChildTimelineRow }
  | { mode: "edit"; row: ChildTimelineRow };

const blank = (kind: ChildEventKind): FormState => ({
  kind,
  title: "",
  resultLabel: "",
  date: "",
  precision: "month",
  endedOn: "",
  resultUrl: "",
  detail: "",
});

const fromRow = (row: ChildTimelineRow, mode: "result" | "edit"): FormState => {
  // A played tournament is known to the day, so a result starts from that date.
  const precision = mode === "result" ? "day" : row.datePrecision;
  return {
    kind: row.kind === "milestone" || row.kind === "ranking" ? "award" : row.kind,
    title: row.title,
    resultLabel: row.resultLabel ?? "",
    date: toDateInput(row.occurredOn, precision),
    precision,
    endedOn: row.endedOn ? toDateInput(row.endedOn, precision) : "",
    resultUrl: row.resultUrl ?? "",
    detail: row.detail ?? "",
  };
};

const inputType = (precision: ChildEventDatePrecision): string =>
  precision === "day" ? "date" : precision === "month" ? "month" : "number";

export function EntryDialog({
  isOpen,
  onClose,
  target,
  kinds,
  saving,
  onAdd,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  target: EntryDialogTarget;
  /** The kinds this dialog may create, in the order offered. */
  kinds: ChildEventKind[];
  saving: boolean;
  onAdd: (entry: NewEntry) => Promise<unknown>;
  onSave: (entryId: string, changes: EntryChanges) => Promise<unknown>;
}) {
  const title =
    target.mode === "result"
      ? "Add a result"
      : target.mode === "edit"
        ? "Edit entry"
        : "Add an entry";

  // The form is mounted only while the dialog is open, so it starts from the target each time
  // and nothing typed in an earlier visit is left behind.
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {isOpen && (
        <EntryForm
          target={target}
          kinds={kinds}
          saving={saving}
          onClose={onClose}
          onAdd={onAdd}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function EntryForm({
  target,
  kinds,
  saving,
  onClose,
  onAdd,
  onSave,
}: {
  target: EntryDialogTarget;
  kinds: ChildEventKind[];
  saving: boolean;
  onClose: () => void;
  onAdd: (entry: NewEntry) => Promise<unknown>;
  onSave: (entryId: string, changes: EntryChanges) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormState>(() =>
    target.mode === "add"
      ? blank(kinds[0] ?? "tournament_result")
      : fromRow(target.row, target.mode)
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const hints = KIND_HINTS[form.kind];
  const editing = target.mode === "edit";
  const isCoaching = form.kind === "coaching_period";
  const fixedKind = target.mode !== "add" || kinds.length === 1;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const date = fromDateInput(form.date, form.precision);
    if (!form.title.trim()) return setError("Give this entry a title.");
    if (!date) return setError("Add a date.");
    const endedOn = form.endedOn ? fromDateInput(form.endedOn, form.precision) : null;
    if (form.endedOn && !endedOn) return setError("The end date does not look right.");

    try {
      if (editing && target.mode === "edit") {
        await onSave(target.row.id, {
          title: form.title.trim(),
          resultLabel: form.resultLabel.trim() || null,
          detail: form.detail.trim() || null,
          resultUrl: form.resultUrl.trim() || null,
          date,
          datePrecision: form.precision,
          ...(isCoaching ? { endedOn } : {}),
        });
      } else {
        await onAdd({
          kind: form.kind,
          title: form.title.trim(),
          date,
          datePrecision: form.precision,
          ...(form.resultLabel.trim() ? { resultLabel: form.resultLabel.trim() } : {}),
          ...(form.detail.trim() ? { detail: form.detail.trim() } : {}),
          ...(form.resultUrl.trim() ? { resultUrl: form.resultUrl.trim() } : {}),
          ...(isCoaching && endedOn ? { endedOn } : {}),
          ...(target.mode === "result" && target.row.editionSlug
            ? { editionSlug: target.row.editionSlug }
            : {}),
        });
      }
      onClose();
    } catch {
      // The mutation has already shown the server's message; the dialog stays open with the input.
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {!fixedKind && (
          <div>
            <label htmlFor="entry-kind" className="text-ink mb-1.5 block text-sm font-medium">
              What is it
            </label>
            <ProfileFormSelect
              id="entry-kind"
              value={form.kind}
              onChange={(value) => set("kind", value as ChildEventKind)}
              options={kinds.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
            />
          </div>
        )}

        <div>
          <label htmlFor="entry-title" className="text-ink mb-1.5 block text-sm font-medium">
            Title
          </label>
          <Input
            id="entry-title"
            value={form.title}
            maxLength={CHILD_HISTORY_LIMITS.titleChars}
            placeholder={hints.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="entry-precision" className="text-ink mb-1.5 block text-sm font-medium">
              How exact is the date
            </label>
            <ProfileFormSelect
              id="entry-precision"
              value={form.precision}
              onChange={(value) => {
                set("precision", value as ChildEventDatePrecision);
                set("date", "");
                set("endedOn", "");
              }}
              options={CHILD_EVENT_DATE_PRECISIONS.map((precision) => ({
                value: precision,
                label: PRECISION_LABELS[precision],
              }))}
            />
          </div>
          <div>
            <label htmlFor="entry-date" className="text-ink mb-1.5 block text-sm font-medium">
              {isCoaching ? "Started" : "Date"}
            </label>
            <Input
              id="entry-date"
              type={inputType(form.precision)}
              inputMode={form.precision === "year" ? "numeric" : undefined}
              placeholder={form.precision === "year" ? "2026" : undefined}
              min={form.precision === "year" ? 1990 : undefined}
              max={
                form.precision === "year" ? Number(todayInput("year")) : todayInput(form.precision)
              }
              value={form.date}
              onChange={(event) => set("date", event.target.value)}
            />
          </div>
        </div>

        {isCoaching && (
          <div>
            <label htmlFor="entry-ended" className="text-ink mb-1.5 block text-sm font-medium">
              Ended{" "}
              <span className="text-ink-muted font-normal">(leave empty if it is still going)</span>
            </label>
            <Input
              id="entry-ended"
              type={inputType(form.precision)}
              inputMode={form.precision === "year" ? "numeric" : undefined}
              max={
                form.precision === "year" ? Number(todayInput("year")) : todayInput(form.precision)
              }
              value={form.endedOn}
              onChange={(event) => set("endedOn", event.target.value)}
            />
          </div>
        )}

        {!isCoaching && (
          <div>
            <label htmlFor="entry-result" className="text-ink mb-1.5 block text-sm font-medium">
              {hints.resultLabel} <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <Input
              id="entry-result"
              value={form.resultLabel}
              maxLength={CHILD_HISTORY_LIMITS.resultLabelChars}
              placeholder={hints.result}
              onChange={(event) => set("resultLabel", event.target.value)}
            />
          </div>
        )}

        <div>
          <label htmlFor="entry-link" className="text-ink mb-1.5 block text-sm font-medium">
            Link to the draw or result page{" "}
            <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <Input
            id="entry-link"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={form.resultUrl}
            onChange={(event) => set("resultUrl", event.target.value)}
          />
          <p className="text-ink-muted mt-1.5 text-sm">
            A reader can open it to check the entry. Entries with a link are marked as such.
          </p>
        </div>

        <div>
          <label htmlFor="entry-detail" className="text-ink mb-1.5 block text-sm font-medium">
            Notes <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <Textarea
            id="entry-detail"
            rows={3}
            maxLength={CHILD_HISTORY_LIMITS.detailChars}
            value={form.detail}
            onChange={(event) => set("detail", event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="min-h-11">
            {editing ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </form>
    </>
  );
}

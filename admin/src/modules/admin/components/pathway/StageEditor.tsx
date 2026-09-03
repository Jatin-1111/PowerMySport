"use client";

// ─── Stage editor ────────────────────────────────────────────────────────────
//
// One stage, laid out as the five buckets the parent will read, in the order
// they will read them. The numbering (01…05) is the same numbering the public
// page shows, so an author editing "03" is looking at the block a parent sees
// labelled "03" — the two surfaces are meant to be legible against each other.
//
// The form owns a draft copy and only lifts it on save. That is deliberate: the
// server validates a whole stage at once, so half-finished intermediate states
// should never leave the browser.

import type {
  AdminPathwayAction,
  AdminPathwayPoint,
  AdminPathwayQuestion,
  AdminPathwayStage,
} from "@/modules/admin/services/admin";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";

import { ErrorList, Field, RepeatableList, TextArea, TextInput } from "./fields";

/** kebab-case, which is what the format requires of a stage key. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function emptyStage(): AdminPathwayStage {
  return {
    key: "",
    name: "",
    ageRange: "",
    coreQuestion: "",
    overview: "",
    questions: [],
    signals: [],
    decisions: [],
    nextSteps: [],
    helpLinks: [],
  };
}

function Bucket({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-power-orange text-xs font-extrabold tracking-[0.18em]">{number}</span>
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Label + optional href, used by the primary button and the help chips. */
function ActionRow({
  value,
  onChange,
}: {
  value: AdminPathwayAction;
  onChange: (next: AdminPathwayAction) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <TextInput
        value={value.label}
        onChange={(label) => onChange({ ...value, label })}
        placeholder="Button text"
      />
      <TextInput
        value={value.href ?? ""}
        onChange={(href) => onChange({ ...value, href })}
        placeholder="/experts or https://…"
      />
    </div>
  );
}

export function StageEditor({
  stage,
  isNew,
  saving,
  errors,
  onSave,
  onCancel,
}: {
  stage: AdminPathwayStage;
  isNew: boolean;
  saving: boolean;
  errors: string[];
  onSave: (stage: AdminPathwayStage) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<AdminPathwayStage>(stage);
  // The parent swaps which stage is being edited without unmounting this form,
  // so the draft has to follow. Keyed on `stage.key`, not the object, or every
  // re-render of the parent would discard the author's unsaved typing.
  const [editingKey, setEditingKey] = useState(stage.key);
  if (editingKey !== stage.key) {
    setEditingKey(stage.key);
    setDraft(stage);
  }

  const set = <K extends keyof AdminPathwayStage>(field: K, value: AdminPathwayStage[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  /**
   * A new stage gets its key suggested from its name; an existing one does not,
   * because the key is what links and saved positions are addressed by.
   *
   * Done here rather than in an effect: an effect that mirrors one field into
   * another renders twice and fights the author if they edit the key by hand.
   */
  const setName = (name: string) =>
    setDraft((current) => ({
      ...current,
      name,
      ...(isNew && current.key === slugify(current.name) ? { key: slugify(name) } : {}),
    }));

  const primary = draft.primaryAction ?? { label: "" };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-5"
    >
      {/* ── Identity ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stage name" hint="Shown upper-case, e.g. Discover Tennis">
          <TextInput value={draft.name} onChange={setName} placeholder="Discover Tennis" />
        </Field>
        <Field
          label="Stage key"
          hint={
            isNew
              ? "Generated from the name. Used in links."
              : "Renaming this breaks any link pointing at the stage."
          }
        >
          <TextInput
            value={draft.key}
            onChange={(key) => set("key", slugify(key))}
            placeholder="discover-tennis"
          />
        </Field>
        <Field label="Typical age" hint="Free text — ranges are fuzzy on purpose">
          <TextInput
            value={draft.ageRange}
            onChange={(ageRange) => set("ageRange", ageRange)}
            placeholder="~5–7"
          />
        </Field>
        <Field label="Core question" hint="The one question this stage answers">
          <TextInput
            value={draft.coreQuestion}
            onChange={(coreQuestion) => set("coreQuestion", coreQuestion)}
            placeholder="Should my child try tennis?"
          />
        </Field>
      </div>

      <Bucket number="01" title="Overview" subtitle="Where am I and what does this stage mean?">
        <TextArea
          value={draft.overview}
          rows={4}
          onChange={(overview) => set("overview", overview)}
          placeholder="Your child is discovering tennis and building a first relationship with the sport…"
        />
      </Bucket>

      <Bucket
        number="02"
        title="Parent's questions"
        subtitle="What am I likely to be worried or confused about?"
      >
        <RepeatableList
          label="Questions"
          hint="An answer is optional — a listed-but-unanswered question is a legitimate draft state."
          items={draft.questions}
          onChange={(questions) => set("questions", questions)}
          makeEmpty={(): AdminPathwayQuestion => ({ question: "" })}
          addLabel="Add question"
          emptyText="No questions yet."
          renderRow={(item, setItem) => (
            <>
              <TextInput
                value={item.question}
                onChange={(question) => setItem({ ...item, question })}
                placeholder="Is tennis suitable for my child?"
              />
              <TextArea
                value={item.answer ?? ""}
                rows={3}
                onChange={(answer) => setItem({ ...item, answer })}
                placeholder="The answer parents see when they open this question (optional)"
              />
            </>
          )}
        />
      </Bucket>

      <Bucket
        number="03"
        title="What to look for"
        subtitle="What should I observe in my child, the coach and the environment?"
      >
        <RepeatableList
          label="Signals"
          items={draft.signals}
          onChange={(signals) => set("signals", signals)}
          makeEmpty={(): AdminPathwayPoint => ({ title: "" })}
          addLabel="Add signal"
          emptyText="No signals yet."
          renderRow={(item, setItem) => (
            <>
              <TextInput
                value={item.title}
                onChange={(title) => setItem({ ...item, title })}
                placeholder="Enjoyment and willingness to return"
              />
              <TextArea
                value={item.detail ?? ""}
                rows={2}
                onChange={(detail) => setItem({ ...item, detail })}
                placeholder="Optional explanation"
              />
            </>
          )}
        />
      </Bucket>

      <Bucket number="04" title="Decisions" subtitle="What choices may I need to make?">
        <RepeatableList
          label="Decisions"
          items={draft.decisions}
          onChange={(decisions) => set("decisions", decisions)}
          makeEmpty={(): AdminPathwayPoint => ({ title: "" })}
          addLabel="Add decision"
          emptyText="No decisions yet."
          renderRow={(item, setItem) => (
            <>
              <TextInput
                value={item.title}
                onChange={(title) => setItem({ ...item, title })}
                placeholder="Which academy or coach?"
              />
              <TextArea
                value={item.detail ?? ""}
                rows={2}
                onChange={(detail) => setItem({ ...item, detail })}
                placeholder="Optional explanation"
              />
            </>
          )}
        />

        <RepeatableList
          label="Get help links"
          hint="The chips beside the decisions — Find academy, Book expert, and so on."
          items={draft.helpLinks}
          onChange={(helpLinks) => set("helpLinks", helpLinks)}
          makeEmpty={(): AdminPathwayAction => ({ label: "" })}
          addLabel="Add link"
          emptyText="No help links yet."
          renderRow={(item, setItem) => <ActionRow value={item} onChange={setItem} />}
        />
      </Bucket>

      <Bucket number="05" title="Next step" subtitle="What should I actually do now?">
        <Field label="Lead-in line">
          <TextInput
            value={draft.nextStepLead ?? ""}
            onChange={(nextStepLead) => set("nextStepLead", nextStepLead)}
            placeholder="Your situation decides the step. Pick the line that describes you today."
          />
        </Field>

        <RepeatableList
          label="Steps"
          hint={'The left column is the situation ("Not started") or the order ("Step 1").'}
          items={draft.nextSteps}
          onChange={(nextSteps) => set("nextSteps", nextSteps)}
          makeEmpty={() => ({ when: "", action: "" })}
          addLabel="Add step"
          emptyText="No steps yet."
          renderRow={(item, setItem) => (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <TextInput
                value={item.when}
                onChange={(when) => setItem({ ...item, when })}
                placeholder="Not started"
              />
              <TextInput
                value={item.action}
                onChange={(action) => setItem({ ...item, action })}
                placeholder="Find 2–3 age-appropriate trial options."
              />
            </div>
          )}
        />

        <Field label="Primary action button" hint="Leave the text blank to hide the button.">
          <ActionRow
            value={primary}
            onChange={(next) => set("primaryAction", next.label.trim() ? next : undefined)}
          />
        </Field>
      </Bucket>

      <ErrorList errors={errors} />

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isNew ? "Add stage" : "Save stage"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

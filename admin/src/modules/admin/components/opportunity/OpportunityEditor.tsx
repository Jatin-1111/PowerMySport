"use client";

// ─── Admissions & scholarships: the record form ─────────────────────────────
//
// Laid out in the order the public page reads, so an editor checking a record
// against its source works down both at once. Value in, onChange out: the page
// owns saving, verifying and publishing.

import { Field, RepeatableList, TextArea, TextInput } from "../pathway/fields";
import {
  CATEGORY_OPTIONS,
  OWNER_TYPE_OPTIONS,
  SCOPE_OPTIONS,
  SELECTION_OPTIONS,
  SPORT_OPTIONS,
  type OpportunityForm,
} from "./opportunityForm";

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none";

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    />
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function OpportunityEditor({
  form,
  onChange,
}: {
  form: OpportunityForm;
  onChange: (next: OpportunityForm) => void;
}) {
  const set = <K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) =>
    onChange({ ...form, [key]: value });

  const toggleSport = (slug: string) =>
    set(
      "sports",
      form.sports.includes(slug) ? form.sports.filter((s) => s !== slug) : [...form.sports, slug]
    );

  return (
    <div className="space-y-5">
      <Group title="What it is">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <TextInput value={form.title} onChange={(v) => set("title", v)} />
          </Field>
          <Field label="Slug" hint="The page address. Changing it breaks links already shared.">
            <TextInput value={form.slug} onChange={(v) => set("slug", v)} />
          </Field>
          <Field label="Page">
            <Select
              value={form.track}
              onChange={(v) =>
                onChange({
                  ...form,
                  track: v as OpportunityForm["track"],
                  category: CATEGORY_OPTIONS[v as OpportunityForm["track"]][0]!.value,
                })
              }
              options={[
                { value: "admission", label: "Admissions" },
                { value: "scholarship", label: "Scholarships" },
              ]}
            />
          </Field>
          <Field label="Section">
            <Select
              value={form.category}
              onChange={(v) => set("category", v)}
              options={CATEGORY_OPTIONS[form.track]}
            />
          </Field>
          <Field label="Run by">
            <TextInput
              value={form.ownerName}
              onChange={(v) => set("ownerName", v)}
              placeholder="University of Delhi"
            />
          </Field>
          <Field label="Kind of organisation">
            <Select
              value={form.ownerType}
              onChange={(v) => set("ownerType", v)}
              options={OWNER_TYPE_OPTIONS}
              placeholder="Choose…"
            />
          </Field>
        </div>
        <Field label="Summary" hint="Two or three sentences: what it is and who it is for.">
          <TextArea value={form.summary} onChange={(v) => set("summary", v)} rows={3} />
        </Field>
      </Group>

      <Group title="Who and where">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={form.allSports}
            onChange={(e) => set("allSports", e.target.checked)}
          />
          Covers all sports
        </label>
        {!form.allSports && (
          <div className="flex flex-wrap gap-2">
            {SPORT_OPTIONS.map((sport) => (
              <label
                key={sport.value}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.sports.includes(sport.value)}
                  onChange={() => toggleSport(sport.value)}
                />
                {sport.label}
              </label>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <Select
              value={form.scope}
              onChange={(v) => set("scope", v)}
              options={SCOPE_OPTIONS}
              placeholder="Choose…"
            />
          </Field>
          {form.scope === "state" && (
            <Field label="State">
              <TextInput value={form.state} onChange={(v) => set("state", v)} />
            </Field>
          )}
          <Field label="Youngest age">
            <TextInput value={form.ageMin} onChange={(v) => set("ageMin", v)} />
          </Field>
          <Field label="Oldest age">
            <TextInput value={form.ageMax} onChange={(v) => set("ageMax", v)} />
          </Field>
          <Field label="Gender">
            <Select
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={[
                { value: "any", label: "Any" },
                { value: "female", label: "Girls and women only" },
                { value: "male", label: "Boys and men only" },
              ]}
            />
          </Field>
        </div>
        <Field label="Age rule" hint="How ages are counted, if the source says.">
          <TextInput value={form.ageNote} onChange={(v) => set("ageNote", v)} />
        </Field>
        <Field label="Sporting level required">
          <TextArea value={form.level} onChange={(v) => set("level", v)} rows={2} />
        </Field>
        <Field label="Academic requirement">
          <TextInput value={form.academic} onChange={(v) => set("academic", v)} />
        </Field>
        <Field label="Income limit">
          <TextInput value={form.income} onChange={(v) => set("income", v)} />
        </Field>
      </Group>

      <Group
        title="How you get it"
        hint="If there is no application form, say so: pick Nominated or Picked by scouts."
      >
        <Field label="Selection">
          <Select
            value={form.selection}
            onChange={(v) => set("selection", v)}
            options={SELECTION_OPTIONS}
            placeholder="Choose…"
          />
        </Field>
        <Field label="What it gives">
          <TextArea
            value={form.benefitSummary}
            onChange={(v) => set("benefitSummary", v)}
            rows={2}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Amount" hint="Leave blank if none">
            <TextInput value={form.amountValue} onChange={(v) => set("amountValue", v)} />
          </Field>
          <Field label="Currency">
            <Select
              value={form.amountCurrency}
              onChange={(v) => set("amountCurrency", v)}
              options={[
                { value: "INR", label: "₹ INR" },
                { value: "USD", label: "$ USD" },
              ]}
            />
          </Field>
          <Field label="Per">
            <Select
              value={form.amountPeriod}
              onChange={(v) => set("amountPeriod", v)}
              options={[
                { value: "year", label: "Year" },
                { value: "month", label: "Month" },
                { value: "one-time", label: "One time" },
                { value: "total", label: "In total" },
              ]}
            />
          </Field>
          <Field label="Amount note">
            <TextInput
              value={form.amountNote}
              onChange={(v) => set("amountNote", v)}
              placeholder="Up to"
            />
          </Field>
        </div>
        <RepeatableList
          label="Steps"
          hint="What a parent does, in order. For scouted or nominated: how a player gets noticed."
          items={form.steps}
          onChange={(next) => set("steps", next)}
          makeEmpty={() => ""}
          addLabel="Add a step"
          renderRow={(item, update) => <TextArea value={item} onChange={update} rows={2} />}
        />
        <Field label="Official application link">
          <TextInput value={form.applyUrl} onChange={(v) => set("applyUrl", v)} />
        </Field>
      </Group>

      <Group
        title="This cycle"
        hint="Dates for the year these rules are for. They change every year."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cycle" hint="e.g. 2026-27">
            <TextInput value={form.cycleLabel} onChange={(v) => set("cycleLabel", v)} />
          </Field>
          <Field label="Window opens">
            <DateInput value={form.opensOn} onChange={(v) => set("opensOn", v)} />
          </Field>
          <Field label="Window closes">
            <DateInput value={form.closesOn} onChange={(v) => set("closesOn", v)} />
          </Field>
        </div>
        <RepeatableList
          label="Key dates"
          items={form.keyDates}
          onChange={(next) => set("keyDates", next)}
          makeEmpty={() => ({ label: "", date: "" })}
          addLabel="Add a date"
          renderRow={(item, update) => (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
              <TextInput
                value={item.label}
                onChange={(v) => update({ ...item, label: v })}
                placeholder="Trials begin"
              />
              <DateInput value={item.date} onChange={(v) => update({ ...item, date: v })} />
            </div>
          )}
        />
        <RepeatableList
          label="Good to know"
          items={form.keyFacts}
          onChange={(next) => set("keyFacts", next)}
          makeEmpty={() => ""}
          addLabel="Add a fact"
          renderRow={(item, update) => <TextArea value={item} onChange={update} rows={2} />}
        />
      </Group>

      <Group
        title="Sources"
        hint="Every figure above must come from one of these. Publishing needs at least one."
      >
        <RepeatableList
          label="Sources"
          items={form.sources}
          onChange={(next) => set("sources", next)}
          makeEmpty={() => ({ label: "", url: "", publishedOn: "" })}
          addLabel="Add a source"
          renderRow={(item, update) => (
            <div className="grid gap-2">
              <TextInput
                value={item.label}
                onChange={(v) => update({ ...item, label: v })}
                placeholder="What it is, e.g. DU admissions bulletin 2026-27"
              />
              <TextInput
                value={item.url}
                onChange={(v) => update({ ...item, url: v })}
                placeholder="https://"
              />
              <Field label="Published on (if the source says)">
                <DateInput
                  value={item.publishedOn}
                  onChange={(v) => update({ ...item, publishedOn: v })}
                />
              </Field>
            </div>
          )}
        />
        <RepeatableList
          label="Pages to watch"
          hint="Where next year's document will appear, e.g. the admissions page. Checked every week with the sources above; never shown to parents."
          items={form.watchUrls}
          onChange={(next) => set("watchUrls", next)}
          makeEmpty={() => ""}
          addLabel="Add a page"
          renderRow={(item, update) => (
            <TextInput value={item} onChange={update} placeholder="https://" />
          )}
        />
        <Field
          label="What could not be confirmed"
          hint="Shown to parents. Leave blank once everything is checked."
        >
          <TextArea
            value={form.verificationNote}
            onChange={(v) => set("verificationNote", v)}
            rows={2}
          />
        </Field>
      </Group>
    </div>
  );
}

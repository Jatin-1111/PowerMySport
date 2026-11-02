import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import type { ReactNode } from "react";

/** Form field styling shared by every editor on the profile page. */
export const FIELD_LABEL = "text-ink mb-1.5 block text-sm font-medium";
export const FIELD_INPUT =
  "border-ink/25 text-ink placeholder:text-ink-ash focus:border-ink focus-visible:ring-ink min-h-11 w-full rounded-md border bg-white px-3 py-2 focus:outline-none focus-visible:ring-2";
export const FIELD_HINT = "text-ink-body mt-1.5 text-sm";

/**
 * One part of the profile: a heading and a line on what it is for on the
 * left, the content on the right, a hairline above. Sections are ruled, not
 * boxed, so nothing sits inside a card inside the page. `action` is the
 * section's one edit control and always sits in the same place, under the
 * description.
 */
export function ProfileSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="border-hairline grid gap-x-12 gap-y-5 border-t py-10 xl:grid-cols-12"
    >
      <div className="xl:col-span-4">
        <h2 id={`${id}-heading`} className="text-ink text-base font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-ink-body mt-1 max-w-[36ch] text-pretty text-sm">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
      <div className="min-w-0 xl:col-span-8">{children}</div>
    </section>
  );
}

/** The section's edit control: a text link, the same everywhere. */
export function EditLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
    >
      {label}
    </button>
  );
}

/** Save is the one primary action while a section is being edited; Cancel is a link. */
export function FormActions({
  onSave,
  onCancel,
  saving,
  saveLabel = "Save",
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
      <Button type="button" onClick={onSave} disabled={saving} className="min-h-11">
        {saving ? "Saving" : saveLabel}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
      >
        Cancel
      </button>
    </div>
  );
}

/** Label and value rows, ruled. A row with no value is left out by the caller. */
export function ProfileFacts({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="border-hairline border-t">
      {rows.map((row) => (
        <div
          key={row.label}
          className="border-hairline grid gap-x-8 gap-y-1 border-b py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)]"
        >
          <dt className="text-ink-body">{row.label}</dt>
          <dd className="text-ink min-w-0 break-words font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

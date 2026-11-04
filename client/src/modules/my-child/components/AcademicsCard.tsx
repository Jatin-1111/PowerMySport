"use client";

import {
  CHILD_ACADEMIC_BOARDS,
  CHILD_HISTORY_LIMITS,
  type ChildAcademicBoard,
  type ChildHistoryView,
} from "@powermysport/shared-types";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import type { AcademicsChanges } from "@/modules/my-child/services/childHistory";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { useState } from "react";

const BOARD_LABELS: Record<ChildAcademicBoard, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  ISC: "ISC",
  IB: "IB",
  STATE: "State board",
  OTHER: "Other",
};

type Academics = NonNullable<ChildHistoryView["academics"]>;

const NONE = "";

/**
 * The few facts a university coach needs to place a student: the board, the year they finish
 * school, and optionally the school and what they want to study. Dated results and test scores
 * are timeline entries, added from here but listed with everything else.
 */
export function AcademicsCard({
  academics,
  saving,
  onSave,
  onAddResult,
}: {
  academics: ChildHistoryView["academics"];
  saving: boolean;
  onSave: (changes: AcademicsChanges) => Promise<unknown>;
  onAddResult: () => void;
}) {
  const [open, setOpen] = useState(false);
  const facts: Array<[string, string]> = academics ? factsOf(academics) : [];

  return (
    <div className="border-hairline rounded-xl border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-editorial text-ink text-xl font-light">Academics</h3>
          {facts.length > 0 ? (
            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-ink-muted text-sm">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-ink-body mt-1 text-pretty text-sm">
              Add the board and the year they finish school. A university coach looks for these.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
            {facts.length > 0 ? "Edit details" : "Add details"}
          </Button>
          <Button variant="outline" size="sm" className="min-h-11" onClick={onAddResult}>
            Add result or score
          </Button>
        </div>
      </div>

      <AcademicsDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        academics={academics}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
}

const factsOf = (academics: Academics): Array<[string, string]> => {
  const rows: Array<[string, string | undefined]> = [
    ["Board", academics.board ? BOARD_LABELS[academics.board] : undefined],
    [
      "Finishes school",
      academics.graduationYear ? `Class of ${academics.graduationYear}` : undefined,
    ],
    ["School", academics.school],
    ["Wants to study", academics.intendedField],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
};

function AcademicsDialog({
  isOpen,
  onClose,
  academics,
  saving,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  academics: ChildHistoryView["academics"];
  saving: boolean;
  onSave: (changes: AcademicsChanges) => Promise<unknown>;
}) {
  // Mounted only while open, so the form starts from what is saved each time.
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academic details" size="md">
      {isOpen && (
        <AcademicsForm academics={academics} saving={saving} onClose={onClose} onSave={onSave} />
      )}
    </Modal>
  );
}

function AcademicsForm({
  academics,
  saving,
  onClose,
  onSave,
}: {
  academics: ChildHistoryView["academics"];
  saving: boolean;
  onClose: () => void;
  onSave: (changes: AcademicsChanges) => Promise<unknown>;
}) {
  const [board, setBoard] = useState<string>(academics?.board ?? NONE);
  const [year, setYear] = useState(
    academics?.graduationYear ? String(academics.graduationYear) : ""
  );
  const [school, setSchool] = useState(academics?.school ?? "");
  const [field, setField] = useState(academics?.intendedField ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const graduationYear = year.trim() === "" ? null : Number(year);
    if (graduationYear !== null && !Number.isInteger(graduationYear)) {
      return setError("The year should be a number such as 2029.");
    }
    try {
      await onSave({
        board: board === NONE ? null : (board as ChildAcademicBoard),
        graduationYear,
        school: school.trim() || null,
        intendedField: field.trim() || null,
      });
      onClose();
    } catch {
      // The mutation has already shown the server's message; the dialog stays open.
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="academic-board" className="text-ink mb-1.5 block text-sm font-medium">
            Board
          </label>
          <ProfileFormSelect
            id="academic-board"
            value={board}
            onChange={setBoard}
            options={[
              { value: NONE, label: "Not chosen" },
              ...CHILD_ACADEMIC_BOARDS.map((value) => ({ value, label: BOARD_LABELS[value] })),
            ]}
          />
        </div>
        <div>
          <label htmlFor="academic-year" className="text-ink mb-1.5 block text-sm font-medium">
            Year they finish school
          </label>
          <Input
            id="academic-year"
            inputMode="numeric"
            placeholder="2029"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="academic-school" className="text-ink mb-1.5 block text-sm font-medium">
            School <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <Input
            id="academic-school"
            maxLength={120}
            value={school}
            onChange={(event) => setSchool(event.target.value)}
          />
          <p className="text-ink-muted mt-1.5 text-sm">
            A school name points to a real child, so add it only if you want a coach to see it.
          </p>
        </div>
        <div>
          <label htmlFor="academic-field" className="text-ink mb-1.5 block text-sm font-medium">
            What they want to study <span className="text-ink-muted font-normal">(optional)</span>
          </label>
          <Input
            id="academic-field"
            maxLength={CHILD_HISTORY_LIMITS.titleChars}
            value={field}
            onChange={(event) => setField(event.target.value)}
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
            Save details
          </Button>
        </div>
      </form>
    </>
  );
}

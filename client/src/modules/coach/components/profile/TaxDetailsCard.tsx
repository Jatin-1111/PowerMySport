import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";

interface TaxDetailsCardProps {
  gstNumber?: string;
  isEditing: boolean;
  isSaving: boolean;
  taxForm: { gstNumber: string };
  setTaxForm: (form: { gstNumber: string }) => void;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function TaxDetailsCard({
  gstNumber,
  isEditing,
  isSaving,
  taxForm,
  setTaxForm,
  onEditClick,
  onSave,
  onCancel,
}: TaxDetailsCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Tax Details</h3>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEditClick}
            className="w-full sm:w-auto"
          >
            Edit Tax Details
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              GST Number (optional)
            </label>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              value={taxForm.gstNumber}
              maxLength={15}
              onChange={(e) => setTaxForm({ gstNumber: e.target.value.toUpperCase() })}
              placeholder="e.g. 22AAAAA0000A1Z5"
              className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Only if you&apos;re GST-registered — shown on your booking invoices.
            </p>
          </div>
          <div className="grid gap-2 sm:flex">
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              loading={isSaving}
              className="w-full sm:w-auto"
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700">{gstNumber || "No GST number added yet"}</p>
      )}
    </Card>
  );
}

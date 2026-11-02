import {
  EditLink,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  FormActions,
  ProfileSection,
} from "./ProfileSection";

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
    <ProfileSection
      id="tax"
      title="Tax details"
      description="Add a GST number only if you are GST-registered. It appears on your booking invoices."
      action={!isEditing && <EditLink onClick={onEditClick} label="Edit tax details" />}
    >
      {isEditing ? (
        <div className="max-w-md space-y-4">
          <div>
            <label htmlFor="coach-gst" className={FIELD_LABEL}>
              GST number (optional)
            </label>
            <input
              id="coach-gst"
              autoCapitalize="characters"
              autoComplete="off"
              value={taxForm.gstNumber}
              maxLength={15}
              onChange={(e) => setTaxForm({ gstNumber: e.target.value.toUpperCase() })}
              placeholder="22AAAAA0000A1Z5"
              className={`${FIELD_INPUT} font-mono uppercase tracking-wider`}
            />
            <p className={FIELD_HINT}>15 characters.</p>
          </div>
          <FormActions onSave={onSave} onCancel={onCancel} saving={isSaving} />
        </div>
      ) : gstNumber ? (
        <p className="text-ink font-mono font-medium tracking-wider">{gstNumber}</p>
      ) : (
        <p className="text-ink-body">No GST number added.</p>
      )}
    </ProfileSection>
  );
}

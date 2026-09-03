import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";

interface AboutCardProps {
  bio: string;
  isEditing: boolean;
  isSaving: boolean;
  aboutForm: { bio: string };
  setAboutForm: (form: { bio: string }) => void;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AboutCard({
  bio,
  isEditing,
  isSaving,
  aboutForm,
  setAboutForm,
  onEditClick,
  onSave,
  onCancel,
}: AboutCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">About You</h3>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEditClick}
            className="w-full sm:w-auto"
          >
            Edit About
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={aboutForm.bio}
            onChange={(event) => setAboutForm({ bio: event.target.value })}
            rows={5}
            className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
            placeholder="Tell players about your experience and coaching style"
          />
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
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {bio || "No bio added yet"}
        </p>
      )}
    </Card>
  );
}

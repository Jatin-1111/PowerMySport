import { EditLink, FIELD_INPUT, FIELD_LABEL, FormActions, ProfileSection } from "./ProfileSection";

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
    <ProfileSection
      id="about"
      title="About you"
      description="What clients read first on your public profile."
      action={!isEditing && <EditLink onClick={onEditClick} label="Edit about" />}
    >
      {isEditing ? (
        <div className="max-w-[60ch] space-y-4">
          <div>
            <label htmlFor="coach-bio" className={FIELD_LABEL}>
              Your bio
            </label>
            <textarea
              id="coach-bio"
              value={aboutForm.bio}
              onChange={(event) => setAboutForm({ bio: event.target.value })}
              rows={6}
              className={FIELD_INPUT}
              placeholder="Your experience, who you coach and how you run a session"
            />
          </div>
          <FormActions onSave={onSave} onCancel={onCancel} saving={isSaving} />
        </div>
      ) : bio ? (
        <p className="text-ink-body max-w-[60ch] whitespace-pre-wrap text-pretty leading-relaxed">
          {bio}
        </p>
      ) : (
        <p className="text-ink-body max-w-[60ch] text-pretty">
          No bio yet. Add a few lines about your experience and how you coach.
        </p>
      )}
    </ProfileSection>
  );
}

import type { User } from "@/types";
import {
  EditLink,
  FIELD_INPUT,
  FIELD_LABEL,
  FormActions,
  ProfileFacts,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";

interface ContactForm {
  name: string;
  email: string;
  phone: string;
}

interface ContactDetailsCardProps {
  user: User | null;
  isEditing: boolean;
  isSaving: boolean;
  profileForm: ContactForm;
  setProfileForm: (updater: (prev: ContactForm) => ContactForm) => void;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** The account details clients and our team reach the coach on. */
export function ContactDetailsCard({
  user,
  isEditing,
  isSaving,
  profileForm,
  setProfileForm,
  onEditClick,
  onSave,
  onCancel,
}: ContactDetailsCardProps) {
  return (
    <ProfileSection
      id="contact"
      title="Contact details"
      description="Your name, email and phone number on this account."
      action={!isEditing && <EditLink onClick={onEditClick} label="Edit contact details" />}
    >
      {isEditing ? (
        <div className="max-w-md space-y-4">
          <div>
            <label htmlFor="coach-name" className={FIELD_LABEL}>
              Name
            </label>
            <input
              id="coach-name"
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              className={FIELD_INPUT}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="coach-email" className={FIELD_LABEL}>
              Email
            </label>
            <input
              id="coach-email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              className={FIELD_INPUT}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="coach-phone" className={FIELD_LABEL}>
              Phone number
            </label>
            <input
              id="coach-phone"
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              className={FIELD_INPUT}
              autoComplete="tel"
            />
          </div>
          <FormActions onSave={onSave} onCancel={onCancel} saving={isSaving} />
        </div>
      ) : (
        <ProfileFacts
          rows={[
            { label: "Name", value: user?.name || "Not provided" },
            { label: "Email", value: user?.email || "Not provided" },
            { label: "Phone number", value: user?.phone || "Not provided" },
          ]}
        />
      )}
    </ProfileSection>
  );
}

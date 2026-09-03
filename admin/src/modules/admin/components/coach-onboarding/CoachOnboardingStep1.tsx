import CoachPhotoUpload from "@/modules/admin/components/CoachPhotoUpload";
import { FormErrors, sanitizeMobileNumber } from "@/modules/admin/utils/coachOnboardingHelpers";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";

interface CoachOnboardingStep1Props {
  loading: boolean;
  errors: FormErrors;
  setErrors: (updater: (prev: FormErrors) => FormErrors) => void;

  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  profilePhotoUrl: string;
  setProfilePhotoUrl: (value: string) => void;
  setProfilePhotoKey: (value: string) => void;

  onContinue: () => void;
}

export function CoachOnboardingStep1({
  loading,
  errors,
  setErrors,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  bio,
  setBio,
  profilePhotoUrl,
  setProfilePhotoUrl,
  setProfilePhotoKey,
  onContinue,
}: CoachOnboardingStep1Props) {
  return (
    <div className="space-y-6">
      <OnboardingSectionCard
        title="Coach identity"
        subtitle="Create the account and capture the coach's personal details."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">First name *</label>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                errors.firstName
                  ? "border-red-400 focus:ring-red-200"
                  : "focus:ring-power-orange/30 border-slate-300"
              }`}
              placeholder="First name"
              disabled={loading}
            />
            {errors.firstName ? (
              <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Last name *</label>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                errors.lastName
                  ? "border-red-400 focus:ring-red-200"
                  : "focus:ring-power-orange/30 border-slate-300"
              }`}
              placeholder="Last name"
              disabled={loading}
            />
            {errors.lastName ? (
              <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                errors.email
                  ? "border-red-400 focus:ring-red-200"
                  : "focus:ring-power-orange/30 border-slate-300"
              }`}
              placeholder="coach@example.com"
              disabled={loading}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(sanitizeMobileNumber(event.target.value))}
              className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                errors.phone
                  ? "border-red-400 focus:ring-red-200"
                  : "focus:ring-power-orange/30 border-slate-300"
              }`}
              placeholder="+91 98765 43210"
              disabled={loading}
            />
            {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">Bio *</label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={5}
            maxLength={2000}
            className={`w-full rounded-2xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
              errors.bio
                ? "border-red-400 focus:ring-red-200"
                : "focus:ring-power-orange/30 border-slate-300"
            }`}
            placeholder="Tell players about the coach's experience, style, and certifications."
            disabled={loading}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{bio.length}/2000 characters</span>
            {errors.bio ? (
              <span className="text-red-600">{errors.bio}</span>
            ) : (
              <span>Minimum 20 characters</span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">Profile photo *</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <CoachPhotoUpload
              currentPhotoUrl={profilePhotoUrl}
              onPhotoReady={(url, key) => {
                setProfilePhotoUrl(url || "");
                setProfilePhotoKey(key || "");
                setErrors((prev) => ({ ...prev, profilePhoto: "" }));
              }}
              disabled={loading}
            />
            {errors.profilePhoto ? (
              <p className="mt-2 text-center text-xs text-red-600">{errors.profilePhoto}</p>
            ) : null}
          </div>
        </div>
      </OnboardingSectionCard>

      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={onContinue} disabled={loading}>
          Continue to coaching setup
        </Button>
      </div>
    </div>
  );
}

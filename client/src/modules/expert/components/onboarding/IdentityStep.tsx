import { ExpertPhotoUpload } from "@/modules/expert/components/ExpertPhotoUpload";
import LanguagesMultiSelect from "@/modules/shared/components/LanguagesMultiSelect";
import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from "@/modules/shared/components/settings/ProfileSection";
import { cn } from "@/utils/cn";
import type { ExpertOnboardingState } from "./useExpertOnboarding";
import { StepShell } from "./StepShell";

export function IdentityStep({ o }: { o: ExpertOnboardingState }) {
  return (
    <StepShell title="Your identity" description="How parents will get to know you.">
      <ExpertPhotoUpload
        currentPhotoUrl={o.photoUrl || undefined}
        onPhotoReady={(url, key) => {
          o.setPhotoUrl(url);
          o.setPhotoKey(key);
        }}
      />

      <div>
        <label htmlFor="expert-name" className={FIELD_LABEL}>
          Name
        </label>
        <input
          id="expert-name"
          autoComplete="name"
          className={FIELD_INPUT}
          value={o.name}
          onChange={(e) => o.setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="expert-bio" className={FIELD_LABEL}>
          Bio
        </label>
        <textarea
          id="expert-bio"
          rows={5}
          className={FIELD_INPUT}
          value={o.bio}
          onChange={(e) => o.setBio(e.target.value)}
          maxLength={4000}
        />
        <p className={cn(FIELD_HINT, "tabular-nums")}>
          Your background, your experience and what makes you different. At least 20 characters.{" "}
          {o.bio.length} of 4000.
        </p>
      </div>

      <div>
        <label htmlFor="expert-achievements" className={FIELD_LABEL}>
          Achievements
        </label>
        <textarea
          id="expert-achievements"
          rows={3}
          className={FIELD_INPUT}
          value={o.achievements}
          onChange={(e) => o.setAchievements(e.target.value)}
        />
        <p className={FIELD_HINT}>
          For example, national champion 2018, represented India U23, state gold medallist 2020.
          This is your main trust signal with parents, so be specific.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="expert-city" className={FIELD_LABEL}>
            City <span className="text-ink-body font-normal">(optional)</span>
          </label>
          <input
            id="expert-city"
            autoComplete="address-level2"
            className={FIELD_INPUT}
            value={o.city}
            onChange={(e) => o.setCity(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="expert-languages" className={FIELD_LABEL}>
            Languages <span className="text-ink-body font-normal">(optional)</span>
          </label>
          <LanguagesMultiSelect
            id="expert-languages"
            value={o.languages}
            onChange={o.setLanguages}
          />
        </div>
      </div>
    </StepShell>
  );
}

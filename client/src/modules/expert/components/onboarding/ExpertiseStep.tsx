import { ExpertProofSection } from "@/modules/expert/components/ExpertProofSection";
import ExpertiseMultiSelect from "@/modules/shared/components/ExpertiseMultiSelect";
import { FIELD_HINT, FIELD_LABEL } from "@/modules/shared/components/settings/ProfileSection";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";
import type { ExpertOnboardingState } from "./useExpertOnboarding";
import { StepShell } from "./StepShell";

export function ExpertiseStep({ o }: { o: ExpertOnboardingState }) {
  return (
    <StepShell
      title="Your expertise"
      description="Drives search discovery and which sport pathways you can endorse."
    >
      <div>
        <p className={FIELD_LABEL}>Sports</p>
        <SportsMultiSelect
          value={o.sports}
          onChange={o.setSports}
          allowedSports={SUPPORTED_SPORT_NAMES}
        />
      </div>
      <div>
        <label htmlFor="expert-expertise" className={FIELD_LABEL}>
          Expertise and specialisations
        </label>
        <ExpertiseMultiSelect id="expert-expertise" value={o.expertise} onChange={o.setExpertise} />
        <p className={FIELD_HINT}>
          For example, batting technique, penalty kicks, serve and return, mental conditioning.
        </p>
      </div>
      <ExpertProofSection />
    </StepShell>
  );
}

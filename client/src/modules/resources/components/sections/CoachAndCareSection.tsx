// ─── Coach, safety and paperwork ────────────────────────────────────────────
//
// The practical section, and the most useful one on the page. `redFlags` and
// `questionsToAsk` are the only content on the platform that helps a parent
// evaluate a coach before handing over a term's fees, and `localResources` is the
// only content that is specific to where they actually live.

import {
  Building2,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  MessageCircleQuestion,
  ShieldAlert,
  Smile,
  UserCheck,
} from "lucide-react";

import type { PathwayLevel } from "@/modules/sports/services/pathway";

import { BulletList, Panel, Section } from "../primitives";

export function hasCoachAndCare(levels: PathwayLevel[]): boolean {
  return levels.some(
    (l) =>
      l.coachSelectionGuide ||
      l.localResources ||
      l.injuryRisks ||
      l.mentalSkillsFocus?.length ||
      l.academicIntegration ||
      l.proactiveDocuments?.length,
  );
}

export function CoachAndCareSection({
  id,
  levels,
  state,
}: {
  id: string;
  levels: PathwayLevel[];
  /** Named in the local-resources heading so it's obvious the list is scoped. */
  state?: string;
}) {
  if (!hasCoachAndCare(levels)) return null;

  return (
    <Section
      id={id}
      title="Choosing a coach, and keeping them safe"
      intro="How to judge a coach before you pay, the injuries to watch for, and the paperwork to have ready."
    >
      {levels.map((level) => {
        const coach = level.coachSelectionGuide;
        const injury = level.injuryRisks;
        const local = level.localResources;
        return (
          <div key={level.level} className="space-y-4">
            {levels.length > 1 && (
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {level.label}
              </p>
            )}

            {coach && (
              <div className="grid gap-3 md:grid-cols-2">
                {coach.mustHave?.length ? (
                  <Panel
                    title="Must have"
                    icon={<UserCheck className="h-3.5 w-3.5" />}
                    tone="good"
                  >
                    <BulletList items={coach.mustHave} tone="good" />
                  </Panel>
                ) : null}
                {coach.redFlags?.length ? (
                  <Panel
                    title="Walk away if"
                    icon={<ShieldAlert className="h-3.5 w-3.5" />}
                    tone="danger"
                  >
                    <BulletList items={coach.redFlags} tone="danger" />
                  </Panel>
                ) : null}
                {coach.niceToHave?.length ? (
                  <Panel title="Nice to have">
                    <BulletList items={coach.niceToHave} />
                  </Panel>
                ) : null}
                {coach.questionsToAsk?.length ? (
                  <Panel
                    title="Ask them this"
                    icon={<MessageCircleQuestion className="h-3.5 w-3.5" />}
                    tone="info"
                  >
                    <BulletList items={coach.questionsToAsk} tone="info" numbered />
                  </Panel>
                ) : null}
              </div>
            )}

            {/* The only genuinely local content on the platform. */}
            {local && (
              <Panel
                title={state ? `Near you — ${state}` : "Where to go"}
                icon={<Building2 className="h-3.5 w-3.5" />}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {local.academies?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Academies
                      </p>
                      <BulletList items={local.academies} />
                    </div>
                  ) : null}
                  {local.facilities?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Facilities
                      </p>
                      <BulletList items={local.facilities} />
                    </div>
                  ) : null}
                  {local.governingBodies?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Who to register with
                      </p>
                      <BulletList items={local.governingBodies} />
                    </div>
                  ) : null}
                </div>
              </Panel>
            )}

            {injury && (
              <Panel
                title="Staying uninjured"
                icon={<HeartPulse className="h-3.5 w-3.5" />}
                tone="caution"
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {injury.commonInjuries?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Common at this level
                      </p>
                      <BulletList items={injury.commonInjuries} />
                    </div>
                  ) : null}
                  {injury.preventionTips?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        Prevention
                      </p>
                      <BulletList items={injury.preventionTips} tone="good" />
                    </div>
                  ) : null}
                  {injury.warningSignsToWatch?.length ? (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-rose-600">
                        Stop and get it checked
                      </p>
                      <BulletList items={injury.warningSignsToWatch} tone="danger" />
                    </div>
                  ) : null}
                </div>
              </Panel>
            )}

            {level.mentalSkillsFocus?.length ? (
              <Panel
                title="Mental skills to build"
                icon={<Smile className="h-3.5 w-3.5" />}
              >
                <BulletList items={level.mentalSkillsFocus} />
              </Panel>
            ) : null}

            {level.academicIntegration && (
              <Panel
                title="School alongside this"
                icon={<GraduationCap className="h-3.5 w-3.5" />}
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  {level.academicIntegration}
                </p>
              </Panel>
            )}

            {level.proactiveDocuments?.length ? (
              <Panel
                title="Paperwork to have ready"
                icon={<FileCheck2 className="h-3.5 w-3.5" />}
              >
                <BulletList items={level.proactiveDocuments} />
              </Panel>
            ) : null}
          </div>
        );
      })}
    </Section>
  );
}

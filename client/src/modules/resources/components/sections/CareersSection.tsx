// ─── Life beyond playing ────────────────────────────────────────────────────
//
// The handbook's last stage, and the one that applies to the most readers. Very
// few players compete for a living; nearly all of them can work in the sport if
// they want to. Placed after the stages so it reads as the natural continuation
// of the pathway rather than a consolation page.

import { Briefcase, GraduationCap, Sparkles } from "lucide-react";

import type { SportGuide } from "../../content/types";
import { BulletList, Panel, Section } from "../primitives";

export function CareersSection({
  id,
  sportName,
  careers,
}: {
  id: string;
  sportName: string;
  careers: SportGuide["careers"];
}) {
  return (
    <div
      id={id}
      className="scroll-mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7 sm:py-6">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Briefcase className="h-3.5 w-3.5" />
          After the playing years
        </p>
        <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
          A career in {sportName.toLowerCase()}, without being a pro
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          {careers.intro}
        </p>
      </header>

      <div className="space-y-9 px-5 py-6 sm:px-7 sm:py-8">
        <Section
          id={`${id}-tracks`}
          title="The routes that exist"
          intro="Most of these start paying while your child is still competing."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {careers.tracks.map((track) => (
              <Panel key={track.role} title={track.role}>
                <p className="text-sm leading-relaxed text-slate-700">
                  {track.summary}
                </p>
                {track.ladder?.length ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      How it progresses
                    </p>
                    <p className="text-[13px] font-semibold leading-relaxed text-slate-600">
                      {track.ladder.join(" → ")}
                    </p>
                  </div>
                ) : null}
                {track.credentials?.length ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Qualifications
                    </p>
                    <BulletList items={track.credentials} />
                  </div>
                ) : null}
              </Panel>
            ))}
          </div>
        </Section>

        <Section
          id={`${id}-emerging`}
          title="Where the new jobs are"
          intro="Roles that barely existed a decade ago, and are likely to grow through the next one."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Emerging roles" icon={<Sparkles className="h-3.5 w-3.5" />} tone="info">
              <BulletList items={careers.emerging} tone="info" />
            </Panel>
            <Panel title="What the sport gives them regardless" tone="good">
              <BulletList items={careers.skills} tone="good" />
            </Panel>
          </div>
        </Section>
      </div>
    </div>
  );
}

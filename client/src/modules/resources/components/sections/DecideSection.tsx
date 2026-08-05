// ─── Should we do this at all? ──────────────────────────────────────────────
//
// The handbook opens on this and the page didn't have it, which meant the guide
// started by explaining a ladder to a parent who hadn't yet decided whether to
// step onto it. Sits above the stages for exactly that reason.

import { HandCoins, HeartHandshake, Scale, ThumbsDown, ThumbsUp, Timer } from "lucide-react";

import type { SportGuide } from "../../content/types";
import {
  BulletList,
  Callout,
  DataTable,
  Panel,
  Section,
  SplitLists,
} from "../primitives";

export function DecideSection({
  id,
  sportName,
  decide,
}: {
  id: string;
  sportName: string;
  decide: SportGuide["decide"];
}) {
  return (
    <div
      id={id}
      className="scroll-mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Before the pathway
        </p>
        <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
          Is {sportName.toLowerCase()} right for your child?
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          {decide.intro}
        </p>
      </header>

      <div className="space-y-9 px-5 py-6 sm:px-7 sm:py-8">
        <Section
          id={`${id}-fit`}
          title="Signs it fits, and signs it doesn't"
          intro="Neither list is a verdict — but the second one is worth reading honestly."
        >
          <SplitLists
            left={{
              title: "Likely a good fit if your child",
              items: decide.goodFit,
              tone: "good",
              icon: <ThumbsUp className="h-3.5 w-3.5" />,
            }}
            right={{
              title: "Maybe not the first choice if",
              items: decide.poorFit,
              tone: "caution",
              icon: <ThumbsDown className="h-3.5 w-3.5" />,
            }}
          />
          <Callout tone="info">{decide.enjoymentNote}</Callout>
        </Section>

        <Section
          id={`${id}-age`}
          title="When to start"
          intro="There is no correct age — different ages suit different kinds of learning."
        >
          <DataTable
            columns={["Age", "What it should look like"]}
            rows={decide.ages.map((a) => [a.age, a.focus])}
          />
          <Callout tone="info" icon={<Timer className="h-4 w-4" />} title="Starting late">
            {decide.lateStart}
          </Callout>
        </Section>

        <Section
          id={`${id}-suits`}
          title="What actually helps"
          intro="Physical attributes matter less than parents expect. Temperament matters more."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="Helpful physically"
              icon={<HeartHandshake className="h-3.5 w-3.5" />}
            >
              <BulletList items={decide.physical} />
              <p className="mt-3 border-t border-slate-100 pt-3 text-[13px] leading-relaxed text-slate-500">
                {decide.heightNote}
              </p>
            </Panel>
            <Panel title="Temperament that carries" tone="info">
              <dl className="divide-y divide-sky-100">
                {decide.traits.map((t) => (
                  <div key={t.trait} className="py-2 first:pt-0 last:pb-0">
                    <dt className="text-[13px] font-bold text-slate-800">{t.trait}</dt>
                    <dd className="text-[13px] leading-snug text-slate-600">{t.why}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </Section>

        <Section
          id={`${id}-cost`}
          title="What it costs, honestly"
          intro="The number that decides most families' answer, so it comes before the pathway rather than after it."
        >
          <DataTable
            columns={["Level", "Typical cost a year"]}
            rows={decide.costs.map((c) => [c.level, c.annual])}
            tone="caution"
          />
          <Callout tone="caution" icon={<HandCoins className="h-4 w-4" />}>
            {decide.costNote}
          </Callout>
          <Panel title="What you're paying for">
            <BulletList items={decide.expenses} />
          </Panel>
        </Section>

        <Section
          id={`${id}-path`}
          title="Playing for fun, or playing to compete?"
          intro="You don't have to choose now, and choosing isn't permanent."
        >
          <SplitLists
            left={{
              title: "Recreational suits families wanting",
              items: decide.recreational,
              tone: "good",
            }}
            right={{
              title: "Competitive suits a child who",
              items: decide.competitive,
              tone: "info",
            }}
          />
          <Callout tone="info" icon={<Scale className="h-4 w-4" />}>
            {decide.switchNote}
          </Callout>
        </Section>
      </div>
    </div>
  );
}

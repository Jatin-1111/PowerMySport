// ─── Authored per-stage practicalities ──────────────────────────────────────
//
// The handbook content the generated pathway has no fields for: what gear at what
// size, how many sessions a week, what to say after a session, what to eat, what
// to pack, how the ranking works, what families get wrong here, and what "ready
// to move on" looks like.
//
// Rendered after the generated sections so the stage reads structure first, then
// what to actually do about it. Every block is independently optional — a stage
// with no authored gear guidance simply doesn't show a gear block.

import {
  Backpack,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Eye,
  Footprints,
  HeartPulse,
  MessageSquare,
  Package,
  Salad,
  Stethoscope,
  Target,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";

import type { StageExtras } from "../../content/types";
import {
  BulletList,
  Callout,
  DataTable,
  Panel,
  Section,
} from "../primitives";

export function StageExtrasSection({
  anchor,
  extras,
}: {
  anchor: string;
  extras: StageExtras;
}) {
  return (
    <>
      {extras.academy && (
        <Section
          id={`${anchor}-academy`}
          title="Choosing where they train"
          intro={extras.academy.intro}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {extras.academy.criteria.map((c) => (
              <Panel
                key={c.what}
                title={c.what}
                icon={<Building2 className="h-3.5 w-3.5" />}
              >
                <p className="text-sm leading-relaxed text-slate-700">{c.why}</p>
              </Panel>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {extras.academy.observe?.length ? (
              <Panel
                title="Watch a session and ask yourself"
                icon={<Eye className="h-3.5 w-3.5" />}
                tone="info"
              >
                <BulletList items={extras.academy.observe} tone="info" />
              </Panel>
            ) : null}
            {extras.academy.ask?.length ? (
              <Panel title="Ask before you pay" tone="good">
                <BulletList items={extras.academy.ask} tone="good" />
              </Panel>
            ) : null}
          </div>

          {extras.academy.note && (
            <Callout tone="info" icon={<Eye className="h-4 w-4" />}>
              {extras.academy.note}
            </Callout>
          )}
        </Section>
      )}

      {extras.technique && (
        <Section
          id={`${anchor}-technique`}
          title="What they're actually learning to do"
          intro={extras.technique.intro}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {extras.technique.strokes?.length ? (
              <Panel title="The strokes" icon={<Target className="h-3.5 w-3.5" />}>
                <BulletList items={extras.technique.strokes} />
              </Panel>
            ) : null}
            {extras.technique.refinements?.length ? (
              <Panel title="Beyond just hitting it" tone="info">
                <BulletList items={extras.technique.refinements} tone="info" />
              </Panel>
            ) : null}
          </div>

          {extras.technique.matchAwareness?.length ? (
            <Panel title="Starting to read the point" tone="good">
              <BulletList items={extras.technique.matchAwareness} tone="good" />
            </Panel>
          ) : null}

          {extras.technique.footwork && (
            <Panel
              title="Footwork — how they get to the ball"
              icon={<Footprints className="h-3.5 w-3.5" />}
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {extras.technique.footwork.movement?.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Movement skills
                    </p>
                    <BulletList items={extras.technique.footwork.movement} />
                  </div>
                ) : null}
                {extras.technique.footwork.drills?.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      How it's trained
                    </p>
                    <BulletList items={extras.technique.footwork.drills} />
                  </div>
                ) : null}
              </div>
              {extras.technique.footwork.note && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {extras.technique.footwork.note}
                </p>
              )}
            </Panel>
          )}
        </Section>
      )}

      {extras.gear && (
        <Section
          id={`${anchor}-gear`}
          title="Gear that's right for this age"
          intro={extras.gear.intro}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {extras.gear.items.map((g) => (
              <Panel key={g.item} title={g.item} icon={<Package className="h-3.5 w-3.5" />}>
                <p className="text-sm leading-relaxed text-slate-700">{g.guidance}</p>
              </Panel>
            ))}
          </div>
        </Section>
      )}

      {extras.load && (
        <Section
          id={`${anchor}-load`}
          title="How much training is enough"
          intro={extras.load.intro}
        >
          {extras.load.rows && (
            <DataTable
              columns={["Age", "Sessions a week"]}
              rows={extras.load.rows.map((r) => [
                r.age,
                `${r.sessions} · ${r.duration}`,
              ])}
            />
          )}
          {extras.load.practiceRatio && (
            <Callout
              tone="info"
              icon={<Dumbbell className="h-4 w-4" />}
              title="Practice to match ratio"
            >
              {extras.load.practiceRatio}
            </Callout>
          )}
          {extras.load.note && (
            <p className="text-sm leading-relaxed text-slate-600">{extras.load.note}</p>
          )}
        </Section>
      )}

      {extras.parentRole && (
        <Section
          id={`${anchor}-parent`}
          title="Your job on the day"
          intro="Parents have more influence on whether a child keeps playing than anyone except the coach."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {extras.parentRole.before?.length ? (
              <Panel title="Before practice" tone="good">
                <BulletList items={extras.parentRole.before} tone="good" />
              </Panel>
            ) : null}
            {extras.parentRole.during?.length ? (
              <Panel title="During practice" tone="info">
                <BulletList items={extras.parentRole.during} tone="info" />
              </Panel>
            ) : null}
            {extras.parentRole.after && (
              <Panel
                title="After practice"
                icon={<MessageSquare className="h-3.5 w-3.5" />}
              >
                <p className="mb-2 text-[13px] text-slate-500">
                  Instead of{" "}
                  <span className="font-bold text-slate-700">
                    &ldquo;{extras.parentRole.after.instead}&rdquo;
                  </span>{" "}
                  try:
                </p>
                <BulletList items={extras.parentRole.after.ask} numbered />
              </Panel>
            )}
          </div>
          {extras.parentRole.avoid?.length ? (
            <Panel title="What to avoid" tone="danger">
              <BulletList items={extras.parentRole.avoid} tone="danger" />
            </Panel>
          ) : null}
        </Section>
      )}

      {extras.injuries && (
        <Section
          id={`${anchor}-injuries`}
          title="Staying in one piece"
          intro={extras.injuries.intro}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="What tends to go wrong"
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              tone="danger"
            >
              <BulletList items={extras.injuries.common} tone="danger" />
            </Panel>
            <Panel title="What prevents it" tone="good">
              <BulletList items={extras.injuries.prevention} tone="good" />
            </Panel>
          </div>
          {extras.injuries.note && (
            <Callout
              tone="caution"
              icon={<TriangleAlert className="h-4 w-4" />}
              title="Persistent pain is not something to push through"
            >
              {extras.injuries.note}
            </Callout>
          )}
        </Section>
      )}

      {extras.body && (
        <Section
          id={`${anchor}-body`}
          title="Body and mind"
          intro="Fitness, food, rest — the parts that decide whether the training actually sticks."
        >
          {extras.body.fitness?.length ? (
            <Panel
              title="Fitness to build"
              icon={<Dumbbell className="h-3.5 w-3.5" />}
            >
              <DataTable
                columns={["Area", "How"]}
                rows={extras.body.fitness.map((f) => [f.area, f.how])}
              />
            </Panel>
          ) : null}

          {extras.body.nutrition?.length ? (
            <Panel title="Eating around training" icon={<Salad className="h-3.5 w-3.5" />}>
              <dl className="divide-y divide-slate-100">
                {extras.body.nutrition.map((n) => (
                  <div key={n.when} className="py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      {n.when}
                    </dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-slate-700">
                      {n.what}
                      {n.examples && (
                        <span className="mt-1 block text-[13px] font-medium text-slate-500">
                          {n.examples}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}

          {extras.body.recovery?.length ? (
            <Panel
              title="Recovery — the invisible training session"
              icon={<HeartPulse className="h-3.5 w-3.5" />}
              tone="info"
            >
              <BulletList items={extras.body.recovery} tone="info" />
            </Panel>
          ) : null}

          {extras.body.mind && (
            <Panel
              title="The mental side, trained like anything else"
              icon={<Brain className="h-3.5 w-3.5" />}
              tone="info"
            >
              {extras.body.mind.intro && (
                <p className="mb-3 text-sm leading-relaxed text-slate-700">
                  {extras.body.mind.intro}
                </p>
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    What it builds
                  </p>
                  <BulletList items={extras.body.mind.builds} tone="info" />
                </div>
                {extras.body.mind.whenToSeek?.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Worth doing when
                    </p>
                    <BulletList items={extras.body.mind.whenToSeek} tone="info" />
                  </div>
                ) : null}
              </div>
              {extras.body.mind.note && (
                <p className="mt-3 border-t border-sky-100 pt-3 text-[13px] leading-relaxed text-slate-600">
                  {extras.body.mind.note}
                </p>
              )}
            </Panel>
          )}

          {extras.body.supportTeam?.length ? (
            <Panel title="Who's around them by now" icon={<Users className="h-3.5 w-3.5" />}>
              <BulletList items={extras.body.supportTeam} />
            </Panel>
          ) : null}
        </Section>
      )}

      {extras.planning && (
        <Section
          id={`${anchor}-planning`}
          title="Planning the year"
          intro={extras.planning.intro}
        >
          {extras.planning.calendar && (
            <Panel
              title="A sample season"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            >
              <DataTable
                columns={["When", "Focus"]}
                rows={extras.planning.calendar.map((c) => [c.period, c.focus])}
              />
            </Panel>
          )}
          {extras.planning.travelKit?.length ? (
            <Panel title="Don't leave without" icon={<Backpack className="h-3.5 w-3.5" />}>
              <BulletList items={extras.planning.travelKit} />
            </Panel>
          ) : null}
        </Section>
      )}

      {extras.ranking && (
        <Section
          id={`${anchor}-ranking`}
          title="How the ranking actually works"
          intro="Worth understanding properly, because it is the number families most often misread."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="How points are earned" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              <BulletList items={extras.ranking.how} />
            </Panel>
            <Panel title="Why it matters" tone="good">
              <BulletList items={extras.ranking.matters} tone="good" />
            </Panel>
            <Panel title="What it does NOT measure" tone="danger">
              <BulletList items={extras.ranking.doesNotMeasure} tone="danger" />
            </Panel>
          </div>
        </Section>
      )}

      {(extras.mistakes?.length || extras.checklist?.length) && (
        <Section
          id={`${anchor}-review`}
          title="Getting this stage right"
          intro="The errors families actually make here, and what moving on well looks like."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {extras.mistakes?.length ? (
              <Panel
                title="Common mistakes"
                icon={<TriangleAlert className="h-3.5 w-3.5" />}
                tone="danger"
              >
                <BulletList items={extras.mistakes} tone="danger" />
              </Panel>
            ) : null}
            {extras.checklist?.length ? (
              <Panel
                title="Ready to move on when"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                tone="good"
              >
                <BulletList items={extras.checklist} tone="good" />
              </Panel>
            ) : null}
          </div>
        </Section>
      )}
    </>
  );
}

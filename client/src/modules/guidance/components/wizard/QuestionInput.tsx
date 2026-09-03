import { BinaryCards } from "@/modules/find-sport/components/inputs/BinaryCards";
import { FourContextCards } from "@/modules/find-sport/components/inputs/FourContextCards";
import { SportSearchInput } from "@/modules/find-sport/components/inputs/SportSearchInput";
import { StateSelector } from "@/modules/find-sport/components/inputs/StateSelector";
import { ThreeOptionCards } from "@/modules/find-sport/components/inputs/ThreeOptionCards";
import { TagAssistedTextarea } from "@/modules/guidance/components/shared/TagAssistedTextarea";
import {
  COMMON_WEAKNESS_ISSUES,
  ConsultForm,
  ProblemId,
} from "@/modules/guidance/config/wizard/guidanceUtils";
import { ConsultField } from "@/modules/guidance/config/wizard/wizardConfig";

/**
 * The per-question input renderer — extracted from
 * `app/(marketing)/guidance/page.tsx`. Pure config-driven switch, no
 * behavior changed.
 */
export function QuestionInput({
  id,
  form,
  set,
  problemId,
}: {
  id: ConsultField;
  form: ConsultForm;
  set: <K extends ConsultField>(k: K, v: ConsultForm[K]) => void;
  problemId: ProblemId;
}) {
  switch (id) {
    case "sport":
      return (
        <SportSearchInput
          value={form.sport}
          onChange={(v) => set("sport", v)}
          required={problemId !== "custom"}
        />
      );

    case "age":
      return (
        <input
          type="number"
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.age}
          onChange={(e) => set("age", e.target.value)}
          placeholder="e.g. 12"
          min={3}
          max={25}
          className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
        />
      );

    case "gender":
      return (
        <BinaryCards
          options={[
            { value: "MALE", title: "Boy", sub: "" },
            { value: "FEMALE", title: "Girl", sub: "" },
          ]}
          value={form.gender}
          onChange={(v) => set("gender", v)}
        />
      );

    case "state":
      return <StateSelector value={form.state} onChange={(v) => set("state", v)} />;

    case "experienceLevel":
      return (
        <ThreeOptionCards
          options={[
            {
              value: "beginner",
              label: "Beginner — city / neighbourhood level, just getting started",
            },
            {
              value: "intermediate",
              label: "Intermediate — school, club or district level, training regularly",
            },
            {
              value: "competitive",
              label: "Competitive — state or national level, serious competition",
            },
          ]}
          value={form.experienceLevel}
          onChange={(v) => set("experienceLevel", v)}
        />
      );

    case "weeklyHours":
      return (
        <FourContextCards
          options={[
            { value: "1-3", label: "1–3 hrs/week", context: "Casual — once or twice a week" },
            { value: "4-7", label: "4–7 hrs/week", context: "Regular — most days, short sessions" },
            { value: "8-12", label: "8–12 hrs/week", context: "Dedicated — structured schedule" },
            { value: "13-plus", label: "13+ hrs/week", context: "Full-time athlete commitment" },
          ]}
          value={form.weeklyHours}
          onChange={(v) => set("weeklyHours", v)}
        />
      );

    case "budgetRange":
      return (
        <FourContextCards
          options={[
            {
              value: "under-3k",
              label: "Under ₹3,000",
              context: "Minimal equipment, public grounds",
            },
            { value: "3k-7k", label: "₹3,000–7,000", context: "Academy fees, basic coaching" },
            { value: "7k-15k", label: "₹7,000–15,000", context: "Regular coaching + equipment" },
            {
              value: "15k-plus",
              label: "₹15,000+",
              context: "Premium coaching, tournaments, travel",
            },
          ]}
          value={form.budgetRange}
          onChange={(v) => set("budgetRange", v)}
        />
      );

    case "executor":
      return (
        <ThreeOptionCards
          options={[
            {
              value: "child",
              label: "The child on their own — self-practice, no adult guiding sessions",
            },
            { value: "parent", label: "Me (the parent) — I'll supervise, but I'm not a coach" },
            { value: "coach", label: "A coach or trainer — professional guidance is available" },
          ]}
          value={form.executor}
          onChange={(v) => set("executor", v)}
        />
      );

    case "weaknessArea":
      return (
        <FourContextCards
          options={[
            {
              value: "technique",
              label: "Technique problems",
              context: "Incorrect form, poor timing, faulty mechanics",
            },
            {
              value: "fitness",
              label: "Physical fitness",
              context: "Lacks strength, speed, stamina, or agility",
            },
            {
              value: "mental",
              label: "Mental focus",
              context: "Loses concentration, nerves, gives up under pressure",
            },
            {
              value: "tactical",
              label: "Tactical reading",
              context: "Doesn't read the game or make smart decisions",
            },
          ]}
          value={form.weaknessArea}
          onChange={(v) => set("weaknessArea", v)}
        />
      );

    case "weaknessDetail":
      return (
        <TagAssistedTextarea
          value={form.weaknessDetail}
          onChange={(v) => set("weaknessDetail", v)}
          options={COMMON_WEAKNESS_ISSUES[form.weaknessArea ?? ""] ?? []}
        />
      );

    case "weaknessDuration":
      return (
        <ThreeOptionCards
          options={[
            { value: "weeks", label: "Just a few weeks — it's recent" },
            { value: "months", label: "A few months — it's been consistent" },
            { value: "year-plus", label: "Over a year — it's a recurring problem" },
          ]}
          value={form.weaknessDuration}
          onChange={(v) => set("weaknessDuration", v)}
        />
      );

    case "timeline":
      return (
        <ThreeOptionCards
          options={[
            { value: "weeks", label: "2–4 weeks — very soon" },
            { value: "months-1-3", label: "1–3 months — enough time to build" },
            { value: "months-3-6", label: "3–6 months — good runway to peak" },
          ]}
          value={form.timeline}
          onChange={(v) => set("timeline", v)}
        />
      );

    case "tournamentGap":
      return (
        <FourContextCards
          options={[
            {
              value: "technique",
              label: "Technical consistency",
              context: "Technique breaks down under match pressure",
            },
            {
              value: "stamina",
              label: "Physical stamina",
              context: "Doesn't have the fitness for a full-day competition",
            },
            {
              value: "nerves",
              label: "Mental composure",
              context: "Nerves and pressure significantly affect performance",
            },
            {
              value: "matchplay",
              label: "Match experience",
              context: "Not enough competitive matches — struggles to read opponents and adapt",
            },
          ]}
          value={form.tournamentGap}
          onChange={(v) => set("tournamentGap", v)}
        />
      );

    case "currentLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "school", label: "School level — playing casually or for school" },
            { value: "club", label: "Club level — enrolled at an academy or local club" },
            {
              value: "district",
              label: "District / State — competing at district or state events",
            },
          ]}
          value={form.currentLevel}
          onChange={(v) => set("currentLevel", v)}
        />
      );

    case "targetLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "club", label: "Club / academy — get into a proper structured programme" },
            {
              value: "district",
              label: "District / State — compete at district or state tournaments",
            },
            { value: "national", label: "National — aim for national championships or selection" },
          ]}
          value={form.targetLevel}
          onChange={(v) => set("targetLevel", v)}
        />
      );

    case "levelBlocker":
      return (
        <FourContextCards
          options={[
            {
              value: "technique",
              label: "Technique gaps",
              context: "Fundamental skills not at the standard required for the next level",
            },
            {
              value: "fitness",
              label: "Physical conditioning",
              context: "Not fit or strong enough to compete at the next level",
            },
            {
              value: "mental",
              label: "Mental game",
              context: "Confidence, composure, or belief is holding them back",
            },
            {
              value: "competition",
              label: "Lack of exposure",
              context: "Not getting enough competitive match practice at the right level",
            },
          ]}
          value={form.levelBlocker}
          onChange={(v) => set("levelBlocker", v)}
        />
      );

    case "weaknessContext":
      return (
        <FourContextCards
          options={[
            {
              value: "training",
              label: "In training",
              context: "They know it's there — visible during practice",
            },
            {
              value: "matches",
              label: "In matches",
              context: "Game pressure causes the breakdown",
            },
            {
              value: "pressure",
              label: "Under scrutiny",
              context: "Performance drops when being watched or evaluated",
            },
            {
              value: "always",
              label: "Everywhere",
              context: "Consistent in all situations — deeply ingrained",
            },
          ]}
          value={form.weaknessContext}
          onChange={(v) => set("weaknessContext", v)}
        />
      );

    case "weaknessAttempts":
      return (
        <FourContextCards
          options={[
            {
              value: "nothing",
              label: "Nothing yet",
              context: "We've just identified the problem",
            },
            { value: "practice", label: "Extra practice", context: "Self-practice on their own" },
            {
              value: "video",
              label: "Video analysis",
              context: "Watching footage to self-correct",
            },
            {
              value: "coaching",
              label: "Tried coaching",
              context: "Worked with a coach but it hasn't stuck",
            },
          ]}
          value={form.weaknessAttempts}
          onChange={(v) => set("weaknessAttempts", v)}
        />
      );

    case "tournamentLevel":
      return (
        <FourContextCards
          options={[
            {
              value: "school",
              label: "School level",
              context: "Inter-school or intra-school competition",
            },
            {
              value: "district",
              label: "District level",
              context: "Competing against players across the district",
            },
            {
              value: "state",
              label: "State championship",
              context: "State-level tournament or selection trial",
            },
            {
              value: "national",
              label: "National level",
              context: "National championship or national selection",
            },
          ]}
          value={form.tournamentLevel}
          onChange={(v) => set("tournamentLevel", v)}
        />
      );

    case "physicalReadiness":
      return (
        <ThreeOptionCards
          options={[
            { value: "low", label: "Not match-ready — fitness is a concern, gets tired quickly" },
            {
              value: "moderate",
              label: "Reasonably fit — can compete but fades in the second half",
            },
            { value: "high", label: "Match-fit — conditioning is not an issue, ready to perform" },
          ]}
          value={form.physicalReadiness}
          onChange={(v) => set("physicalReadiness", v)}
        />
      );

    case "timeAtCurrentLevel":
      return (
        <ThreeOptionCards
          options={[
            { value: "new", label: "Under 6 months — still settling in at this level" },
            { value: "6-12m", label: "6–12 months — settled in but not progressing" },
            { value: "1y-plus", label: "Over a year — definitely plateaued, feels stuck" },
          ]}
          value={form.timeAtCurrentLevel}
          onChange={(v) => set("timeAtCurrentLevel", v)}
        />
      );

    case "trainingType":
      return (
        <FourContextCards
          options={[
            {
              value: "self",
              label: "Self-practice",
              context: "On their own at home or with friends — no coaching",
            },
            {
              value: "club",
              label: "Club or school",
              context: "Group sessions at a local club or school programme",
            },
            {
              value: "academy",
              label: "Formal academy",
              context: "Enrolled at an academy with structured training",
            },
            {
              value: "private",
              label: "Private coaching",
              context: "One-on-one or semi-private coaching sessions",
            },
          ]}
          value={form.trainingType}
          onChange={(v) => set("trainingType", v)}
        />
      );

    case "topStrength":
      return (
        <FourContextCards
          options={[
            {
              value: "technique",
              label: "Technical skills",
              context: "Clean execution, good form, strong fundamentals",
            },
            {
              value: "tactical",
              label: "Game intelligence",
              context: "Reads play well, makes smart decisions",
            },
            {
              value: "physical",
              label: "Physical athleticism",
              context: "Speed, strength, or stamina stands out",
            },
            {
              value: "mental",
              label: "Mental strength",
              context: "Composure, focus, and resilience under pressure",
            },
          ]}
          value={form.topStrength}
          onChange={(v) => set("topStrength", v)}
        />
      );

    case "challengeCategory":
      return (
        <FourContextCards
          options={[
            {
              value: "motivation",
              label: "Motivation / confidence",
              context: "Mental blocks, fear of failure, loss of drive",
            },
            {
              value: "injury",
              label: "Injury or recovery",
              context: "Physical health concern, rehab, return to sport",
            },
            {
              value: "coaching",
              label: "Coaching or setup",
              context: "Coach selection, training programme, or structure",
            },
            {
              value: "nutrition",
              label: "Nutrition or burnout",
              context: "Diet, body development, overtraining, balance",
            },
          ]}
          value={form.challengeCategory}
          onChange={(v) => set("challengeCategory", v)}
        />
      );

    case "desiredOutcome":
      return (
        <FourContextCards
          options={[
            {
              value: "plan",
              label: "Step-by-step plan",
              context: "A concrete action plan to follow immediately",
            },
            {
              value: "advice",
              label: "Expert perspective",
              context: "Guidance and insight from a sports expert viewpoint",
            },
            {
              value: "resources",
              label: "Resources to find",
              context: "Specific programmes, coaches, or tools to seek out",
            },
            {
              value: "opinion",
              label: "Second opinion",
              context: "A fresh look at what we're currently doing",
            },
          ]}
          value={form.desiredOutcome}
          onChange={(v) => set("desiredOutcome", v)}
        />
      );

    case "challenge":
      return (
        <textarea
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          value={form.challenge}
          onChange={(e) => set("challenge", e.target.value)}
          placeholder="e.g. My son has been struggling with motivation after a string of losses. He loves cricket but keeps saying he wants to quit. How do we help him get his confidence back?"
          rows={5}
          className="focus:border-power-orange focus:ring-power-orange/20 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
        />
      );

    default:
      return null;
  }
}

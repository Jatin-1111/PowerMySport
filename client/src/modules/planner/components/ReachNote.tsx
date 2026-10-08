import type { ReachVerdict } from "@powermysport/shared-types";
import { CircleCheck, CircleDashed, CircleMinus, Info } from "lucide-react";

/**
 * What past events showed about whether this child's rank would have got in.
 *
 * The words are the server's (`judgeReach`), written from the draws of finished events of
 * the same level, age group and gender, and they always say they describe past events.
 * This only chooses how much of that to show where.
 *
 *   - beside an event in a list: one short phrase, and nothing at all when there is no
 *     history, because "we know nothing" on every card is noise
 *   - in an event's details: the whole sentence, including "we hold no past events"
 *
 * It never uses a verdict as a promise: even "likely" reads as what past draws did.
 */

const SHORT: Record<
  Exclude<ReachVerdict["kind"], "no-evidence">,
  { label: string; tone: string; Icon: typeof CircleCheck }
> = {
  likely: { label: "Past draws took this rank", tone: "text-emerald-800", Icon: CircleCheck },
  qualifying: {
    label: "Past draws mostly meant the qualifying",
    tone: "text-amber-800",
    Icon: CircleDashed,
  },
  unlikely: {
    label: "Past draws closed above this rank",
    tone: "text-slate-700",
    Icon: CircleMinus,
  },
};

export function ReachNote({
  verdict,
  detail = false,
}: {
  verdict: ReachVerdict | undefined;
  /** The whole sentence, with a heading, for an event's details. */
  detail?: boolean;
}) {
  if (!verdict) return null;

  if (verdict.kind === "no-evidence") {
    if (!detail) return null;
    return (
      <p className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {verdict.text}
      </p>
    );
  }

  const { label, tone, Icon } = SHORT[verdict.kind];
  if (!detail) {
    return (
      <p className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
    );
  }

  return (
    <div>
      <p className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{verdict.text}</p>
    </div>
  );
}

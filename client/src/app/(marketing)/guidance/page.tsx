"use client";

import { isProblemId } from "@/modules/guidance/config/wizard/wizardConfig";
import { ProblemPicker } from "@/modules/guidance/components/wizard/ProblemPicker";
import { ProblemWizardInner } from "@/modules/guidance/components/wizard/ProblemWizardInner";
import type { ProblemId } from "@/modules/guidance/config/wizard/guidanceUtils";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const noop = () => {};

export default function GuidancePage() {
  // useSearchParams needs a Suspense boundary; the whole flow lives inside it.
  // On a statically prerendered page that boundary's fallback IS the server
  // HTML, so a `null` fallback shipped /guidance with no H1 and no content to
  // crawlers that do not run JavaScript. The picker is the page's real landing
  // state, so render it as the fallback: its buttons are inert until hydration,
  // when GuidanceRoot takes over (and swaps in the wizard for ?problem= links).
  return (
    <Suspense fallback={<ProblemPicker onSelect={noop} />}>
      <GuidanceRoot />
    </Suspense>
  );
}

function GuidanceRoot() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The selected problem lives in the URL (?problem=), so it survives a refresh
  // and is shareable — it used to be component state that reset on reload.
  //
  // A /roadmap level CTA (?mode=level-plan) always maps to "levelup" and skips
  // the picker: the parent already told us what they want by clicking a
  // specific pathway level, so don't ask them again.
  const isLevelPlan = searchParams.get("mode") === "level-plan";
  const problemParam = searchParams.get("problem");
  const problemType: ProblemId | null = isLevelPlan
    ? "levelup"
    : isProblemId(problemParam)
      ? problemParam
      : null;

  const setProblem = (id: ProblemId | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("problem", id);
    } else {
      // Leaving the wizard clears the step too, so returning to a problem
      // starts clean rather than resuming a half-filled form.
      params.delete("problem");
      params.delete("step");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (problemType) {
    return <ProblemWizardInner problemId={problemType} onBack={() => setProblem(null)} />;
  }
  return <ProblemPicker onSelect={setProblem} />;
}

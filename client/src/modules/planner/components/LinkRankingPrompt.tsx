"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import LinkRankingModal from "@/modules/player/components/LinkRankingModal";
import { Button } from "@/modules/shared/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useState } from "react";

/**
 * What a parent sees when their child has no ranking linked yet.
 *
 * ── Why the planner asks for it rather than guessing ────────────────────────
 * Which events a child may enter turns on two facts, their age list and their
 * rank, and both come from the federation's published list. Without a link there
 * is nothing to judge against, and a list judged against an invented rank would
 * tell a parent an event is open that the entry desk will refuse.
 *
 * The link is made here, in place, with the same verified form the profile page
 * uses, so a parent does not leave the planner to set up what the planner needs.
 */
export function LinkRankingPrompt({
  dependentId,
  dependentName,
}: {
  dependentId: string;
  dependentName: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <div>
            <h2 className="font-title text-lg font-extrabold text-slate-900">
              Link {dependentName}&apos;s AITA ranking
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              The planner shows which tournaments {dependentName} can enter, and the entry rules
              depend on their age group and their rank. Linking their ranking gives it both. You
              confirm it with their date of birth, which is checked and not stored.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              Link a ranking
            </Button>
          </div>
        </div>
      </div>

      <LinkRankingModal
        isOpen={open}
        onClose={() => setOpen(false)}
        dependentId={dependentId}
        dependentName={dependentName}
        onLinked={() => {
          // Both caches: the account's links (the profile page reads these) and
          // this child's planner, which was "not linked" a moment ago.
          void queryClient.invalidateQueries({ queryKey: queryKeys.rankingClaims.all });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.planner.forDependent(dependentId),
          });
          toast.success("Ranking linked.");
        }}
      />
    </>
  );
}

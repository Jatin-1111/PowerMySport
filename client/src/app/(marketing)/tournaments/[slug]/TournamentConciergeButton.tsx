"use client";

import { PathwayConciergeModal } from "@/modules/sports/components/PathwayConciergeModal";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConciergeTournamentItem {
  _id: string;
  name: string;
  level: string;
  ageGroup?: string;
  sportName: string;
  prerequisiteName?: string;
  documentChecklist: string[];
  prerequisiteGuide?: string[];
}

export function TournamentConciergeButton({
  item,
  buttonClassName,
}: {
  item: ConciergeTournamentItem;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
        }
      >
        <Sparkles className="h-4 w-4 text-amber-300" />
        Get Free Concierge Help
      </button>
      {mounted &&
        createPortal(
          <PathwayConciergeModal
            isOpen={open}
            onClose={() => setOpen(false)}
            item={item}
            type="tournament"
          />,
          document.body,
        )}
    </>
  );
}

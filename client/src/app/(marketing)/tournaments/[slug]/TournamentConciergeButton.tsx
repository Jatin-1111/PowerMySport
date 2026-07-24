"use client";

import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

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
  const message = `Hi! I'd like help registering for ${item.name} (${item.sportName}) that I found on PowerMySport.${
    item.prerequisiteName ? ` I understand it needs a ${item.prerequisiteName}.` : ""
  }`;

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        buttonClassName ??
        "flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
      }
    >
      <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
      Get Free Help via WhatsApp
    </a>
  );
}

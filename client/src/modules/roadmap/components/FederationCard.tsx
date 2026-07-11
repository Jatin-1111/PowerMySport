"use client";

import { ArrowRight, BadgeCheck, ExternalLink, MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import type { Federation } from "@/modules/sports/services/pathway";

interface FederationCardProps {
  federation: Federation;
}

const TYPE_META = {
  govt: { label: "Government Body", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  national: { label: "National Federation", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  hybrid: { label: "Public-Private Body", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
} as const;

export function FederationCard({ federation }: FederationCardProps) {
  const typeMeta = TYPE_META[federation.type];
  const initials = federation.acronym.slice(0, 2);
  const isVerified = !!federation.dataVerifiedAt;

  return (
    <div className="group relative flex flex-col h-full rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:border-orange-200 hover:-translate-y-0.5">
      {/* Accent bar */}
      <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />

      <div className="flex flex-col flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Monogram */}
          <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-base font-black text-white tracking-tight select-none">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}>
                {typeMeta.label}
              </span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <BadgeCheck className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>
            <h3 className="font-title font-bold text-slate-900 text-base leading-tight">
              {federation.acronym}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug truncate">
              {federation.name}
            </p>
          </div>
        </div>

        {/* About snippet */}
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-4">
          {federation.about}
        </p>

        {/* Stats strip — each item on its own row to avoid long HQ text overflow */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs text-slate-500">
          {federation.founded && (
            <span className="shrink-0">Est. {federation.founded}</span>
          )}
          {federation.headquarters && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate max-w-[200px]">{federation.headquarters}</span>
            </span>
          )}
        </div>

        {/* Actions — pinned to bottom */}
        <div className="mt-auto flex items-center gap-2 pt-3 border-t border-slate-100">
          <Link
            href={`/federations/${federation.slug}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-power-orange px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-sm shadow-orange-200"
          >
            View Federation
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/federations/${federation.slug}?tab=tournaments`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            <Trophy className="h-3.5 w-3.5" />
            Tournaments
          </Link>
          {federation.website && (
            <a
              href={federation.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Official website"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

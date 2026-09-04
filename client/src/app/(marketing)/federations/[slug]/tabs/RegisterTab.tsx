import { BadgeCheck, CheckCircle2, ExternalLink, FileText, Sparkles } from "lucide-react";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { FederationDetail } from "../page";
import { SectionHeading } from "../federationShared";

export function RegisterTab({ fed, sportLabel }: { fed: FederationDetail; sportLabel: string }) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        {/* Steps */}
        {fed.registrationSteps && fed.registrationSteps.length > 0 ? (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <SectionHeading>Step-by-Step Registration</SectionHeading>
            <p className="mb-8 text-sm text-slate-400">
              Follow these steps in order. Starting early gives your child a significant advantage —
              many spots fill fast.
            </p>
            <ol className="space-y-6">
              {fed.registrationSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-5">
                  <span className="bg-power-orange/10 border-power-orange/20 text-power-orange flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="flex-1 pt-1 text-[15px] leading-relaxed text-slate-700">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            Registration steps not yet available for this federation.
          </div>
        )}

        {/* Required documents */}
        {fed.requiredDocuments && fed.requiredDocuments.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <SectionHeading>Required Documents</SectionHeading>
            <p className="mb-6 text-sm text-slate-400">
              Prepare these before the tournament entry deadline — missing documents result in
              rejection.
            </p>
            <ul className="space-y-3">
              {fed.requiredDocuments.map((doc, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300">
                    <FileText className="h-3 w-3 text-slate-400" />
                  </div>
                  <span className="text-[14px] leading-snug text-slate-700">{doc}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Sidebar — Concierge */}
      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6">
          <div className="bg-power-orange/[0.12] pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl" />
          <div className="bg-power-orange/[0.07] pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-1.5">
              <Sparkles className="text-power-orange h-3.5 w-3.5" />
              <p className="text-power-orange text-[10px] font-bold uppercase tracking-[0.13em]">
                PowerMySport Concierge
              </p>
            </div>
            <h3 className="font-title mb-2 text-[17px] font-bold leading-snug text-white">
              We handle registration for you
            </h3>
            <p className="mb-5 text-[13px] leading-relaxed text-white/50">
              Federation IDs, documents, form submissions — our team takes care of all of it. At no
              cost.
            </p>
            <ul className="mb-5 space-y-2">
              {[
                `Get your child's ${fed.acronym} number`,
                "Prepare and submit all required documents",
                "Monitor deadlines and confirm your entry",
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-[12px] text-white/60">{line}</span>
                </li>
              ))}
            </ul>
            <a
              href={buildWhatsAppUrl(
                `Hi! I'd like help with ${fed.acronym} registration for ${sportLabel} — found via PowerMySport.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-power-orange flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/30 transition hover:bg-orange-500"
            >
              <WhatsAppIcon className="h-4 w-4 text-white" />
              Get Help via WhatsApp
            </a>
            {fed.website && (
              <a
                href={fed.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white/35 transition hover:text-white/65"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Official {fed.acronym} Portal
              </a>
            )}
          </div>
        </div>

        {/* Quick facts */}
        {fed.eligibilityCriteria && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Quick reference
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="leading-snug text-slate-600">
                  {fed.eligibilityCriteria.registrationRequired
                    ? `${fed.acronym} registration is mandatory`
                    : `${fed.acronym} registration not required for all events`}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="leading-snug text-slate-600">
                  {fed.eligibilityCriteria.stateAssociationFirst
                    ? "Register with your State Association first"
                    : "Direct national federation registration available"}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

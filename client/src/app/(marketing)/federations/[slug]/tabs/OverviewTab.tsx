import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { FederationDetail } from "../page";
import { SectionHeading, TABS, type TabId } from "../federationShared";

export function OverviewTab({
  fed,
  sportLabel,
  isVerified,
  activeTab,
  switchTab,
}: {
  fed: FederationDetail;
  sportLabel: string;
  isVerified: boolean;
  activeTab: TabId;
  switchTab: (tab: TabId) => void;
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        {/* About */}
        <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
          <SectionHeading>About {fed.acronym}</SectionHeading>
          <p className="text-[15px] leading-[1.85] text-slate-600">{fed.about}</p>
        </section>

        {/* Key Facts */}
        {fed.keyFacts && fed.keyFacts.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <SectionHeading>Key Facts</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              {fed.keyFacts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-snug text-slate-700">{fact}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Affiliations */}
        {fed.affiliations && fed.affiliations.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <SectionHeading>International Affiliations</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {fed.affiliations.map((aff, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700"
                >
                  {aff}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* State Associations */}
        {fed.stateAssociations && fed.stateAssociations.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
            <SectionHeading>State Associations</SectionHeading>
            <p className="mb-5 text-sm text-slate-500">
              Your child must register with the state association for your state before
              participating in national events.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {fed.stateAssociations.map((sa, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold leading-tight text-slate-800">{sa.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{sa.state}</p>
                  </div>
                  {sa.website && (
                    <a
                      href={sa.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-power-orange shrink-0 text-slate-400 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Data source notice */}
        {isVerified && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Data verified by PowerMySport
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-emerald-700">
                This federation profile was manually cross-checked against official sources on{" "}
                {new Date(fed.dataVerifiedAt!).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
                {fed.sourceUrls?.[0] && (
                  <>
                    {" "}
                    Primary source:{" "}
                    <a
                      href={fed.sourceUrls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                    >
                      {new URL(fed.sourceUrls[0]).hostname}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-20">
        {/* Quick nav */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            In this guide
          </p>
          <div className="space-y-1.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeTab === id
                    ? "text-power-orange bg-orange-50"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-40" />
              </button>
            ))}
          </div>
        </div>

        {/* Contact */}
        {(fed.contact?.email || fed.contact?.phone || fed.contact?.address) && (
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
              Contact
            </p>
            {fed.contact.email && (
              <a
                href={`mailto:${fed.contact.email}`}
                className="hover:text-power-orange flex items-start gap-2.5 text-sm text-slate-600 transition"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {fed.contact.email}
              </a>
            )}
            {fed.contact.phone && (
              <div className="flex items-center gap-2.5 text-sm text-slate-600">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                {fed.contact.phone}
              </div>
            )}
            {fed.contact.address && (
              <div className="flex items-start gap-2.5 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="leading-snug">{fed.contact.address}</span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5">
          <div className="bg-power-orange/[0.12] pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="text-power-orange h-3.5 w-3.5" />
              <p className="text-power-orange text-[10px] font-bold uppercase tracking-[0.13em]">
                Concierge
              </p>
            </div>
            <p className="mb-1.5 text-[15px] font-bold leading-snug text-white">
              We handle registration for you
            </p>
            <p className="mb-4 text-xs leading-relaxed text-white/45">
              Federation IDs, documents, form submissions — our team takes care of everything at no
              cost.
            </p>
            <a
              href={buildWhatsAppUrl(
                `Hi! I'd like help with ${fed.acronym} registration for ${sportLabel} — found via PowerMySport.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-power-orange flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition hover:bg-orange-500"
            >
              <WhatsAppIcon className="h-4 w-4 text-white" />
              Get Help via WhatsApp
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}

import { Button } from "@/modules/shared/ui/Button";
import { BookOpen, Building2, Globe2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Academy Dashboard - PowerMySport",
  description:
    "Manage your academy onboarding and public presence on PowerMySport",
};

const quickLinks = [
  {
    href: "/academy/onboarding",
    label: "Start onboarding",
    icon: BookOpen,
    description: "Set up your academy profile directly on the platform.",
  },
  {
    href: "/academies",
    label: "View public profile",
    icon: Globe2,
    description: "See how your academy appears to players and parents.",
  },
  {
    href: "/academy/settings",
    label: "Manage settings",
    icon: ShieldCheck,
    description: "Update owner details, verification, and account settings.",
  },
];

export default function AcademyDashboardPage() {
  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#fff4e5_100%)] px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            <Building2 size={14} /> Academy Owner
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Manage your academy from one place.
          </h1>
          <p className="max-w-2xl text-sm text-white/80 sm:text-base">
            Complete onboarding, track approval, and keep your academy profile
            ready for players, parents, and coaches.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/academy/onboarding">
              <Button className="bg-white text-slate-900 hover:bg-slate-100">
                Start onboarding
              </Button>
            </Link>
            <Link href="/academies">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Open public profile
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-white/70 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-3 text-slate-900 transition-colors group-hover:bg-power-orange group-hover:text-white">
                  <Icon size={18} />
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  {item.label}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

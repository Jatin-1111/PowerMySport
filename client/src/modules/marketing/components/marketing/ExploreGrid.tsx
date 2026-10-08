import {
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  GraduationCap,
  Map,
  Trophy,
  UserCheck,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { SectionLabel } from "./SectionLabel";

const AREAS = [
  {
    icon: Map,
    title: "Sports Pathways",
    body: "See the stages of a sport, what each one asks of a child and what comes next.",
    href: "/roadmap",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    body: "Find tournaments and check entry dates for your child's sport.",
    href: "/tournaments",
  },
  {
    icon: BarChart3,
    title: "Rankings",
    body: "See how federation rankings work and where your child stands.",
    href: "/rankings",
  },
  {
    icon: CalendarDays,
    title: "Season Planner",
    body: "Plan a season around your child's calendar, budget and travel.",
    href: "/planner",
  },
  {
    icon: GraduationCap,
    title: "Admissions",
    body: "Understand the school and college admission routes that sport can open up.",
    href: "/admissions",
  },
  {
    icon: Award,
    title: "Scholarships",
    body: "Find scholarships for young athletes and what each one asks for.",
    href: "/scholarships",
  },
  {
    icon: UserCheck,
    title: "Experts",
    body: "Talk to a sports expert about your child's development.",
    href: "/booking",
  },
  {
    icon: Users2,
    title: "Community",
    body: "Learn from other parents, ask questions and share what you have seen.",
    href: "/community",
  },
] as const;

/** One card per area of the site, so the home page shows everything PMS covers. */
export function ExploreGrid() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <SectionLabel label="Explore" color="orange" />
          </div>
          <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Whatever your child needs next
          </h2>
          <p className="text-lg text-slate-600">
            Tools, information and people across the sporting ecosystem.
          </p>
        </div>

        <ul className="reveal-on-scroll mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((area) => (
            <li key={area.title}>
              <Link
                href={area.href}
                className="focus-visible:ring-power-orange-solid group flex h-full flex-col rounded-lg border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2"
              >
                <span className="text-power-orange-solid mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-orange-50 ring-1 ring-orange-200/60">
                  <area.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mb-1 font-bold text-slate-900">{area.title}</h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-600">{area.body}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  Explore
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

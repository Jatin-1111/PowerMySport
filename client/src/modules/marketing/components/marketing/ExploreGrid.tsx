import {
  ArrowUpRight,
  CalendarBlank,
  ChartBar,
  GraduationCap,
  MapTrifold,
  Medal,
  Trophy,
  UserCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Bezel } from "./Bezel";
import { HomeEyebrow } from "./HomeEyebrow";

// 7/5 then 5/7 alternation on `lg`; every span resets to one column below it.
const AREAS = [
  {
    icon: MapTrifold,
    title: "Sports Pathways",
    body: "See the stages of a sport, what each one asks of a child and what comes next.",
    href: "/roadmap",
    span: "lg:col-span-7",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    body: "Find tournaments and check entry dates for your child's sport.",
    href: "/tournaments",
    span: "lg:col-span-5",
  },
  {
    icon: ChartBar,
    title: "Rankings",
    body: "See how federation rankings work and where your child stands.",
    href: "/rankings",
    span: "lg:col-span-5",
  },
  {
    icon: CalendarBlank,
    title: "Season Planner",
    body: "Plan a season around your child's calendar, budget and travel.",
    href: "/planner",
    span: "lg:col-span-7",
  },
  {
    icon: GraduationCap,
    title: "Admissions",
    body: "Understand the school and college admission routes that sport can open up.",
    href: "/admissions",
    span: "lg:col-span-7",
  },
  {
    icon: Medal,
    title: "Scholarships",
    body: "Find scholarships for young athletes and what each one asks for.",
    href: "/scholarships",
    span: "lg:col-span-5",
  },
  {
    icon: UserCheck,
    title: "Experts",
    body: "Talk to a sports expert about your child's development.",
    href: "/booking",
    span: "lg:col-span-5",
  },
  {
    icon: UsersThree,
    title: "Community",
    body: "Learn from other parents, ask questions and share what you have seen.",
    href: "/community",
    span: "lg:col-span-7",
  },
] as const;

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

/** One card per area of the site, as an asymmetric bento of double-bezel cards. */
export function ExploreGrid() {
  return (
    <section className="bg-slate-50 py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <HomeEyebrow label="Explore" tone="yellow" className="mb-6" />
          <h2 className="font-title mb-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl lg:text-6xl">
            Whatever your child needs next
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Tools, information and people across the sporting ecosystem.
          </p>
        </div>

        <ul className="reveal-on-scroll mt-20 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {AREAS.map((area) => (
            <li key={area.title} className={area.span}>
              <Link
                href={area.href}
                className="focus-visible:ring-power-orange-solid group block h-full rounded-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Bezel
                  className={`h-full transition-transform duration-700 ${EASE} group-hover:-translate-y-1`}
                  innerClassName={`flex min-h-[240px] flex-col p-8 transition-shadow duration-700 ${EASE} group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_32px_56px_-28px_rgba(15,23,42,0.18)] sm:p-10`}
                >
                  <div className="mb-auto flex items-start justify-between">
                    <span className="text-power-orange-solid flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 ring-1 ring-orange-200/60">
                      <area.icon weight="light" className="h-6 w-6" aria-hidden />
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/[0.04] transition-transform duration-700 ${EASE} group-hover:scale-105`}
                    >
                      <ArrowUpRight
                        weight="light"
                        className={`h-4 w-4 text-slate-600 transition-transform duration-700 ${EASE} group-hover:-translate-y-px group-hover:translate-x-0.5 motion-reduce:transition-none`}
                      />
                    </span>
                  </div>
                  <h3 className="font-title mb-2 mt-12 text-2xl font-semibold tracking-[-0.02em] text-slate-900">
                    {area.title}
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-slate-600">{area.body}</p>
                </Bezel>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

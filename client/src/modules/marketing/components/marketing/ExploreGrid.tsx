import {
  ArrowUpRight,
  Award,
  BarChart3,
  CalendarDays,
  GraduationCap,
  Map,
  Trophy,
  UserCheck,
  Users2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?fm=jpg&q=70&w=1000&auto=format&fit=crop`;

// 4-column grid on `lg`; Pathways leads as a two-by-two tile. Below `lg` the
// spans reset to one or two columns. Each photo is chosen for its subject, and
// `position` keeps that subject inside the crop.
const AREAS = [
  {
    icon: Map,
    title: "Sports Pathways",
    body: "See the stages of a sport, what each one asks of a child and what comes next.",
    href: "/roadmap",
    cell: "sm:col-span-2 lg:row-span-2",
    featured: true,
    // Track lanes: one lane per stage.
    image: unsplash("1549896869-ca27eeffe4fb"),
    position: "object-center",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    body: "Find tournaments and check entry dates for your child's sport.",
    href: "/tournaments",
    cell: "",
    image: unsplash("1643236943728-2745b38cbcf7"),
    position: "object-center",
  },
  {
    icon: BarChart3,
    title: "Rankings",
    body: "See how federation rankings work and where your child stands.",
    href: "/rankings",
    cell: "",
    image: unsplash("1757365225211-1515ecc8a109"),
    position: "object-center",
  },
  {
    icon: CalendarDays,
    title: "Season Planner",
    body: "Plan a season around your child's calendar, budget and travel.",
    href: "/planner",
    cell: "",
    image: unsplash("1513128034602-7814ccaddd4e"),
    position: "object-center",
  },
  {
    icon: GraduationCap,
    title: "Admissions",
    body: "Understand the school and college admission routes that sport can open up.",
    href: "/admissions",
    cell: "",
    image: unsplash("1776982298331-ca6e61e0da40"),
    position: "object-center",
  },
  {
    icon: Award,
    title: "Scholarships",
    body: "Find scholarships for young athletes and what each one asks for.",
    href: "/scholarships",
    cell: "",
    image: unsplash("1757875749961-9b52ef1299bb"),
    position: "object-center",
  },
  {
    icon: UserCheck,
    title: "Experts",
    body: "Talk to a sports expert about your child's development.",
    href: "/booking",
    cell: "",
    image: unsplash("1508802244473-e256cb053485"),
    position: "object-center",
  },
  {
    icon: Users2,
    title: "Community",
    body: "Learn from other parents, ask questions and share what you have seen.",
    href: "/community",
    cell: "sm:col-span-2",
    image: unsplash("1590962719070-0457bebed60c"),
    position: "object-[50%_30%]",
  },
] as const;

/**
 * One photographic tile per area of the site. The photo fills the tile, pulled
 * toward the page's warm palette, and a warm-ink fade from the bottom keeps the
 * white text readable on any of them. The photos are decorative (the title and
 * description say what the tile is), so they carry empty alt text.
 */
export function ExploreGrid() {
  return (
    <section className="bg-paper py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="Explore" />
          <h2 className={`${SECTION_HEADING} mb-6`}>Whatever your child needs next</h2>
          <p className={SECTION_LEAD}>
            Tools, information and people across the sporting ecosystem.
          </p>
        </div>

        <ul className="reveal-on-scroll mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {AREAS.map((area) => {
            const featured = "featured" in area && area.featured;
            return (
              <li key={area.title} className={area.cell}>
                <Link
                  href={area.href}
                  className="bg-ink focus-visible:ring-ink focus-visible:ring-offset-paper group relative isolate flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl p-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:p-8"
                >
                  <Image
                    src={area.image}
                    alt=""
                    fill
                    sizes={
                      featured
                        ? "(min-width: 1024px) 50vw, 100vw"
                        : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    }
                    className={`-z-20 object-cover ${area.position} saturate-[0.65] transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none`}
                  />
                  {/* Warm-ink fade: heavy where the text sits, light at the top. */}
                  <div
                    aria-hidden
                    className="from-ink/92 via-ink/60 to-ink/15 absolute inset-0 -z-10 bg-gradient-to-t"
                  />

                  <div className="mb-auto flex items-start justify-between">
                    <area.icon className="h-7 w-7 text-white" strokeWidth={1.5} aria-hidden />
                    <ArrowUpRight
                      aria-hidden
                      strokeWidth={1.5}
                      className="h-5 w-5 text-white/80 transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white motion-reduce:transition-none"
                    />
                  </div>
                  <h3
                    className={`font-editorial mb-2 mt-14 font-normal text-white ${
                      featured ? "text-4xl" : "text-2xl"
                    }`}
                  >
                    {area.title}
                  </h3>
                  <p className="max-w-[40ch] text-pretty text-[0.95rem] leading-relaxed text-white/85">
                    {area.body}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

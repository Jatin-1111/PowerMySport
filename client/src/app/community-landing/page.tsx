import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Crown,
  HeartHandshake,
  MessageSquareQuote,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

type ValueProp = {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
};

type CommunityPost = {
  title: string;
  category: string;
  excerpt: string;
  author: string;
  metadata: string;
  tone: "neutral" | "positive" | "warm";
};

type CoachCard = {
  name: string;
  sport: string;
  rating: string;
  location: string;
  badges: string[];
  specialties: string[];
  imageSeed: string;
};

const valueProps: ValueProp[] = [
  {
    title: "Vetted Coaches",
    description:
      "Explore coaches with safety checks, parent reviews, and youth-first training experience.",
    icon: ShieldCheck,
  },
  {
    title: "Hassle-free Venues",
    description:
      "Book reliable courts, fields, and training spaces without juggling fragmented listings.",
    icon: HeartHandshake,
  },
  {
    title: "AI-Powered Mapping",
    description:
      "Get a guided path from your child’s goals to the right sport, coach, and nearby venue.",
    icon: BrainCircuit,
  },
];

const communityPosts: CommunityPost[] = [
  {
    title: "Best tennis academies for beginners?",
    category: "Trending local discussion",
    excerpt:
      "Parents are comparing beginner-friendly coaching styles, court access, and whether weekly private sessions are worth it.",
    author: "Priya M. · Parent moderator",
    metadata: "42 replies · 18 min ago",
    tone: "positive",
  },
  {
    title: "How early should kids start strength work?",
    category: "Coach Q&A",
    excerpt:
      "A top-rated coach explains age-appropriate coordination drills, rest balance, and why movement quality matters more than volume.",
    author: "Coach Daniel R. · Verified Safety Check",
    metadata: "Featured answer · 1 hr ago",
    tone: "warm",
  },
  {
    title: "Weekend football camps near Southside",
    category: "Nearby recommendations",
    excerpt:
      "Families are swapping camps that fit school schedules, budget tiers, and sibling-friendly drop-off times.",
    author: "Community thread",
    metadata: "29 saves · Updated today",
    tone: "neutral",
  },
];

const marketplaceCoaches: CoachCard[] = [
  {
    name: "Aarav Mehta",
    sport: "Tennis",
    rating: "4.9",
    location: "3.2 km away",
    badges: ["Verified Safety Check", "Top Parent Pick"],
    specialties: ["Beginners", "Footwork", "Confidence Building"],
    imageSeed: "tennis-coach-aarav",
  },
  {
    name: "Sana Kapoor",
    sport: "Football",
    rating: "4.8",
    location: "4.6 km away",
    badges: ["Background Verified", "Fast Booking"],
    specialties: ["Girls Teams", "Youth Fitness", "Match Awareness"],
    imageSeed: "football-coach-sana",
  },
  {
    name: "Vikram Singh",
    sport: "Basketball",
    rating: "5.0",
    location: "2.1 km away",
    badges: ["Elite Coach", "Parent Approved"],
    specialties: ["Ball Handling", "Confidence", "Small Group Sessions"],
    imageSeed: "basketball-coach-vikram",
  },
  {
    name: "Nina Fernandez",
    sport: "Swimming",
    rating: "4.9",
    location: "6.0 km away",
    badges: ["Safety First", "Weekend Slots"],
    specialties: ["Beginners", "Technique", "Comfort in Water"],
    imageSeed: "swim-coach-nina",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-power-orange">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}

function HeroSearchBar() {
  return (
    <form
      action="/coaches"
      method="get"
      className="grid gap-3 rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-900/5 backdrop-blur sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <label className="relative block">
        <span className="sr-only">Find local coaches or venues</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          placeholder="Find local coaches or venues"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:ring-4 focus:ring-power-orange/10"
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#E97316,#F59E0B)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_-22px_rgba(233,115,22,0.85)] transition hover:opacity-95"
      >
        Search <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function ValuePropCard({ title, description, icon: Icon }: ValueProp) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(233,115,22,0.14),rgba(245,158,11,0.16))] text-power-orange">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function CommunityPostCard({ post }: { post: CommunityPost }) {
  const toneStyles = {
    neutral: "bg-slate-100 text-slate-600",
    positive: "bg-emerald-100 text-emerald-700",
    warm: "bg-amber-100 text-amber-700",
  }[post.tone];

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneStyles}`}
        >
          {post.category}
        </span>
        <MessageSquareQuote className="mt-0.5 h-4 w-4 text-slate-300" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
        {post.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>{post.author}</span>
        <span>{post.metadata}</span>
      </div>
    </article>
  );
}

function FeaturedQACard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-power-orange/20 bg-[linear-gradient(135deg,rgba(233,115,22,0.08),rgba(255,255,255,0.98))] p-5 shadow-sm shadow-slate-900/5">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-power-orange/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-power-orange/10 px-2.5 py-1 text-[11px] font-semibold text-power-orange">
            Featured Parent Q&A
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Answered by top-rated coach
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
          What sport helps a shy 9-year-old build confidence fast?
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Coach Daniel recommends a low-pressure group setting with frequent
          small wins, simple drills, and a coach who rewards effort before
          competition. He suggests tennis, swimming, or beginner basketball
          depending on the child&apos;s energy and comfort with team settings.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Coach takeaway
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Start with one session per week, pick a coach with strong parent
            reviews, and look for venues that keep practice times predictable.
          </p>
        </div>
      </div>
    </div>
  );
}

function CoachMarketplaceCard({ coach }: { coach: CoachCard }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10">
      <div className="relative h-40 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(51,65,85,0.85))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(233,115,22,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.16),transparent_32%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Local coach
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">
              {coach.name}
            </h3>
            <p className="mt-1 text-sm text-white/80">{coach.sport}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
            {coach.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Star className="h-4 w-4 text-amber-500" />
            {coach.rating}
            <span className="text-slate-400">·</span>
            <span className="text-sm font-medium text-slate-500">
              {coach.location}
            </span>
          </div>
          <BadgeCheck className="h-5 w-5 text-emerald-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {coach.badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {coach.specialties.map((specialty) => (
            <span
              key={specialty}
              className="inline-flex items-center rounded-full bg-power-orange/10 px-2.5 py-1 text-[11px] font-semibold text-power-orange"
            >
              {specialty}
            </span>
          ))}
        </div>

        <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          View profile <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function CommunityLandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Navigation variant="light" sticky />
      <main className="relative isolate flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.10),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.08),transparent_22%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] text-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.85),transparent_22%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.55),transparent_18%)]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,250,245,0.94))] shadow-xl shadow-slate-900/5">
            <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-10 lg:grid-cols-[1.25fr_0.85fr] lg:items-center lg:px-10 lg:py-12">
              <div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                  Parent-first youth sports community
                </span>
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Help your child grow in a safer, smarter sports community.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Find vetted coaches, trusted venues, and practical AI guidance
                  that helps parents choose the right next step with confidence.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Safety-first listings
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
                    <Users className="h-4 w-4 text-power-orange" />
                    Local parent community
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
                    <Compass className="h-4 w-4 text-sky-600" />
                    Nearby coach mapping
                  </span>
                </div>

                <div className="mt-7 max-w-3xl">
                  <HeroSearchBar />
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/guidance"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Get AI Guidance <BrainCircuit className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/coaches"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Explore local coaches <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Community pulse
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">
                        1,280+
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
                      <Trophy className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Parents and coaches discussing development, confidence, and
                    safe training options near you.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(233,115,22,0.08),rgba(255,255,255,0.98))] p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Fastest path
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    Search, ask, and book with confidence.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Start with a child profile, get structured guidance, then
                    move into coach and venue recommendations.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <SectionHeading
              eyebrow="Why parents use PowerMySport"
              title="A simpler path from curiosity to the right booking"
              description="Everything is designed to help families make confident decisions faster, while keeping safety and fit at the center of every recommendation."
            />
            <div className="grid gap-4 md:grid-cols-3">
              {valueProps.map((prop) => (
                <ValuePropCard key={prop.title} {...prop} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 sm:p-6">
              <SectionHeading
                eyebrow="Live community hub"
                title="See what nearby parents are asking right now"
                description="A forum-style feed surfaces trending local conversations, coaching tips, and the questions parents keep asking before booking."
              />
              <div className="grid gap-4">
                {communityPosts.map((post) => (
                  <CommunityPostCard key={post.title} post={post} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <FeaturedQACard />
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Community safety layer
                </p>
                <div className="mt-4 grid gap-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>
                      Verified coach badges and parent-reviewed profiles.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <Users className="mt-0.5 h-4 w-4 text-power-orange" />
                    <span>
                      Community questions focused on real local experiences.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <BrainCircuit className="mt-0.5 h-4 w-4 text-sky-600" />
                    <span>
                      AI guidance that turns parent concerns into clear next
                      steps.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <SectionHeading
              eyebrow="Trending marketplace"
              title="Top-rated local coaches ready for parent discovery"
              description="Browse strong-fit coaching profiles with rating context, safety badges, and sport-specific specialties before you commit."
            />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {marketplaceCoaches.map((coach) => (
                <CoachMarketplaceCard key={coach.name} coach={coach} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

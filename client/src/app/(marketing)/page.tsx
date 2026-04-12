"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getDashboardPathByRole } from "@/utils/roleDashboard";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { Stats } from "@/modules/marketing/components/marketing/Stats";
import { Testimonials } from "@/modules/marketing/components/marketing/Testimonials";
import {
  Building2,
  Check,
  Trophy,
  User as UserIcon,
  Users,
  Users2,
  Zap,
} from "lucide-react";
import Script from "next/script";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
export default function HomePage() {
  const { user } = useAuthStore();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PowerMySport",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    sameAs: [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PowerMySport",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/venues?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  // Features data
  const features = [
    {
      title: "Book Premium Venues",
      description:
        "Discover top-rated venues with live availability. From badminton courts to cricket grounds, book the right space near you in minutes.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Professional Coach Booking",
      description:
        "Connect with certified coaches for personalized training plans. Book coaching and venue sessions together for a seamless routine.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Manage Your Kids' Sports",
      description:
        "Keep every child profile in one dashboard. Manage dependents, schedules, and sessions without juggling multiple apps.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Secure Payment System",
      description:
        "Pay securely with transparent pricing and no hidden charges. Get instant confirmations, booking summaries, and payment status updates.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Smart Alerts & Reminders",
      description:
        "Stay on schedule with booking notifications, reminder preferences, and real-time updates when sessions change.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Flexible & Transparent Pricing",
      description:
        "Compare pricing across venues and coaches before you book. Choose options that match your budget and schedule.",
      icon: FeatureIcons.CreditCard,
    },
  ];

  // Stats data
  const stats = [
    {
      value: "500+",
      label: "Active Venues",
      description: "Sports facilities nationwide",
    },
    {
      value: "10,000+",
      label: "Happy Players",
      description: "Active platform users",
    },
    {
      value: "200+",
      label: "Certified Coaches",
      description: "Professional trainers available",
    },
    {
      value: "50,000+",
      label: "Successful Bookings",
      description: "Sessions completed",
    },
  ];

  // Testimonials data
  const testimonials = [
    {
      quote:
        "PowerMySport made training logistics simple for our family. I manage both my son and daughter's schedules, and coach bookings happen in the same flow.",
      author: "Anjali Patel",
      role: "Parent & Player",
      rating: 5,
    },
    {
      quote:
        "As a venue owner, this platform transformed our operations. Real-time visibility and smoother bookings helped us grow revenue significantly.",
      author: "Priya Sharma",
      role: "Venue Owner",
      rating: 5,
    },
    {
      quote:
        "I scaled from a few students to a full weekly roster through PowerMySport. Managing availability and connecting with committed athletes is now effortless.",
      author: "Vikram Singh",
      role: "Professional Coach",
      rating: 5,
    },
  ];

  const getDashboardLink = () => {
    if (!user) return "/register?role=PLAYER";
    return getDashboardPathByRole(user.role);
  };

  return (
    <main>
      <Script
        id="organization-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="website-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* Hero Section */}
      <Hero
        variant="home"
        title="One Stop Solution For All Your Sports Needs"
        subtitle="India's Premier Sports Booking Platform"
        description="Discover venues, book trusted coaches, and manage your entire sports routine from one streamlined platform."
        primaryCTA={{
          label: user ? "Go to Dashboard" : "Start Booking Now",
          href: getDashboardLink(),
        }}
        secondaryCTA={
          user?.role === "VENUE_LISTER"
            ? {
                label: "Manage Venues",
                href: "/venue-lister/inventory",
              }
            : {
                label: user ? "Browse Venues" : "List Your Venue",
                href: user ? "/venues" : "/onboarding",
              }
        }
        gradient
      />

      {/* Features Section */}
      <Features
        title="Everything You Need To Train, Play, and Improve"
        subtitle="Why Choose PowerMySport"
        description="Built for players, parents, coaches, and venue partners who want speed, clarity, and reliability in every booking."
        features={features}
        columns={3}
        variant="centered"
      />

      {/* Stats Section */}
      <Stats stats={stats} variant="gradient" columns={4} />

      {/* Parent-Child Management Highlight Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Parents & Guardians
            </p>
            <h2 className="font-title mb-4 text-3xl font-bold text-deep-slate sm:text-4xl lg:text-5xl">
              Manage Your Kids' Sports Journey
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Add multiple child profiles and handle bookings, training plans,
              and progress tracking from one simple parent dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                <Users2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3">
                Add Multiple Kids
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add unlimited dependents to your account. Track each child's
                age, sports interests, and training needs separately.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                <Trophy size={28} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3">
                Book Venues & Coaches
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Book premium venues for your kids and connect them with
                professional coaches for specialized training.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                <Zap size={28} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3">
                Track Sessions
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor upcoming sessions, booking history, and review-ready
                completed bookings from one dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Simple Process
            </p>
            <h2 className="font-title mb-4 text-3xl font-bold text-deep-slate sm:text-4xl lg:text-5xl">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Start in minutes with a simple three-step flow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 transition-transform group-hover:scale-110">
                1
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Create Your Account
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Create your account as a player, coach, or venue partner in
                under two minutes.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 transition-transform group-hover:scale-110">
                2
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Search Venues & Coaches
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Filter by sport, location, availability, and pricing to find the
                best match.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 transition-transform group-hover:scale-110">
                3
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Book & Start Playing
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Complete payment, get instant confirmation, and manage changes
                from your booking dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <Testimonials
        title="What Our Users Say"
        subtitle="Testimonials"
        testimonials={testimonials}
      />

      {/* Multi-Role CTA Section - Only show if user is NOT logged in */}
      {!user && (
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
                Join PowerMySport
              </h2>
              <p className="text-lg text-slate-600">
                Choose your role and unlock better training and booking
                experiences
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* ... (Previous Player/Venue/Coach cards content kept same) ... */}
              {/* Player Card */}
              <div className="group shop-surface rounded-2xl p-8 premium-shadow flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110">
                  <UserIcon size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Players & Parents
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 grow">
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Book premium venues instantly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Find & book professional coaches</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Manage kids' sports activities</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Booking reminders & notifications</span>
                  </li>
                </ul>
                <a
                  href="/register?role=PLAYER"
                  className="inline-block w-full rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  Start Booking Now
                </a>
              </div>

              {/* Venue Owner Card - Highlighted */}
              <div className="group shop-surface relative flex flex-col rounded-2xl border-2 border-power-orange p-8 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg md:scale-105">
                <div className="absolute top-0 right-0 bg-power-orange text-white px-4 py-1 rounded-bl-lg rounded-tr-xl text-xs font-bold">
                  FEATURED
                </div>
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110">
                  <Building2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Venue Owners
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 grow">
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Reach thousands of players</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Automated booking management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Real-time availability tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Instant payouts & analytics</span>
                  </li>
                </ul>
                <a
                  href="/onboarding"
                  className="inline-block w-full rounded-xl bg-power-orange px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  List Your Venue
                </a>
              </div>

              {/* Coach Card */}
              <div className="group shop-surface rounded-2xl p-8 premium-shadow flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="w-16 h-16 bg-turf-green text-white rounded-full flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110">
                  <Trophy size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Coaches & Trainers
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 grow">
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Build your coaching profile</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Connect with serious athletes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Set your own rates & schedule</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold shrink-0 mt-0.5">
                      <Check size={14} />
                    </span>
                    <span>Grow your coaching business</span>
                  </li>
                </ul>
                <a
                  href="/register?role=COACH"
                  className="inline-block w-full rounded-xl bg-turf-green px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Become a Coach
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      {/* Explore Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <h2 className="font-title text-3xl font-bold text-center mb-2 text-slate-900">
            Start Exploring
          </h2>
          <p className="text-center text-slate-600 mb-8">
            Browse venues and coaches to plan your next session with confidence
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <a
              href="/venues"
              className="group rounded-2xl border border-white/70 bg-[linear-gradient(120deg,#fff9ef_0%,#fff3db_100%)] p-6 text-center premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <Building2
                size={40}
                className="mx-auto mb-3 text-power-orange transition-transform group-hover:scale-110"
              />
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Browse Venues
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Explore premium sports venues in your area
              </p>
              <span className="text-power-orange font-semibold">
                View All Venues →
              </span>
            </a>
            <a
              href="/coaches"
              className="group rounded-2xl border border-white/70 bg-[linear-gradient(120deg,#f2fff7_0%,#e5f8ef_100%)] p-6 text-center premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <Users
                size={40}
                className="mx-auto mb-3 text-turf-green transition-transform group-hover:scale-110"
              />
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Find Coaches
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Discover expert coaches for professional training
              </p>
              <span className="text-turf-green font-semibold">
                View All Coaches →
              </span>
            </a>
          </div>
        </div>
      </section>

      <CTA
        variant="gradient"
        title={
          user
            ? "Ready for Your Next Game?"
            : "Ready to Start Your Sports Journey?"
        }
        description={
          user
            ? "Book your next venue or coach session and stay in rhythm."
            : "Join thousands of players, coaches, and venue partners already building better sports experiences with PowerMySport."
        }
        primaryCTA={{
          label: user ? "Go to Dashboard" : "Get Started Free",
          href: getDashboardLink(),
        }}
        secondaryCTA={{
          label: "Learn More",
          href: "/how-it-works",
        }}
      />
    </main>
  );
}

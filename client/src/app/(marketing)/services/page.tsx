"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { getCommunityAppUrl } from "@/lib/community/url";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { motion } from "framer-motion";
import { Check, QrCode, Bell, BarChart3 } from "lucide-react";

const iconMotion = {
  initial: { opacity: 0, y: 10, scale: 0.94 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  whileHover: { scale: 1.08, y: -2, rotate: 2 },
  whileTap: { scale: 0.98 },
};

export default function ServicesPage() {
  const communityUrl = getCommunityAppUrl();

  // Main services for players
  const playerServices = [
    {
      title: "Premium Venue Booking",
      description:
        "Browse and instantly book verified sports venues nationwide. Real-time availability, transparent pricing, and verified facility details. Book badminton courts, cricket grounds, football fields, and more.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Professional Coach Booking",
      description:
        "Connect with certified coaches offering personalized training. Book coaching lessons at your chosen venue or their facility. Add coaches to your venue booking for integrated sessions.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Manage Kids' Sports Activities",
      description:
        "Add unlimited dependents (children) to your account. Manage each child's profile, sports interests, and bookings separately. Track progress and coordinate all their training sessions in one place.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Secure Integrated Payments",
      description:
        "Pay securely with transparent totals, promo support, and group booking payment options (single payer or split). Get instant booking confirmations and status updates.",
      icon: FeatureIcons.CreditCard,
    },
  ];
  // Services for venue owners
  const venueOwnerFeatures = [
    {
      title: "Booking Management Dashboard",
      description:
        "Comprehensive real-time dashboard showing all bookings, occupancy rates, and revenue. Manage slots, set dynamic pricing, and track facility utilization across all courts/fields.",
      icon: FeatureIcons.Chart,
    },
    {
      title: "Coach Integration Programs",
      description:
        "List certified coaches on your venue profile. Enable combo bookings (venue + coach) to attract more players and increase average revenue per booking.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Automated Payment System",
      description:
        "Receive instant payouts after each booking. Automatic settlement with transparent breakdowns. No payment delays or manual processing needed.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Marketing & Visibility",
      description:
        "Get discovered by players searching on PowerMySport. Featured listings, reviews, and ratings help you stand out and attract more bookings.",
      icon: FeatureIcons.Star,
    },
  ];

  // Coach services
  const coachFeatures = [
    {
      title: "Professional Coaching Profile",
      description:
        "Showcase your credentials, experience, certifications, and specialties. Set your coaching rates, availability, and service areas to attract serious students.",
    },
    {
      title: "Venue Partnership Integration",
      description:
        "Partner with premium venues to offer coaching sessions. Tap into venues' existing player base and increase your client reach exponentially.",
    },
    {
      title: "Session Management System",
      description:
        "Manage all coaching sessions, track student progress, maintain learning history, and schedule follow-ups all in one platform.",
    },
    {
      title: "Automated Revenue Tracking",
      description:
        "Monitor earnings in real-time with detailed reports. Get paid automatically after each coaching session with transparent commission structures.",
    },
  ];

  const communityFeatures = [
    {
      title: "Ask the community",
      description:
        "Let players and coaches help you choose the right venue, sport setup, or training option before you commit.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Learn from real feedback",
      description:
        "Use reviews and discussions to understand what works well for different sports, locations, and skill levels.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Connect every service",
      description:
        "Keep bookings, coaching, and community advice in one flow so discovery feels connected instead of fragmented.",
      icon: FeatureIcons.Calendar,
    },
  ];
  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="page"
        title="Our Services"
        subtitle="What We Offer"
        description="Comprehensive solutions for players, venue owners, and coaches. Everything you need to power your sports experience."
      />

      {/* Community Section */}
      <Features
        title="Community Support Built Into Every Service"
        subtitle="Community System"
        description="PowerMySport combines booking and conversation so you can validate options with people who already play, coach, or manage venues."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      {/* For Players Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Players
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Book Venues & Coaches Instantly
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Everything you need to play your favorite sports and improve your
              skills
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {playerServices.map((service, index) => (
              <Card
                key={index}
                variant="elevated"
                className="group shop-surface premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="pt-6">
                  <motion.div
                    className="mb-4 origin-center text-power-orange will-change-transform"
                    initial={iconMotion.initial}
                    whileInView={iconMotion.whileInView}
                    whileHover={iconMotion.whileHover}
                    whileTap={iconMotion.whileTap}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {service.icon}
                  </motion.div>
                  <CardTitle className="text-xl mb-3">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Venue + Coach Combo Booking */}
          <div className="bg-linear-to-r from-indigo-600 to-power-orange rounded-2xl p-8 md:p-12 mb-8 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-4">
                  Premium Combo: Venue + Coach
                </h3>
                <p className="text-lg text-white/90 mb-6">
                  Book a venue and professional coach in one seamless
                  transaction. Get the complete sports experience with facility
                  access and personalized training.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      <Check size={14} />
                    </span>
                    <span>Find venues with available coaches</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      <Check size={14} />
                    </span>
                    <span>Book both in one transaction</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      <Check size={14} />
                    </span>
                    <span>Get specialized training + premium facility</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      <Check size={14} />
                    </span>
                    <span>Perfect for beginners & serious athletes</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white/10 rounded-xl p-6">
                <p className="text-white/80 text-center mb-4">
                  Combo Booking Flow
                </p>
                <div className="space-y-3">
                  <div className="bg-white/20 rounded-lg p-4 text-center font-semibold">
                    1. Select Venue
                  </div>
                  <div className="text-center text-2xl">↓</div>
                  <div className="bg-white/20 rounded-lg p-4 text-center font-semibold">
                    2. Choose Coach
                  </div>
                  <div className="text-center text-2xl">↓</div>
                  <div className="bg-white/20 rounded-lg p-4 text-center font-semibold">
                    3. Single Payment
                  </div>
                  <div className="text-center text-2xl">↓</div>
                  <div className="bg-turf-green rounded-lg p-4 text-center font-bold">
                    Start Training!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How it works for players */}
          <div className="rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#fff9ef_0%,#fff3db_100%)] p-8 md:p-12">
            <h3 className="text-2xl font-bold text-deep-slate mb-6 text-center">
              Three Ways to Book on PowerMySport
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group shop-surface rounded-2xl p-8 border border-power-orange/30 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="inline-block bg-power-orange text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 1
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Venue Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      1
                    </span>
                    <span>Search venues by sport</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      2
                    </span>
                    <span>Check availability</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      3
                    </span>
                    <span>Book & play</span>
                  </li>
                </ul>
              </div>

              <div className="group shop-surface rounded-2xl p-8 border border-turf-green/30 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="inline-block bg-turf-green text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 2
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Coach Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      1
                    </span>
                    <span>Find coaches near you</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      2
                    </span>
                    <span>Check their availability</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      3
                    </span>
                    <span>Book training session</span>
                  </li>
                </ul>
              </div>

              <div className="group shop-surface rounded-2xl p-8 border border-indigo-400/40 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 3 ⭐
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Combo Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      1
                    </span>
                    <span>Search venue + coach</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      2
                    </span>
                    <span>Unified checkout flow</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                      3
                    </span>
                    <span>Complete experience</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Venue Owners Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Venue Owners
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Streamline Your Venue Operations
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Powerful tools to manage bookings, increase revenue, and grow your
              sports facility
            </p>
          </div>

          <Features
            features={venueOwnerFeatures}
            columns={2}
            variant="default"
          />

          <div className="mt-12 text-center">
            <a
              href="/onboarding"
              className="inline-block rounded-xl bg-deep-slate px-8 py-4 text-lg font-semibold text-white premium-shadow transition-colors hover:bg-slate-800"
            >
              List Your Venue Today
            </a>
          </div>
        </div>
      </section>

      {/* For Coaches Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Coaches
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Grow Your Coaching Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Connect with serious athletes and manage your coaching practice
              efficiently
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {coachFeatures.map((feature, index) => (
              <Card
                key={index}
                variant="elevated"
                className="group shop-surface premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-turf-green text-white transition-transform group-hover:scale-110">
                    <Check className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl mb-3">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href="/register?role=COACH"
              className="inline-block rounded-xl bg-turf-green px-8 py-4 text-lg font-semibold text-white premium-shadow transition-colors hover:bg-green-700"
            >
              Become a Coach
            </a>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Additional Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              More ways we add value to your sports experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group shop-surface rounded-2xl p-8 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <QrCode size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Group Booking Invites
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Invite friends, track acceptance, and confirm shared sessions
                from one flow.
              </p>
            </div>

            <div className="group shop-surface rounded-2xl p-8 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-power-orange/10 text-power-orange rounded-full flex items-center justify-center mb-6 mx-auto">
                <Bell size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Smart Notifications
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Booking reminders, payment updates, social invites, and
                community activity alerts.
              </p>
            </div>

            <div className="group shop-surface rounded-2xl p-8 premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-turf-green/10 text-turf-green rounded-full flex items-center justify-center mb-6 mx-auto">
                <BarChart3 size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Community & Reviews
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Learn from player discussions and leave verified reviews after
                completed sessions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Ready to Experience These Services?"
        description="Join PowerMySport today and see how seamless sports booking and community support can feel."
        primaryCTA={{
          label: "Get Started Free",
          href: "/register",
        }}
        secondaryCTA={{
          label: "Open Community",
          href: communityUrl,
        }}
      />
    </main>
  );
}

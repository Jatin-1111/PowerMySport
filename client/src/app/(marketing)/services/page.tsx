"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { Check, QrCode, Bell, BarChart3 } from "lucide-react";

export default function ServicesPage() {
  // Main services for players
  const playerServices = [
    {
      title: "Premium Venue Booking",
      description:
        "Browse and instantly book from thousands of verified sports venues nationwide. Real-time availability, transparent pricing, and verified facility details. Book badminton courts, cricket grounds, football fields, and more.",
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
        "Pay securely with automatic split payments to venues and coaches. Transparent pricing breakdown, no hidden fees, and instant booking confirmations via email and SMS.",
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
        "Get discovered by thousands of players searching on PowerMySport. Featured listings, reviews, and ratings help you stand out and attract more bookings.",
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

  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="page"
        title="Our Services"
        subtitle="What We Offer"
        description="Comprehensive solutions for players, venue owners, and coaches. Everything you need to power your sports experience."
      />

      {/* For Players Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Players
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Book Venues & Coaches Instantly
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Everything you need to play your favorite sports and improve your
              skills
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {playerServices.map((service, index) => (
              <Card key={index} variant="elevated">
                <CardContent className="pt-6">
                  <div className="mb-4 text-power-orange">{service.icon}</div>
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
          <div className="bg-gradient-to-r from-indigo-600 to-power-orange rounded-2xl p-8 md:p-12 mb-8 text-white">
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
                      ✓
                    </span>
                    <span>Find venues with available coaches</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
                    </span>
                    <span>Book both in one transaction</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
                    </span>
                    <span>Get specialized training + premium facility</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
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
          <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl font-bold text-deep-slate mb-6 text-center">
              Three Ways to Book on PowerMySport
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-8 border-2 border-power-orange shadow-md hover:shadow-lg transition-shadow">
                <div className="inline-block bg-power-orange text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 1
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Venue Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      1
                    </span>
                    <span>Search venues by sport</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      2
                    </span>
                    <span>Check availability</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-power-orange text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      3
                    </span>
                    <span>Book & play</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-xl p-8 border-2 border-turf-green shadow-md hover:shadow-lg transition-shadow">
                <div className="inline-block bg-turf-green text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 2
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Coach Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      1
                    </span>
                    <span>Find coaches near you</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      2
                    </span>
                    <span>Check their availability</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-turf-green text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      3
                    </span>
                    <span>Book training session</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-xl p-8 border-2 border-indigo-600 shadow-md hover:shadow-lg transition-shadow">
                <div className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
                  OPTION 3 ⭐
                </div>
                <h4 className="text-lg font-bold text-deep-slate mb-6">
                  Combo Booking
                </h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      1
                    </span>
                    <span>Search venue + coach</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      2
                    </span>
                    <span>One unified checkout</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
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
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Venue Owners
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
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
              className="inline-block bg-deep-slate text-white px-8 py-4 rounded-lg font-semibold hover:bg-slate-800 transition-colors text-lg"
            >
              List Your Venue Today
            </a>
          </div>
        </div>
      </section>

      {/* For Coaches Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Coaches
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Grow Your Coaching Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Connect with serious athletes and manage your coaching practice
              efficiently
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {coachFeatures.map((feature, index) => (
              <Card key={index} variant="elevated">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-turf-green text-white rounded-lg flex items-center justify-center mb-4">
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
              className="inline-block bg-turf-green text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors text-lg"
            >
              Become a Coach
            </a>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Additional Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              More ways we add value to your sports experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <QrCode size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Mobile QR Codes
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Digital check-in with QR codes. No paperwork, no hassle.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-power-orange/10 text-power-orange rounded-full flex items-center justify-center mb-6 mx-auto">
                <Bell size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Smart Notifications
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Booking reminders, availability alerts, and session updates.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-turf-green/10 text-turf-green rounded-full flex items-center justify-center mb-6 mx-auto">
                <BarChart3 size={32} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Analytics Dashboard
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Track your bookings, spending, and sports activity over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Ready to Experience These Services?"
        description="Join PowerMySport today and discover how easy sports booking can be"
        primaryCTA={{
          label: "Get Started Free",
          href: "/register",
        }}
        secondaryCTA={{
          label: "Learn More",
          href: "/how-it-works",
        }}
      />
    </main>
  );
}

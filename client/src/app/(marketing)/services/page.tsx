"use client";

import { CTA } from "@/components/marketing/CTA";
import { FeatureIcons, Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/Card";
import { Check } from "lucide-react";

export default function ServicesPage() {
  // Main services for players
  const playerServices = [
    {
      title: "Venue Booking",
      description:
        "Search and book sports venues with real-time availability. From badminton courts to cricket grounds, find the perfect facility near you.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Coach Booking",
      description:
        "Connect with certified coaches for personalized training. Book lessons alongside your venue bookings for seamless sessions.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Flexible Scheduling",
      description:
        "Book by the hour with flexible time slots. See available times instantly and reschedule easily when plans change.",
      icon: FeatureIcons.Calendar,
    },
    {
      title: "Secure Payments",
      description:
        "Pay safely with our integrated payment system. Transparent pricing with automated split payments to venues and coaches.",
      icon: FeatureIcons.CreditCard,
    },
  ];

  // Services for venue owners
  const venueOwnerFeatures = [
    {
      title: "Online Booking Management",
      description:
        "Comprehensive dashboard to manage all bookings, track revenue, and monitor facility usage in real-time.",
      icon: FeatureIcons.Chart,
    },
    {
      title: "Automated Scheduling",
      description:
        "Set up your availability once and let the system handle bookings automatically. No more phone calls or manual updates.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Payment Processing",
      description:
        "Receive payments directly with automatic settlement. Track earnings with detailed financial reports.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Marketing Exposure",
      description:
        "Get discovered by thousands of players searching for venues. Boost your bookings with our growing user base.",
      icon: FeatureIcons.Star,
    },
  ];

  // Coach services
  const coachFeatures = [
    {
      title: "Profile & Portfolio",
      description:
        "Showcase your credentials, experience, certifications, and coaching style to attract serious athletes.",
    },
    {
      title: "Flexible Service Models",
      description:
        "Offer coaching at your own venue, as a freelancer at any facility, or both—whatever fits your style.",
    },
    {
      title: "Client Management",
      description:
        "Manage your coaching sessions, track student progress, and maintain session history all in one place.",
    },
    {
      title: "Revenue Tracking",
      description:
        "Monitor your earnings with detailed reports. Get paid automatically after each coaching session.",
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

          {/* How it works for players */}
          <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl font-bold text-deep-slate mb-6 text-center">
              How It Works for Players
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-power-orange text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  1
                </div>
                <p className="font-semibold text-deep-slate mb-1">
                  Create Account
                </p>
                <p className="text-sm text-muted-foreground">
                  Sign up as a player
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-power-orange text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  2
                </div>
                <p className="font-semibold text-deep-slate mb-1">Search</p>
                <p className="text-sm text-muted-foreground">
                  Find venues & coaches
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-power-orange text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  3
                </div>
                <p className="font-semibold text-deep-slate mb-1">Book</p>
                <p className="text-sm text-muted-foreground">
                  Select time & pay
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-power-orange text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  4
                </div>
                <p className="font-semibold text-deep-slate mb-1">Play</p>
                <p className="text-sm text-muted-foreground">Show QR & enjoy</p>
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
      <section className="py-16 sm:py-20 lg:py-24 bg-linear-to-br from-deep-slate to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Additional Features
            </h2>
            <p className="text-lg text-white/90 max-w-3xl mx-auto">
              More ways we add value to your sports experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-2">Mobile QR Codes</h3>
              <p className="text-white/90">
                Digital check-in with QR codes. No paperwork, no hassle.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-xl font-bold mb-2">Smart Notifications</h3>
              <p className="text-white/90">
                Booking reminders, availability alerts, and session updates.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-2">Analytics Dashboard</h3>
              <p className="text-white/90">
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



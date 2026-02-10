"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { Stats } from "@/modules/marketing/components/marketing/Stats";

export default function AboutPage() {
  // Core values
  const values = [
    {
      title: "Player-Centric",
      description:
        "We put players first by making sports more accessible, affordable, and enjoyable for everyone.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Innovation",
      description:
        "Leveraging technology to simplify bookings, payments, and venue management with cutting-edge solutions.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Trust & Transparency",
      description:
        "Building trust through transparent pricing, secure payments, and verified venues and coaches.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Community Building",
      description:
        "Creating a vibrant sports community that connects players, venues, and coaches nationwide.",
      icon: FeatureIcons.Star,
    },
  ];

  // Impact stats
  const stats = [
    {
      value: "2020",
      label: "Founded",
      description: "Our journey began",
    },
    {
      value: "50+",
      label: "Cities",
      description: "Nationwide presence",
    },
    {
      value: "500+",
      label: "Venues",
      description: "Partner facilities",
    },
    {
      value: "10K+",
      label: "Users",
      description: "Active community",
    },
  ];

  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="page"
        title="About PowerMySport"
        subtitle="Our Story"
        description="We're on a mission to make sports accessible to everyone by connecting players with venues and professional coaches."
      />

      {/* Mission Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              PowerMySport was born from a simple observation: booking sports
              venues shouldn&apos;t be complicated. We saw players struggling to
              find available courts, venue owners missing out on bookings, and
              coaches unable to reach serious athletes.
            </p>
            <p className="text-lg text-muted-foreground mb-6">
              We built PowerMySport to solve these problems with a unified
              platform that brings the entire sports ecosystem together. Whether
              you&apos;re a casual player looking for a badminton court or a
              professional athlete seeking expert coaching, we&apos;re here to
              power your sports journey.
            </p>
            <p className="text-lg text-muted-foreground">
              Today, we&apos;re proud to be India&apos;s fastest-growing sports
              booking platform, serving thousands of users across major cities
              and helping the sports community thrive.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <Stats stats={stats} variant="gradient" columns={4} />

      {/* Core Values */}
      <Features
        title="Our Core Values"
        subtitle="What Drives Us"
        description="These principles guide everything we do at PowerMySport"
        features={values}
        columns={2}
        variant="centered"
      />

      {/* Team Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              The Team
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Built by Sports Enthusiasts
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Our team combines deep sports industry knowledge with technical
              expertise to create the best booking experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Team member cards - placeholder structure */}
            <div className="text-center">
              <div className="w-32 h-32 bg-linear-to-br from-power-orange to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
                AM
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Amit Mehta
              </h3>
              <p className="text-muted-foreground mb-2">Founder & CEO</p>
              <p className="text-sm text-muted-foreground">
                Former national-level badminton player with 10+ years in tech
              </p>
            </div>

            <div className="text-center">
              <div className="w-32 h-32 bg-linear-to-br from-turf-green to-green-700 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
                PS
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Priya Sharma
              </h3>
              <p className="text-muted-foreground mb-2">Co-Founder & CTO</p>
              <p className="text-sm text-muted-foreground">
                Tech entrepreneur passionate about building scalable platforms
              </p>
            </div>

            <div className="text-center">
              <div className="w-32 h-32 bg-linear-to-br from-deep-slate to-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
                RK
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Rohan Kapoor
              </h3>
              <p className="text-muted-foreground mb-2">Head of Operations</p>
              <p className="text-sm text-muted-foreground">
                Sports facility management expert with MBA from IIM
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-6">
                Our Vision for the Future
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                We envision a future where playing sports is as easy as ordering
                food online. A world where every neighborhood has accessible,
                affordable sports facilities, and every athlete has access to
                quality coaching.
              </p>
              <p className="text-lg text-muted-foreground mb-4">
                We&apos;re expanding to cover more sports, more cities, and more
                services. From AI-powered skill assessments to virtual coaching
                sessions, we&apos;re constantly innovating to serve the sports
                community better.
              </p>
              <p className="text-lg text-muted-foreground">
                Join us on this journey to make India a more active, healthier
                nation - one booking at a time.
              </p>
            </div>

            <div className="space-y-6">
              {/* Milestone cards */}
              <div className="bg-white border-2 border-power-orange rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  2024: Multi-Sport Expansion
                </h3>
                <p className="text-muted-foreground">
                  Expanding beyond badminton and cricket to include football,
                  tennis, swimming, and more
                </p>
              </div>

              <div className="bg-white border-2 border-turf-green rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  2025: AI-Powered Matching
                </h3>
                <p className="text-muted-foreground">
                  Intelligent matching of players with ideal venues and coaches
                  based on skill level and goals
                </p>
              </div>

              <div className="bg-white border-2 border-deep-slate rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  2026: National Coverage
                </h3>
                <p className="text-muted-foreground">
                  Present in 100+ cities with 5,000+ partner venues and 1,000+
                  certified coaches
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Be Part of Our Story"
        description="Join thousands of players, venues, and coaches who are already part of the PowerMySport community"
        primaryCTA={{
          label: "Get Started Today",
          href: "/register",
        }}
        secondaryCTA={{
          label: "Contact Us",
          href: "/contact",
        }}
      />
    </main>
  );
}

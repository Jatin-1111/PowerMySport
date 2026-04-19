"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { getCommunityAppUrl } from "@/lib/community/url";

export default function AboutPage() {
  const communityUrl = getCommunityAppUrl();

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

  const communityFeatures = [
    {
      title: "Shared answers",
      description:
        "Players and coaches can ask practical questions and get context from people who have already been there.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Local trust signals",
      description:
        "Reviews and recommendations help surface which venues and coaches actually work well in real life.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Connected ecosystem",
      description:
        "Bookings, discussion, and recommendations sit together so the community can influence every decision.",
      icon: FeatureIcons.Calendar,
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
              Today, we&apos;re focused on building a dependable sports platform
              where discovery, bookings, and community advice work together so
              players can make better decisions with less guesswork.
            </p>
          </div>
        </div>
      </section>

      {/* Community System */}
      <Features
        title="Our Community System"
        subtitle="Shared Sports Intelligence"
        description="PowerMySport is designed to turn experience into useful guidance so players, parents, coaches, and venue partners can all learn from each other."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

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
                We&apos;re expanding the platform to cover more sports, more
                service types, and better ways to surface community knowledge so
                people can find the right fit faster.
              </p>
              <p className="text-lg text-muted-foreground">
                Join us on this journey to make it easier for every sports
                community to share what works, what doesn&apos;t, and where the
                best experiences are happening.
              </p>
            </div>

            <div className="space-y-6">
              {/* Milestone cards */}
              <div className="bg-white border-2 border-power-orange rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  More sports, same community
                </h3>
                <p className="text-muted-foreground">
                  Extending the platform across additional sports while keeping
                  the same shared discussion and recommendation layer.
                </p>
              </div>

              <div className="bg-white border-2 border-turf-green rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  Better recommendations
                </h3>
                <p className="text-muted-foreground">
                  Using community feedback and booking context to guide players
                  toward venues and coaches that fit their goals.
                </p>
              </div>

              <div className="bg-white border-2 border-deep-slate rounded-lg p-6">
                <h3 className="text-xl font-bold text-deep-slate mb-2">
                  A stronger sports network
                </h3>
                <p className="text-muted-foreground">
                  Building a reliable network where conversations, reviews, and
                  bookings reinforce each other instead of living in separate
                  places.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Be part of the community"
        description="Join the people using PowerMySport to share advice, compare options, and make smarter sports decisions together."
        primaryCTA={{
          label: "Open Community",
          href: communityUrl,
        }}
        secondaryCTA={{
          label: "Contact Us",
          href: "/contact",
        }}
      />
    </main>
  );
}

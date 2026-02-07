"use client";

import { CTA } from "@/components/marketing/CTA";
import { FeatureIcons, Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import { Stats } from "@/components/marketing/Stats";
import { Testimonials } from "@/components/marketing/Testimonials";

export default function HomePage() {
  // Features data
  const features = [
    {
      title: "Easy Booking System",
      description:
        "Browse available venues, check real-time availability, and book your sports session in just a few clicks. No phone calls, no hassle.",
      icon: FeatureIcons.Calendar,
    },
    {
      title: "Nationwide Coverage",
      description:
        "Access thousands of sports venues across the country. From badminton courts to cricket grounds, find the perfect space near you.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Professional Coaches",
      description:
        "Connect with certified coaches for personalized training. Book coaching sessions alongside your venue bookings.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Secure Payments",
      description:
        "Pay safely with our integrated payment system. Transparent pricing with no hidden fees. Get instant booking confirmations.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Instant Confirmation",
      description:
        "Receive immediate booking confirmation with QR codes. Check-in seamlessly at venues with your digital pass.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Flexible Pricing",
      description:
        "Compare prices across venues and choose what fits your budget. Enjoy competitive rates and transparent fee structures.",
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
        "PowerMySport made it incredibly easy to find and book badminton courts near my office. The booking process is smooth and I love the QR code check-in feature!",
      author: "Rajesh Kumar",
      role: "Regular Player",
      rating: 5,
    },
    {
      quote:
        "As a venue owner, this platform has transformed how we manage bookings. The admin dashboard is intuitive and we've seen a 40% increase in bookings!",
      author: "Priya Sharma",
      role: "Venue Owner",
      rating: 5,
    },
    {
      quote:
        "Finding clients as a freelance coach was always challenging. PowerMySport connected me with serious athletes looking for professional training. Game changer!",
      author: "Vikram Singh",
      role: "Professional Coach",
      rating: 5,
    },
  ];

  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="home"
        title="Power Your Sports Journey"
        subtitle="India's Premier Sports Booking Platform"
        description="Book badminton courts, cricket grounds, football fields, and connect with professional coaches. All in one platform."
        primaryCTA={{
          label: "Start Booking Now",
          href: "/register?role=PLAYER",
        }}
        secondaryCTA={{
          label: "List Your Venue",
          href: "/onboarding",
        }}
        gradient
      />

      {/* Features Section */}
      <Features
        title="Everything You Need to Power Your Game"
        subtitle="Why Choose PowerMySport"
        description="We've built the ultimate platform for players, venue owners, and coaches. Here's what makes us different."
        features={features}
        columns={3}
        variant="centered"
      />

      {/* Stats Section */}
      <Stats stats={stats} variant="gradient" columns={4} />

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              Simple Process
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-slate mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Get started with PowerMySport in just three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Create Your Account
              </h3>
              <p className="text-muted-foreground">
                Sign up as a player, venue owner, or coach. Takes less than 2
                minutes.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Search & Choose
              </h3>
              <p className="text-muted-foreground">
                Browse venues by sport, location, and availability. Compare
                prices and amenities.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-deep-slate mb-2">
                Book & Play
              </h3>
              <p className="text-muted-foreground">
                Complete secure payment and receive instant confirmation. Show
                QR code and play!
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

      {/* Multi-Role CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Join PowerMySport Today
            </h2>
            <p className="text-lg text-muted-foreground">
              Whether you're a player, venue owner, or coach, we have something
              for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Player Card */}
            <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-lg p-8 text-center border-2 border-power-orange">
              <div className="text-4xl mb-4">🏸</div>
              <h3 className="text-2xl font-bold text-deep-slate mb-2">
                Players
              </h3>
              <p className="text-muted-foreground mb-6">
                Book venues and find coaches near you
              </p>
              <a
                href="/register?role=PLAYER"
                className="inline-block bg-power-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                Start Booking
              </a>
            </div>

            {/* Venue Owner Card */}
            <div className="bg-linear-to-br from-slate-50 to-slate-100 rounded-lg p-8 text-center border-2 border-deep-slate">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-2xl font-bold text-deep-slate mb-2">
                Venue Owners
              </h3>
              <p className="text-muted-foreground mb-6">
                List your facility and reach thousands of players
              </p>
              <a
                href="/onboarding"
                className="inline-block bg-deep-slate text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
              >
                List Your Venue
              </a>
            </div>

            {/* Coach Card */}
            <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-8 text-center border-2 border-turf-green">
              <div className="text-4xl mb-4">👨‍🏫</div>
              <h3 className="text-2xl font-bold text-deep-slate mb-2">
                Coaches
              </h3>
              <p className="text-muted-foreground mb-6">
                Offer training and grow your coaching business
              </p>
              <a
                href="/register?role=COACH"
                className="inline-block bg-turf-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Become a Coach
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <CTA
        variant="gradient"
        title="Ready to Power Your Sports Experience?"
        description="Join thousands of players, venues, and coaches already using PowerMySport. Get started today!"
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



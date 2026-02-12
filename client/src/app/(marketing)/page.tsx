"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { Stats } from "@/modules/marketing/components/marketing/Stats";
import { Testimonials } from "@/modules/marketing/components/marketing/Testimonials";
import {
  Users,
  Building2,
  User as UserIcon,
  Users2,
  Trophy,
  Zap,
} from "lucide-react";
export default function HomePage() {
  const { user } = useAuthStore();

  // Features data
  const features = [
    {
      title: "Book Premium Venues",
      description:
        "Discover and book thousands of sports venues with real-time availability. From badminton courts to cricket grounds, find the perfect facility near you instantly.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Professional Coach Booking",
      description:
        "Connect with certified coaches for personalized training. Book coaching sessions alongside your venue bookings for complete sports experience.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Manage Your Kids' Sports",
      description:
        "Track and manage your children's sports activities in one place. Add dependents, manage their profiles, and coordinate their training and bookings effortlessly.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Secure Payment System",
      description:
        "Pay safely with our integrated payment system. Transparent pricing with no hidden fees. Get instant booking confirmations with digital QR codes.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Instant Digital Check-in",
      description:
        "Receive booking confirmation with QR codes. Check-in seamlessly at venues with your digital pass. No paperwork, no delays.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Flexible & Transparent Pricing",
      description:
        "Compare prices across venues and coaches. Enjoy competitive rates with transparent fee structures. No hidden charges ever.",
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
        "PowerMySport makes booking venues for my kids' training incredibly simple. I manage both my son and daughter's schedules, and I can even book their coach at the same venue. Game-changer for busy parents!",
      author: "Anjali Patel",
      role: "Parent & Player",
      rating: 5,
    },
    {
      quote:
        "As a venue owner, this platform transformed our business. The analytics dashboard shows real-time bookings, and we've seen a 40% increase in revenue. Highly recommended!",
      author: "Priya Sharma",
      role: "Venue Owner",
      rating: 5,
    },
    {
      quote:
        "I went from coaching 3 students to 15+ through PowerMySport. I can manage my availability, set my rates, and connect with serious athletes looking for professional training. Best platform out there!",
      author: "Vikram Singh",
      role: "Professional Coach",
      rating: 5,
    },
  ];

  const getDashboardLink = () => {
    if (!user) return "/register?role=PLAYER";
    const dashboards = {
      PLAYER: "/dashboard/my-bookings",
      VENUE_LISTER: "/venue-lister/inventory",
      COACH: "/coach/profile",
      ADMIN: "/admin",
    };
    return dashboards[user.role] || "/dashboard/my-bookings";
  };

  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="home"
        title="Power Your Sports Journey"
        subtitle="India's Premier Sports Booking Platform"
        description="Book badminton courts, cricket grounds, football fields, and connect with professional coaches. All in one platform."
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
        title="Everything You Need to Power Your Game"
        subtitle="Why Choose PowerMySport"
        description="We've built the ultimate platform for players, venue owners, and coaches. Here's what makes us different."
        features={features}
        columns={3}
        variant="centered"
      />

      {/* Stats Section */}
      <Stats stats={stats} variant="gradient" columns={4} />

      {/* Parent-Child Management Highlight Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3">
              For Parents & Guardians
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-slate mb-4">
              Manage Your Kids' Sports Journey
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Add unlimited dependents (children) and manage all their sports
              activities, bookings, and coaching sessions in one unified
              dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
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

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
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

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                <Zap size={28} />
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3">
                Track Progress
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor your children's attendance, coaching sessions, and
                sports progress all in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

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
            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Create Your Account
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Sign up as a player, venue owner, or coach. Takes less than 2
                minutes.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Search Venues & Coaches
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Browse venues by sport, location, and availability. Filter by
                coaches and compare prices.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200">
              <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-lg font-bold text-deep-slate mb-3 text-center">
                Book & Start Playing
              </h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
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

      {/* Multi-Role CTA Section - Only show if user is NOT logged in */}
      {!user && (
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Join PowerMySport Today
              </h2>
              <p className="text-lg text-slate-300">
                Choose your role and unlock unlimited sports opportunities
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* ... (Previous Player/Venue/Coach cards content kept same) ... */}
              {/* Player Card */}
              <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200 flex flex-col">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center mx-auto mb-6">
                  <UserIcon size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Players & Parents
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 flex-grow">
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Book premium venues instantly</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Find & book professional coaches</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Manage kids' sports activities</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Digital QR check-in</span>
                  </li>
                </ul>
                <a
                  href="/register?role=PLAYER"
                  className="inline-block bg-power-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors w-full text-center"
                >
                  Start Booking Now
                </a>
              </div>

              {/* Venue Owner Card - Highlighted */}
              <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow border-2 border-power-orange transform md:scale-105 flex flex-col relative">
                <div className="absolute top-0 right-0 bg-power-orange text-white px-4 py-1 rounded-bl-lg rounded-tr-xl text-xs font-bold">
                  FEATURED
                </div>
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center mx-auto mb-6">
                  <Building2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Venue Owners
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 flex-grow">
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Reach thousands of players</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Automated booking management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Real-time availability tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-power-orange font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Instant payouts & analytics</span>
                  </li>
                </ul>
                <a
                  href="/onboarding"
                  className="inline-block bg-power-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors w-full text-center"
                >
                  List Your Venue
                </a>
              </div>

              {/* Coach Card */}
              <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-slate-200 flex flex-col">
                <div className="w-16 h-16 bg-turf-green text-white rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy size={32} />
                </div>
                <h3 className="text-xl font-bold text-deep-slate mb-4 text-center">
                  Coaches & Trainers
                </h3>
                <ul className="text-sm text-muted-foreground mb-8 space-y-3 flex-grow">
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Build your coaching profile</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Connect with serious athletes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Set your own rates & schedule</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-turf-green font-bold flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>Grow your coaching business</span>
                  </li>
                </ul>
                <a
                  href="/register?role=COACH"
                  className="inline-block bg-turf-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors w-full text-center"
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
      <section className="py-12 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2 text-slate-900">
            Start Exploring
          </h2>
          <p className="text-center text-slate-600 mb-8">
            Browse our listings and find what you need to start playing today
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <a
              href="/venues"
              className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-power-orange rounded-lg p-6 text-center hover:shadow-lg transition-shadow"
            >
              <Building2 size={40} className="mx-auto mb-3 text-power-orange" />
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
              className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-turf-green rounded-lg p-6 text-center hover:shadow-lg transition-shadow"
            >
              <Users size={40} className="mx-auto mb-3 text-turf-green" />
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
            : "Ready to Power Your Sports Experience?"
        }
        description={
          user
            ? "Book a venue or coach now and get back in the game!"
            : "Join thousands of players, venues, and coaches already using PowerMySport. Get started today!"
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

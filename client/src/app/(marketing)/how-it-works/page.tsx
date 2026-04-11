"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { motion } from "framer-motion";
import { CheckCircle, CreditCard, MapPin, Play, UserPlus } from "lucide-react";

const iconMotion = {
  initial: { opacity: 0, y: 12, scale: 0.92 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  whileHover: { scale: 1.08, y: -3, rotate: 2 },
  whileTap: { scale: 0.98 },
};

export default function HowItWorksPage() {
  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="page"
        title="How It Works"
        subtitle="Getting Started"
        description="Simple, straightforward steps to start booking venues and coaches on PowerMySport"
      />

      {/* For Players Journey */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Players
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Book Your Game in 4 Easy Steps
            </h2>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-2 lg:order-1">
                <div className="inline-block bg-power-orange text-white px-4 py-2 rounded-full font-bold mb-4">
                  Step 1
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-deep-slate mb-4">
                  Create Your Account
                </h3>
                <p className="mb-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  Sign up with your email or Google account in under 2 minutes.
                  Choose &quot;Player&quot; as your role to start browsing
                  venues and coaches.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Simple registration with email or Google</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Complete your profile with basic information</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Verify your account via email</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#fff9ef_0%,#fff3db_100%)] p-12 text-center premium-shadow">
                  <motion.div
                    className="mb-4 flex justify-center text-6xl"
                    initial={iconMotion.initial}
                    whileInView={iconMotion.whileInView}
                    whileHover={iconMotion.whileHover}
                    whileTap={iconMotion.whileTap}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <UserPlus size={60} className="text-orange-600" />
                  </motion.div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Account Registration
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-1">
                <div className="rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f4f9ff_0%,#e5f1ff_100%)] p-12 text-center premium-shadow">
                  <motion.div
                    className="mb-4 flex justify-center text-6xl"
                    initial={iconMotion.initial}
                    whileInView={iconMotion.whileInView}
                    whileHover={iconMotion.whileHover}
                    whileTap={iconMotion.whileTap}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <MapPin size={60} className="text-blue-600" />
                  </motion.div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Search & Discover
                  </p>
                </div>
              </div>
              <div className="order-2">
                <div className="inline-block bg-power-orange text-white px-4 py-2 rounded-full font-bold mb-4">
                  Step 2
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-deep-slate mb-4">
                  Find Your Perfect Venue
                </h3>
                <p className="mb-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  Use our powerful search to find venues by sport type,
                  location, date, and time. See photos, amenities, pricing, and
                  user reviews.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Filter by sport, city, and neighborhood</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Check real-time availability</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>View venue details, photos, and amenities</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>See optional coach availability at venues</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-2 lg:order-1">
                <div className="inline-block bg-power-orange text-white px-4 py-2 rounded-full font-bold mb-4">
                  Step 3
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-deep-slate mb-4">
                  Book & Pay Securely
                </h3>
                <p className="mb-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  Select your preferred date and time slot. Add optional coach
                  booking if needed. Complete payment securely through our
                  integrated payment system.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Choose date, time, and duration</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Optionally add coach booking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>See transparent pricing breakdown</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Secure payment with instant confirmation</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f2fff7_0%,#e5f8ef_100%)] p-12 text-center premium-shadow">
                  <motion.div
                    className="mb-4 flex justify-center text-6xl"
                    initial={iconMotion.initial}
                    whileInView={iconMotion.whileInView}
                    whileHover={iconMotion.whileHover}
                    whileTap={iconMotion.whileTap}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CreditCard size={60} className="text-green-600" />
                  </motion.div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Secure Payment
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-1">
                <div className="rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f8f3ff_0%,#f0e8ff_100%)] p-12 text-center premium-shadow">
                  <motion.div
                    className="mb-4 flex justify-center text-6xl"
                    initial={iconMotion.initial}
                    whileInView={iconMotion.whileInView}
                    whileHover={iconMotion.whileHover}
                    whileTap={iconMotion.whileTap}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Play
                      size={60}
                      className="text-purple-600 fill-purple-600"
                    />
                  </motion.div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Play & Enjoy
                  </p>
                </div>
              </div>
              <div className="order-2">
                <div className="inline-block bg-power-orange text-white px-4 py-2 rounded-full font-bold mb-4">
                  Step 4
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-deep-slate mb-4">
                  Check In & Play
                </h3>
                <p className="mb-4 text-base leading-7 text-muted-foreground sm:text-lg">
                  Receive booking confirmation with QR code. Arrive at the venue
                  at your scheduled time, show the QR code, and start playing!
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Receive instant booking confirmation email</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Get QR code for check-in</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Show QR code at venue entrance</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 shrink-0 mt-0.5"
                    />
                    <span>Enjoy your game!</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Venue Owners */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Venue Owners
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              List Your Venue & Start Earning
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  1
                </div>
                <CardTitle className="text-xl mb-3">Submit Inquiry</CardTitle>
                <CardDescription className="text-base">
                  Fill out our simple venue inquiry form with your facility
                  details and contact information.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  2
                </div>
                <CardTitle className="text-xl mb-3">Approval Process</CardTitle>
                <CardDescription className="text-base">
                  Our team reviews your submission and reaches out within 48
                  hours. We verify details and discuss partnership.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  3
                </div>
                <CardTitle className="text-xl mb-3">Go Live</CardTitle>
                <CardDescription className="text-base">
                  Get access to your venue dashboard. Set up slots, pricing, and
                  start accepting bookings immediately.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <a
              href="/onboarding"
              className="inline-block rounded-xl bg-deep-slate px-8 py-4 text-lg font-semibold text-white premium-shadow transition-colors hover:bg-slate-800"
            >
              List Your Venue
            </a>
          </div>
        </div>
      </section>

      {/* For Coaches */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              For Coaches
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Become a Certified Coach
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="text-center rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-md premium-shadow">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-bold text-deep-slate mb-2">Register</h3>
              <p className="text-sm text-muted-foreground">
                Sign up as coach with credentials
              </p>
            </div>

            <div className="text-center rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-md premium-shadow">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-bold text-deep-slate mb-2">Build Profile</h3>
              <p className="text-sm text-muted-foreground">
                Add certifications, experience, rates
              </p>
            </div>

            <div className="text-center rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-md premium-shadow">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                3
              </div>
              <h3 className="font-bold text-deep-slate mb-2">
                Set Availability
              </h3>
              <p className="text-sm text-muted-foreground">
                Define your schedule & service areas
              </p>
            </div>

            <div className="text-center rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-md premium-shadow">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                4
              </div>
              <h3 className="font-bold text-deep-slate mb-2">Get Clients</h3>
              <p className="text-sm text-muted-foreground">
                Accept bookings & start coaching
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a
              href="/register?role=COACH"
              className="inline-block rounded-xl bg-turf-green px-8 py-4 text-lg font-semibold text-white premium-shadow transition-colors hover:bg-green-700"
            >
              Become a Coach
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Common Questions
            </p>
            <h2 className="font-title text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6">
                <CardTitle className="mb-2 text-lg">
                  Can I cancel or reschedule a booking?
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  Yes. Bookings can be cancelled or rescheduled according to the
                  venue&apos;s cancellation policy. Most venues allow free
                  cancellation up to 24 hours before the booking time.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6">
                <CardTitle className="mb-2 text-lg">
                  How does payment work?
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  Payments are processed securely through the platform. If you
                  book a coach with a venue, the payment is split automatically
                  using the agreed rates.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6">
                <CardTitle className="mb-2 text-lg">
                  What if there&apos;s an issue with my booking?
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  Our support team is here to help. Reach out right away if you
                  run into a booking issue, and we&apos;ll work with you and the
                  venue to resolve it quickly.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated" className="shop-surface premium-shadow">
              <CardContent className="pt-6">
                <CardTitle className="mb-2 text-lg">
                  Are the coaches verified?
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  Yes. We review certifications, experience, and background
                  before coaches are approved to offer services on the platform.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Ready to Get Started?"
        description="Join thousands of satisfied users who are already booking with PowerMySport"
        primaryCTA={{
          label: "Create Account",
          href: "/register",
        }}
        secondaryCTA={{
          label: "Contact Support",
          href: "/contact",
        }}
      />
    </main>
  );
}

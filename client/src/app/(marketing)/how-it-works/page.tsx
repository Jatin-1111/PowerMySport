"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { CheckCircle, CreditCard, MapPin, Play, UserPlus } from "lucide-react";

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
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Players
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
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
                <p className="text-lg text-muted-foreground mb-4">
                  Sign up with your email or Google account in under 2 minutes.
                  Choose &quot;Player&quot; as your role to start browsing
                  venues and coaches.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Simple registration with email or Google</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Complete your profile with basic information</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Verify your account via email</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="bg-linear-to-br from-orange-100 to-orange-200 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4 flex justify-center">
                    <UserPlus size={60} className="text-orange-600" />
                  </div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Account Registration
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-1">
                <div className="bg-linear-to-br from-blue-100 to-blue-200 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4 flex justify-center">
                    <MapPin size={60} className="text-blue-600" />
                  </div>
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
                <p className="text-lg text-muted-foreground mb-4">
                  Use our powerful search to find venues by sport type,
                  location, date, and time. See photos, amenities, pricing, and
                  user reviews.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Filter by sport, city, and neighborhood</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Check real-time availability</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>View venue details, photos, and amenities</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
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
                <p className="text-lg text-muted-foreground mb-4">
                  Select your preferred date and time slot. Add optional coach
                  booking if needed. Complete payment securely through our
                  integrated payment system.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Choose date, time, and duration</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Optionally add coach booking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>See transparent pricing breakdown</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Secure payment with instant confirmation</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="bg-linear-to-br from-green-100 to-green-200 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4 flex justify-center">
                    <CreditCard size={60} className="text-green-600" />
                  </div>
                  <p className="text-xl font-semibold text-deep-slate">
                    Secure Payment
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-1">
                <div className="bg-linear-to-br from-purple-100 to-purple-200 rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4 flex justify-center">
                    <Play
                      size={60}
                      className="text-purple-600 fill-purple-600"
                    />
                  </div>
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
                <p className="text-lg text-muted-foreground mb-4">
                  Receive booking confirmation with QR code. Arrive at the venue
                  at your scheduled time, show the QR code, and start playing!
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Receive instant booking confirmation email</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Get QR code for check-in</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
                    />
                    <span>Show QR code at venue entrance</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle
                      size={20}
                      className="text-turf-green mr-2 flex-shrink-0 mt-0.5"
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
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Venue Owners
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              List Your Venue & Start Earning
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card variant="elevated">
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

            <Card variant="elevated">
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

            <Card variant="elevated">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 bg-power-orange text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  3
                </div>
                <CardTitle className="text-xl mb-3">Go Live</CardTitle>
                <CardDescription className="text-base">
                  Get access to your admin dashboard. Set up slots, pricing, and
                  start accepting bookings immediately.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <a
              href="/onboarding"
              className="inline-block bg-deep-slate text-white px-8 py-4 rounded-lg font-semibold hover:bg-slate-800 transition-colors text-lg"
            >
              List Your Venue
            </a>
          </div>
        </div>
      </section>

      {/* For Coaches */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
              For Coaches
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Become a Certified Coach
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-bold text-deep-slate mb-2">Register</h3>
              <p className="text-sm text-muted-foreground">
                Sign up as coach with credentials
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-turf-green text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-bold text-deep-slate mb-2">Build Profile</h3>
              <p className="text-sm text-muted-foreground">
                Add certifications, experience, rates
              </p>
            </div>

            <div className="text-center">
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

            <div className="text-center">
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
              className="inline-block bg-turf-green text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors text-lg"
            >
              Become a Coach
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-slate mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <Card variant="elevated">
              <CardContent className="pt-6">
                <CardTitle className="text-lg mb-2">
                  Can I cancel or reschedule my booking?
                </CardTitle>
                <CardDescription>
                  Yes, bookings can be cancelled or rescheduled according to the
                  venue&apos;s cancellation policy. Most venues allow free
                  cancellation up to 24 hours before the booking time.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="pt-6">
                <CardTitle className="text-lg mb-2">
                  How does payment work?
                </CardTitle>
                <CardDescription>
                  Payments are processed securely through our platform. When you
                  book with a coach, the payment is split automatically between
                  the venue and the coach based on the agreed rates.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="pt-6">
                <CardTitle className="text-lg mb-2">
                  What if there&apos;s an issue with my booking?
                </CardTitle>
                <CardDescription>
                  Our support team is here to help. Contact us immediately if
                  you face any issues with your booking, and we&apos;ll work
                  with you and the venue to resolve it promptly.
                </CardDescription>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="pt-6">
                <CardTitle className="text-lg mb-2">
                  Are the coaches verified?
                </CardTitle>
                <CardDescription>
                  Yes, all coaches on our platform are verified. We check their
                  certifications, experience, and background before approving
                  them to offer coaching services.
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

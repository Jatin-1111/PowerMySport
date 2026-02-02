"use client";

import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold mb-6 text-power-orange">
          Book Sports Venues Near You
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Discover and book badminton courts, cricket grounds, and more in your
          locality
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register?role=user"
            className="bg-power-orange text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md"
          >
            Book Now
          </Link>
          <Link
            href="/register?role=vendor"
            className="bg-deep-slate text-ghost-white px-8 py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-md"
          >
            Become a Vendor
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-8 py-16">
        <div className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-deep-slate">
            🎾 Easy Booking
          </h3>
          <p className="text-muted-foreground">
            Search and book sports venues with just a few clicks
          </p>
        </div>
        <div className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-deep-slate">
            ⏰ Flexible Slots
          </h3>
          <p className="text-muted-foreground">
            Check real-time availability and choose your preferred time
          </p>
        </div>
        <div className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-deep-slate">
            💰 Best Prices
          </h3>
          <p className="text-muted-foreground">
            Competitive pricing and instant confirmation
          </p>
        </div>
      </section>
    </div>
  );
}

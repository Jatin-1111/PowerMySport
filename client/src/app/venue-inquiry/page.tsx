"use client";

import React, { useState } from "react";
import Link from "next/link";
import { venueInquiryApi } from "@/lib/venueInquiry";

export default function VenueInquiryPage() {
  const [formData, setFormData] = useState({
    venueName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    sports: "",
    facilities: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await venueInquiryApi.submitInquiry(formData);
      setSubmitted(true);
    } catch (error: any) {
      console.error("Failed to submit inquiry:", error);
      alert(
        error.response?.data?.message ||
          "Failed to submit inquiry. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-card rounded-lg p-8 border border-border text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-turf-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-deep-slate mb-2">
              Thank You!
            </h2>
            <p className="text-muted-foreground">
              Your inquiry has been submitted successfully.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-foreground mb-2">
              What happens next?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-power-orange">1.</span>
                <span>
                  Our team will review your venue details within 24-48 hours
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-power-orange">2.</span>
                <span>
                  We'll contact you via email/phone to verify your venue
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-power-orange">3.</span>
                <span>
                  After verification, you'll receive login credentials to list
                  your venue
                </span>
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className="block w-full bg-power-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-power-orange font-bold text-2xl">
            PowerMySport
          </Link>
          <h1 className="text-3xl font-bold text-deep-slate mt-6 mb-2">
            List Your Venue
          </h1>
          <p className="text-muted-foreground">
            Fill out the form below and our team will get in touch with you
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-lg p-8 border border-border"
        >
          <div className="space-y-6">
            {/* Venue Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Venue Name *
              </label>
              <input
                type="text"
                name="venueName"
                value={formData.venueName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="e.g., Elite Sports Arena"
              />
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Owner/Manager Name *
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="Your full name"
              />
            </div>

            {/* Contact Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Venue Address *
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="Street address"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="e.g., Mumbai"
              />
            </div>

            {/* Sports */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sports Available *
              </label>
              <input
                type="text"
                name="sports"
                value={formData.sports}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="e.g., Cricket, Football, Badminton"
              />
            </div>

            {/* Facilities */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Facilities & Amenities
              </label>
              <input
                type="text"
                name="facilities"
                value={formData.facilities}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="e.g., Parking, Changing rooms, Cafeteria"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Additional Information
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange bg-card text-foreground"
                placeholder="Tell us more about your venue..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-power-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit Inquiry"}
            </button>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-power-orange hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

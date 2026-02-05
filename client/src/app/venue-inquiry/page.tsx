"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { venueInquiryApi } from "@/lib/venueInquiry";
import Link from "next/link";
import React, { useState } from "react";

export default function VenueInquiryPage() {
  const [formData, setFormData] = useState({
    venueName: "",
    ownerName: "",
    phone: "",
    address: "",
    sports: "",
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">✅</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              Thank You!
            </h2>
            <p className="text-slate-600 text-lg">
              Your inquiry has been submitted successfully.
            </p>
          </div>

          <div className="bg-slate-100 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-slate-900 mb-3 text-lg">
              What happens next?
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <span className="font-bold text-power-orange text-lg">1.</span>
                <span>
                  Our team will review your venue details within 24-48 hours
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold text-power-orange text-lg">2.</span>
                <span>
                  We&apos;ll contact you via email/phone to verify your venue
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold text-power-orange text-lg">3.</span>
                <span>
                  After verification, you&apos;ll receive login credentials to
                  list your venue
                </span>
              </li>
            </ul>
          </div>

          <Link href="/" className="block">
            <Button variant="primary" className="w-full">
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="text-power-orange font-bold text-3xl hover:text-orange-600 transition-colors"
          >
            PowerMySport
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 mt-8 mb-3">
            List Your Venue
          </h1>
          <p className="text-slate-600 text-lg">
            Fill out the form below and our team will get in touch with you
          </p>
        </div>

        {/* Form */}
        <Card>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Venue Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Venue Name *
                </label>
                <input
                  type="text"
                  name="venueName"
                  value={formData.venueName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Elite Sports Arena"
                />
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Owner/Manager Name *
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="Your full name"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Venue Address (including city) *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., 123 Main Street, Andheri, Mumbai, Maharashtra"
                />
              </div>

              {/* Sports */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sports Available *
                </label>
                <input
                  type="text"
                  name="sports"
                  value={formData.sports}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                  placeholder="e.g., Cricket, Football, Badminton"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Information
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all resize-none"
                  placeholder="Tell us more about your venue..."
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                className="w-full"
              >
                {isSubmitting ? "Submitting..." : "Submit Inquiry"}
              </Button>

              <p className="text-sm text-slate-600 text-center">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-power-orange hover:text-orange-600 transition-colors"
                >
                  Login here
                </Link>
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

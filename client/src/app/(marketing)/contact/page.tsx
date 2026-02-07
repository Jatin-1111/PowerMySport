"use client";

import { Hero } from "@/components/marketing/Hero";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
} from "lucide-react";
import React, { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    userType: "player",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission (replace with actual API call)
    setTimeout(() => {
      console.log("Contact form submitted:", formData);
      setSubmitStatus("success");
      setIsSubmitting(false);

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        userType: "player",
      });

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus("idle"), 5000);
    }, 2000);
  };

  return (
    <main>
      {/* Hero Section */}
      <Hero
        variant="page"
        title="Contact Us"
        subtitle="Get in Touch"
        description="Have questions? We're here to help. Reach out to us anytime."
      />

      {/* Contact Form & Info Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <h2 className="text-3xl font-bold text-deep-slate mb-6">
                Send Us a Message
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Fill out the form below and we&apos;ll get back to you within 24
                hours.
              </p>

              {submitStatus === "success" && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✓ Message sent successfully! We&apos;ll be in touch soon.
                  </p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">
                    ✗ Something went wrong. Please try again.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                    placeholder="Enter your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                    placeholder="your.email@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                    placeholder="+91 9876543210"
                  />
                </div>

                {/* User Type */}
                <div>
                  <label
                    htmlFor="userType"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    I am a *
                  </label>
                  <select
                    id="userType"
                    name="userType"
                    value={formData.userType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                  >
                    <option value="player">Player</option>
                    <option value="venue_owner">Venue Owner</option>
                    <option value="coach">Coach</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                    placeholder="What is this regarding?"
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-semibold text-deep-slate mb-2"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="text-3xl font-bold text-deep-slate mb-6">
                Other Ways to Reach Us
              </h2>

              <div className="space-y-6">
                {/* Email */}
                <Card variant="elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <Mail className="h-6 w-6 text-power-orange" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold mb-1">Email</h3>
                        <p className="text-muted-foreground">
                          General Inquiries:{" "}
                          <a
                            href="mailto:hello@powermysport.com"
                            className="text-power-orange hover:underline"
                          >
                            hello@powermysport.com
                          </a>
                        </p>
                        <p className="text-muted-foreground">
                          Support:{" "}
                          <a
                            href="mailto:support@powermysport.com"
                            className="text-power-orange hover:underline"
                          >
                            support@powermysport.com
                          </a>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Phone */}
                <Card variant="elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <Phone className="h-6 w-6 text-power-orange" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold mb-1">Phone</h3>
                        <p className="text-muted-foreground">
                          Customer Support:{" "}
                          <a
                            href="tel:+911234567890"
                            className="text-power-orange hover:underline"
                          >
                            +91 123 456 7890
                          </a>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Mon-Sat: 9 AM - 8 PM IST
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address */}
                <Card variant="elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <MapPin className="h-6 w-6 text-power-orange" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold mb-1">
                          Office Address
                        </h3>
                        <p className="text-muted-foreground">
                          PowerMySport Technologies Pvt. Ltd.
                          <br />
                          123 Sports Complex, MG Road
                          <br />
                          Bengaluru, Karnataka 560001
                          <br />
                          India
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Social Media */}
                <Card variant="elevated">
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                    <div className="flex space-x-4">
                      <a
                        href="#"
                        className="text-power-orange hover:text-orange-600 transition-colors"
                        aria-label="Facebook"
                      >
                        <Facebook className="h-8 w-8" />
                      </a>
                      <a
                        href="#"
                        className="text-power-orange hover:text-orange-600 transition-colors"
                        aria-label="Instagram"
                      >
                        <Instagram className="h-8 w-8" />
                      </a>
                      <a
                        href="#"
                        className="text-power-orange hover:text-orange-600 transition-colors"
                        aria-label="Twitter"
                      >
                        <Twitter className="h-8 w-8" />
                      </a>
                      <a
                        href="#"
                        className="text-power-orange hover:text-orange-600 transition-colors"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="h-8 w-8" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map or Additional Info Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-deep-slate mb-4">
              We&apos;re Here to Help
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Whether you&apos;re a player looking to book a venue, a venue
              owner wanting to list your facility, or a coach seeking to expand
              your practice, we&apos;re just a message away. Our team typically
              responds within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/register"
                className="inline-block bg-power-orange text-white px-8 py-4 rounded-lg font-semibold hover:bg-orange-600 transition-colors text-lg"
              >
                Get Started
              </a>
              <a
                href="/help"
                className="inline-block bg-white border-2 border-deep-slate text-deep-slate px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-lg"
              >
                Visit Help Center
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}



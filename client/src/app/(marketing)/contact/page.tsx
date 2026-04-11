"use client";

import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { motion } from "framer-motion";
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

const iconMotion = {
  initial: { opacity: 0, y: 10, scale: 0.92 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  whileHover: { scale: 1.08, y: -2, rotate: 2 },
  whileTap: { scale: 0.98 },
};

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
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="shop-surface rounded-2xl p-8 premium-shadow">
              <h2 className="font-title text-3xl font-bold text-deep-slate mb-6">
                Send Us a Message
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Fill out the form below and we&apos;ll get back to you within 24
                hours.
              </p>

              {submitStatus === "success" && (
                <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-green-800 font-medium">
                    Message sent successfully. We&apos;ll be in touch soon.
                  </p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-red-800 font-medium">
                    Something went wrong. Please try again.
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
                    className="w-full resize-none rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-power-orange"
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
              <h2 className="font-title text-3xl font-bold text-deep-slate mb-6">
                Other Ways to Reach Us
              </h2>

              <div className="space-y-6">
                {/* Email */}
                <Card
                  variant="elevated"
                  className="shop-surface premium-shadow"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <motion.div
                        className="shrink-0 origin-center will-change-transform"
                        initial={iconMotion.initial}
                        whileInView={iconMotion.whileInView}
                        whileHover={iconMotion.whileHover}
                        whileTap={iconMotion.whileTap}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <Mail className="h-6 w-6 text-power-orange" />
                      </motion.div>
                      <div className="ml-4">
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">
                          Email
                        </h3>
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
                <Card
                  variant="elevated"
                  className="shop-surface premium-shadow"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <motion.div
                        className="shrink-0 origin-center will-change-transform"
                        initial={iconMotion.initial}
                        whileInView={iconMotion.whileInView}
                        whileHover={iconMotion.whileHover}
                        whileTap={iconMotion.whileTap}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <Phone className="h-6 w-6 text-power-orange" />
                      </motion.div>
                      <div className="ml-4">
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">
                          Phone
                        </h3>
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
                <Card
                  variant="elevated"
                  className="shop-surface premium-shadow"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start">
                      <motion.div
                        className="shrink-0 origin-center will-change-transform"
                        initial={iconMotion.initial}
                        whileInView={iconMotion.whileInView}
                        whileHover={iconMotion.whileHover}
                        whileTap={iconMotion.whileTap}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <MapPin className="h-6 w-6 text-power-orange" />
                      </motion.div>
                      <div className="ml-4">
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">
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
                <Card
                  variant="elevated"
                  className="shop-surface premium-shadow"
                >
                  <CardContent className="pt-6">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                      Follow Us
                    </h3>
                    <div className="flex space-x-4">
                      <motion.a
                        href="#"
                        className="text-power-orange transition-colors"
                        aria-label="Facebook"
                        whileHover={{ y: -2, scale: 1.08 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <Facebook className="h-8 w-8" />
                      </motion.a>
                      <motion.a
                        href="#"
                        className="text-power-orange transition-colors"
                        aria-label="Instagram"
                        whileHover={{ y: -2, scale: 1.08 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <Instagram className="h-8 w-8" />
                      </motion.a>
                      <motion.a
                        href="#"
                        className="text-power-orange transition-colors"
                        aria-label="Twitter"
                        whileHover={{ y: -2, scale: 1.08 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <Twitter className="h-8 w-8" />
                      </motion.a>
                      <motion.a
                        href="#"
                        className="text-power-orange transition-colors"
                        aria-label="LinkedIn"
                        whileHover={{ y: -2, scale: 1.08 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      >
                        <Linkedin className="h-8 w-8" />
                      </motion.a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map or Additional Info Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-title text-3xl font-bold text-deep-slate mb-4">
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
                className="inline-block rounded-xl bg-power-orange px-8 py-4 text-lg font-semibold text-white premium-shadow transition-colors hover:bg-orange-600"
              >
                Get Started
              </a>
              <a
                href="/help"
                className="inline-block rounded-xl border-2 border-deep-slate bg-white px-8 py-4 text-lg font-semibold text-deep-slate premium-shadow transition-colors hover:bg-gray-50"
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

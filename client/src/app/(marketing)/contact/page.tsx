"use client";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { DirectContact } from "@/modules/marketing/components/contact/DirectContact";
import {
  CustomSelect,
  Field,
  type SelectOption,
} from "@/modules/marketing/components/contact/FormControls";
import { Button } from "@/modules/shared/ui/Button";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Award, Building2, Check, HelpCircle, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const SUBJECT_OPTIONS = [
  "General enquiry",
  "Partnership",
  "Billing and payments",
  "Technical support",
];

const USER_TYPE_OPTIONS: SelectOption[] = [
  { value: "player", label: "Player", icon: UserRound },
  { value: "venue_owner", label: "Venue Owner", icon: Building2 },
  { value: "coach", label: "Coach", icon: Award },
  { value: "other", label: "Other", icon: HelpCircle },
];

const TEXTAREA =
  "border-hairline text-ink placeholder:text-ink-muted focus:border-ink focus:ring-ink w-full resize-none rounded-lg border bg-white px-4 py-3 transition-colors duration-300 focus:outline-none focus:ring-1";

const QUICK_LINK =
  "text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink group inline-flex items-center gap-1.5 rounded font-medium underline underline-offset-[6px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2";

const ARROW =
  "h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 motion-reduce:transition-none";

export default function ContactPage() {
  const [initialSubject, setInitialSubject] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: initialSubject,
    message: "",
    userType: "player",
  });

  // Reading window.location must wait for this client-only effect to avoid
  // an SSR/CSR mismatch, so formData's useState initializer above always
  // captures "" on the first render — without also syncing formData.subject
  // here, a deep link like /contact?subject=Partnership never actually
  // prefilled the form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subjectFromUrl = params.get("subject") || "";
    setInitialSubject(subjectFromUrl);
    if (subjectFromUrl) {
      setFormData((prev) => ({ ...prev, subject: subjectFromUrl }));
    }
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  // The button's own confirmation: a check and "Sent" for a few seconds after a
  // successful submit, then back to normal. The banner above says the rest.
  const [justSent, setJustSent] = useState(false);
  useEffect(() => {
    if (!justSent) return;
    const timer = window.setTimeout(() => setJustSent(false), 3000);
    return () => window.clearTimeout(timer);
  }, [justSent]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The button stays clickable while sending (it would dim if disabled), so
    // a second click is ignored here instead.
    if (isSubmitting) return;

    if (!formData.subject) {
      toast.error("Please select a subject.");
      return;
    }

    setIsSubmitting(true);

    try {
      await axiosInstance.post("/support-tickets/public", {
        requesterName: formData.name,
        requesterEmail: formData.email,
        requesterPhone: formData.phone,
        requesterType: formData.userType,
        subject: formData.subject,
        description: formData.message,
        category: "OTHER",
        priority: "MEDIUM",
      });

      setSubmitStatus("success");
      setJustSent(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: initialSubject,
        message: "",
        userType: "player",
      });
      toast.success("Your message has been sent.");
    } catch (error) {
      console.error("Contact form submission failed:", error);
      setSubmitStatus("error");
      setJustSent(false);
      toast.error("Failed to send message. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // `overflow-x-clip`, not `overflow-x-hidden`: hidden makes <main> a scroll
    // container that never scrolls, and the `.reveal-on-scroll` view timelines
    // inside then track it instead of the page, freezing part-way transparent.
    <main className="overflow-x-clip">
      <PageHeader
        eyebrow="Get in touch"
        title="Contact us"
        description="Questions about a pathway, a tournament or your account? Send us a message, call, or chat on WhatsApp."
        width="7xl"
        size="compact"
      />

      <section className="bg-paper py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal-on-scroll grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
            <div className="border-hairline rounded-xl border bg-white p-6 shadow-[0_18px_40px_-30px_rgba(57,34,30,0.3)] sm:p-8">
              <h2 className="font-editorial text-ink mb-6 text-3xl font-light">
                Send us a message
              </h2>

              <AnimatePresence>
                {submitStatus === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -12, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="mb-5 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <Check aria-hidden className="h-4 w-4 shrink-0" />
                      Message sent. We&apos;ll be in touch within 24 hours.
                    </p>
                  </motion.div>
                )}
                {submitStatus === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -12, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="mb-5 overflow-hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-red-800">
                      Something went wrong. Please try again.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Full Name"
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Your name"
                  />
                  <Field
                    label="Email Address"
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="you@example.com"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Phone Number"
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    optional
                    placeholder="+91 98765 43210"
                  />
                  <CustomSelect
                    id="userType"
                    label="I am a"
                    required
                    placeholder="Select an option"
                    value={formData.userType}
                    options={USER_TYPE_OPTIONS}
                    onChange={(value) => setFormData((prev) => ({ ...prev, userType: value }))}
                  />
                </div>

                <CustomSelect
                  id="subject"
                  label="Subject"
                  required
                  placeholder="Select a subject"
                  value={formData.subject}
                  options={SUBJECT_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                  onChange={(value) => setFormData((prev) => ({ ...prev, subject: value }))}
                />

                <div>
                  <label htmlFor="message" className="text-ink mb-1.5 block text-sm font-medium">
                    Message <span className="text-power-orange-solid">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    className={TEXTAREA}
                    placeholder="Tell us about your inquiry..."
                  />
                </div>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-5">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    aria-disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className={
                      justSent
                        ? "w-full bg-emerald-700 hover:bg-emerald-700 focus-visible:ring-emerald-700 sm:w-auto sm:px-8"
                        : cn("w-full sm:w-auto sm:px-8", isSubmitting && "cursor-wait")
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
                        Sending…
                      </>
                    ) : justSent ? (
                      <>
                        <Check aria-hidden className="h-5 w-5" />
                        Sent
                      </>
                    ) : (
                      <>
                        Send Message
                        <ArrowRight aria-hidden className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-ink-muted text-sm">We reply within 24 hours.</p>
                </div>
              </form>
            </div>

            <DirectContact />
          </div>

          {/* The form and the panel do the page's job, so what follows is one line pointing
              at the quick answers, not a second full-width call to action. */}
          <div className="border-hairline mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t pt-6">
            <p className="text-ink-body">Looking for a quick answer first?</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/faq" className={QUICK_LINK}>
                Browse the FAQ
                <ArrowRight aria-hidden strokeWidth={1.5} className={ARROW} />
              </Link>
              <Link href="/how-it-works" className={QUICK_LINK}>
                See how it works
                <ArrowRight aria-hidden strokeWidth={1.5} className={ARROW} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

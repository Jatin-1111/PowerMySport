"use client";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { Button } from "@/modules/shared/ui/Button";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import {
  Award,
  Building2,
  Check,
  ChevronDown,
  HelpCircle,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

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

// Unsplash image sources — sports/fitness/stadium themed
const SPORT_IMG_3 =
  "https://images.unsplash.com/photo-1544216717-3bbf52512659?auto=format&fit=crop&w=600&q=80";

// ─── Motion Variants ──────────────────────────────────────────────────────────

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.08,
    },
  },
};

const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

const fadeSlideLeft: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 240, damping: 26 },
  },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 22 },
  },
};

const iconPop = {
  initial: { opacity: 0, scale: 0.7, rotate: -12 },
  whileInView: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 18 },
  },
  whileHover: { scale: 1.18, rotate: 6 },
  whileTap: { scale: 0.94 },
};

// ─── Decorative Geometry SVG ──────────────────────────────────────────────────

function FloatingDots() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 h-64 w-64 opacity-30"
      viewBox="0 0 200 200"
    >
      {Array.from({ length: 36 }).map((_, i) => {
        const x = (i % 6) * 34 + 10;
        const y = Math.floor(i / 6) * 34 + 10;
        return (
          <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" className="text-orange-400" />
        );
      })}
    </svg>
  );
}

function WaveDivider() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      className="h-12 w-full text-white"
      fill="currentColor"
    >
      <path d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z" />
    </svg>
  );
}

function SkewedAccent() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1/4 -left-12 h-80 w-[120%] -rotate-[6deg] rounded-3xl bg-gradient-to-r from-orange-500/8 via-amber-400/6 to-transparent"
    />
  );
}

// ─── Clipped Image Frame Component ───────────────────────────────────────────

interface ClippedFrameProps {
  src: string;
  alt: string;
  clipVariant?: "parallelogram" | "hexTilt" | "trapezoid";
  className?: string;
  width?: number;
  height?: number;
}

function ClippedFrame({
  src,
  alt,
  clipVariant = "parallelogram",
  className = "",
  width = 600,
  height = 500,
}: ClippedFrameProps) {
  const clips: Record<string, string> = {
    parallelogram: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
    hexTilt: "polygon(12% 0%, 88% 0%, 100% 50%, 88% 100%, 12% 100%, 0% 50%)",
    trapezoid: "polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)",
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ clipPath: clips[clipVariant] }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-full object-cover"
        priority={false}
        unoptimized
      />
      {/* Colour-wash overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-transparent to-slate-900/30" />
    </div>
  );
}

// ─── Geometric Overlay Backdrop ───────────────────────────────────────────────

// ─── Info Card Component ───────────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function InfoCard({ icon: Icon, title, children }: InfoCardProps) {
  return (
    <motion.div
      variants={fadeSlideUp}
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className="group flex items-start gap-5 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md will-change-transform"
      style={{
        boxShadow: "0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <motion.div
        className="text-power-orange flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-50"
        initial={iconPop.initial}
        whileInView={iconPop.whileInView}
        whileHover={iconPop.whileHover}
        whileTap={iconPop.whileTap}
        viewport={{ once: true }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </motion.div>
      <div>
        <h3 className="mb-1 text-base font-bold text-slate-900">{title}</h3>
        {children}
      </div>
    </motion.div>
  );
}

// ─── Social Row ────────────────────────────────────────────────────────────────

const SOCIALS = [
  { Icon: Instagram, label: "Instagram", href: "https://www.instagram.com/powermysport" },
  { Icon: Linkedin, label: "LinkedIn", href: "#" },
] as const;

// ─── Form Field ────────────────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
}

function Field({ label, id, required, ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">
        {label} {required && <span className="text-power-orange">*</span>}
      </label>
      <input
        id={id}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-slate-900 transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-400/25 focus:outline-none"
        {...props}
      />
    </div>
  );
}

// ─── Custom Select ─────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface CustomSelectProps {
  id: string;
  label: string;
  required?: boolean;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

function CustomSelect({
  id,
  label,
  required,
  placeholder,
  value,
  options,
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeaheadRef = useRef({ buffer: "", lastTime: 0 });

  const close = (refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
    optionRefs.current[focusIndex]?.focus();
  }, [open, options, value]);

  const focusOption = (index: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    optionRefs.current[clamped]?.focus();
  };

  const selectOption = (opt: SelectOption) => {
    onChange(opt.value);
    close(true);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleOptionKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    opt: SelectOption
  ) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusOption(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusOption(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusOption(0);
        break;
      case "End":
        e.preventDefault();
        focusOption(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectOption(opt);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const now = Date.now();
          const buf =
            now - typeaheadRef.current.lastTime < 600
              ? typeaheadRef.current.buffer + e.key.toLowerCase()
              : e.key.toLowerCase();
          typeaheadRef.current = { buffer: buf, lastTime: now };
          const match = options.findIndex((o) => o.label.toLowerCase().startsWith(buf));
          if (match >= 0) focusOption(match);
        }
    }
  };

  const selected = options.find((opt) => opt.value === value);
  const SelectedIcon = selected?.icon;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">
        {label} {required && <span className="text-power-orange">*</span>}
      </label>

      <motion.button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        whileTap={{ scale: 0.985 }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white/60 px-4 py-3 text-left text-sm shadow-sm transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-orange-400/25 focus:outline-none ${
          open
            ? "border-orange-400 bg-white ring-2 ring-orange-400/25"
            : "border-slate-200 hover:border-orange-300 hover:shadow-md"
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          {SelectedIcon && (
            <span className="text-power-orange flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50">
              <SelectedIcon className="h-4 w-4" strokeWidth={2} />
            </span>
          )}
          <span className={selected ? "font-medium text-slate-900" : "text-slate-400"}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "text-power-orange rotate-180" : ""
          }`}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-labelledby={id}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{ originY: 0 }}
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-900/10"
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === value;
              const OptIcon = opt.icon;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => selectOption(opt)}
                    onKeyDown={(e) => handleOptionKeyDown(e, index, opt)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:bg-orange-50/70 focus-visible:ring-2 focus-visible:ring-orange-400/40 ${
                      isSelected
                        ? "text-power-orange bg-orange-50 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {OptIcon && (
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isSelected ? "text-power-orange bg-white" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <OptIcon className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [initialSubject, setInitialSubject] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInitialSubject(params.get("subject") || "");
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: initialSubject,
    message: "",
    userType: "player",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      toast.error("Failed to send message. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero Section ── */}
      <Hero
        variant="page"
        title="Contact Us"
        subtitle="Get in Touch"
        description="Have questions? We're here to help. Reach out to us anytime."
      />
      {/* ── Main Contact Section ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white py-16 sm:py-24 lg:py-32">
        {/* ── Background ambient blobs ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-24 -left-32 h-[500px] w-[500px] rounded-full bg-orange-100/40 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 bottom-24 h-[400px] w-[400px] rounded-full bg-sky-100/30 blur-[80px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-100/20 blur-[60px]"
        />

        {/* ── Dot grid pattern ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px] lg:gap-16 xl:grid-cols-[1fr_460px]"
          >
            {/* ── LEFT COLUMN: Form ─────────────────────────────────────────── */}
            <motion.div variants={fadeSlideUp} className="relative z-10">
              {/* Floating geometric backdrop behind card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-orange-50/80 via-white/20 to-transparent"
              />
              <SkewedAccent />

              <div
                className="relative rounded-[2rem] border border-white/80 bg-white/85 px-5 py-8 shadow-sm backdrop-blur-md sm:px-10 sm:py-12"
                style={{
                  boxShadow:
                    "0 4px 40px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}
              >
                {/* Floating dots decorative element */}
                <FloatingDots />

                {/* Pill label */}
                <motion.div variants={scaleIn} className="mb-4 inline-block">
                  <SectionLabel label="Send a message" color="orange" />
                </motion.div>

                <motion.h2
                  variants={fadeSlideUp}
                  className="mb-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl"
                >
                  How can we{" "}
                  <span className="relative inline-block">
                    help?
                    {/* Underline squiggle */}
                    <svg
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-0 w-full"
                      viewBox="0 0 100 8"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M0,5 Q25,0 50,5 Q75,10 100,5"
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </motion.h2>

                <motion.p
                  variants={fadeSlideUp}
                  className="mb-8 text-base leading-relaxed text-slate-500"
                >
                  Fill out the form below and we&apos;ll get back to you within 24 hours.
                </motion.p>

                {/* Status banners */}
                <AnimatePresence>
                  {submitStatus === "success" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: -12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="mb-6 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-emerald-800">
                        ✓ Message sent — we&apos;ll be in touch within 24 hours.
                      </p>
                    </motion.div>
                  )}
                  {submitStatus === "error" && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: -12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="mb-6 overflow-hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-red-800">
                        Something went wrong. Please try again.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Row: Name + Email */}
                  <motion.div
                    variants={fadeSlideUp}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2"
                  >
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
                      placeholder="your@gmail.com"
                    />
                  </motion.div>

                  {/* Row: Phone + User Type */}
                  <motion.div
                    variants={fadeSlideUp}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2"
                  >
                    <Field
                      label="Phone Number"
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 9876543210"
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
                  </motion.div>

                  {/* Subject */}
                  <motion.div variants={fadeSlideUp}>
                    <CustomSelect
                      id="subject"
                      label="Subject"
                      required
                      placeholder="Select a subject"
                      value={formData.subject}
                      options={SUBJECT_OPTIONS.map((opt) => ({
                        value: opt,
                        label: opt,
                      }))}
                      onChange={(value) => setFormData((prev) => ({ ...prev, subject: value }))}
                    />
                  </motion.div>

                  {/* Message */}
                  <motion.div variants={fadeSlideUp}>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-semibold text-slate-800"
                    >
                      Message <span className="text-power-orange">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-slate-900 transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-400/25 focus:outline-none"
                      placeholder="Tell us about your inquiry..."
                    />
                  </motion.div>

                  {/* Submit */}
                  <motion.div variants={fadeSlideUp}>
                    <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.975 }}>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full rounded-xl"
                        loading={isSubmitting}
                      >
                        {isSubmitting ? "Sending…" : "Send Message →"}
                      </Button>
                    </motion.div>
                  </motion.div>
                </form>
              </div>
            </motion.div>

            {/* ── RIGHT COLUMN: Info + Image ───────────────────────────────── */}
            <motion.div variants={staggerContainer} className="flex flex-col gap-5 lg:pt-2">
              {/* Section header */}
              <motion.div variants={fadeSlideLeft}>
                <SectionLabel label="Reach us directly" color="slate" />
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  Other ways to reach us
                </h2>
              </motion.div>

              {/* Clipped sport image with overlapping badge */}
              <motion.div
                variants={scaleIn}
                className="relative h-36 w-full overflow-hidden rounded-2xl sm:h-44"
              >
                <ClippedFrame
                  src={SPORT_IMG_3}
                  alt="Outdoor sports court"
                  clipVariant="parallelogram"
                  className="h-full w-full"
                  width={500}
                  height={220}
                />
                {/* Floating glass badge */}
                <div className="absolute bottom-4 left-5 flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg backdrop-blur-md">
                  <span className="bg-turf-green h-2 w-2 animate-pulse rounded-full" />
                  Support team online
                </div>
                {/* Geo accent */}
                <div
                  aria-hidden="true"
                  className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-orange-400/30 blur-2xl"
                />
              </motion.div>

              {/* Email */}
              <InfoCard icon={Mail} title="Email">
                <a
                  href="mailto:teams@powermysport.com"
                  className="hover:text-power-orange text-sm text-slate-600 transition-colors"
                >
                  teams@powermysport.com
                </a>
              </InfoCard>

              {/* Phone */}
              <InfoCard icon={Phone} title="Phone">
                <a
                  href="tel:+918968582443"
                  className="hover:text-power-orange text-sm text-slate-600 transition-colors"
                >
                  +91 89685 82443
                </a>
                <p className="mt-0.5 text-xs text-slate-400">Mon–Sat: 9 AM – 8 PM IST</p>
              </InfoCard>

              {/* WhatsApp */}
              <InfoCard icon={WhatsAppIcon} title="WhatsApp">
                <a
                  href={`https://wa.me/918968582443?text=${encodeURIComponent("Hi! I have a question about PowerMySport.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-power-orange text-sm text-slate-600 transition-colors"
                >
                  Chat with us on WhatsApp →
                </a>
                <p className="mt-0.5 text-xs text-slate-400">Usually replies within minutes</p>
              </InfoCard>

              {/* Address */}
              <InfoCard icon={MapPin} title="Office Address">
                <p className="text-sm leading-relaxed text-slate-600">
                  Powermysport PVT. LTD.
                  <br />
                  Mullanpur, Punjab.
                </p>
              </InfoCard>

              {/* Social */}
              <motion.div
                variants={fadeSlideUp}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md"
                style={{
                  boxShadow: "0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <h3 className="mb-4 text-base font-bold text-slate-900">Follow Us</h3>
                <div className="flex gap-3">
                  {SOCIALS.map(({ Icon, label, href }) => (
                    <motion.a
                      key={label}
                      href={href}
                      aria-label={label}
                      className="hover:bg-power-orange flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:text-white"
                      whileHover={{ scale: 1.12, rotate: 7 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 16,
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Wave Divider into CTA ─────────────────────────────────────────────── */}
      <div className="relative z-10 -mb-1 text-slate-900/4">
        <WaveDivider />
      </div>

      {/* ── CTA Section ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 py-16 sm:py-24">
        {/* Background radial burst */}
        <div
          aria-hidden="true"
          className="bg-power-orange/10 pointer-events-none absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-[100px]"
        />

        {/* Diagonal stripe overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
          >
            <motion.div variants={scaleIn} className="mb-4 inline-flex">
              <span className="border-power-orange/40 bg-power-orange/10 rounded-full border px-4 py-1.5 text-xs font-bold tracking-widest text-orange-400 uppercase">
                Ready to play?
              </span>
            </motion.div>

            <motion.h2
              variants={fadeSlideUp}
              className="font-title mb-5 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              We&apos;re here to help
            </motion.h2>

            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg"
            >
              Whether you&apos;re a parent planning your child&apos;s sports journey, a venue owner
              listing your facility, or a coach expanding your practice — we&apos;re just a message
              away. Our team typically responds within 24 hours.
            </motion.p>

            <motion.div
              variants={fadeSlideUp}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <motion.a
                href="/register"
                className="bg-power-orange inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-xl hover:shadow-orange-500/30"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Get Started
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </motion.a>

              <motion.a
                href="/faq"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Browse FAQs
              </motion.a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { TestimonialSpotlight } from "@/modules/marketing/components/marketing/TestimonialSpotlight";
import { parentTestimonials } from "@/modules/marketing/data/testimonials";
import { motion, Variants } from "framer-motion";

const SPRING_STIFF = { type: "spring", stiffness: 260, damping: 22 } as const;

const orchestrator: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: SPRING_STIFF },
};

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_STIFF },
};

export function AboutPageContent() {
  // Core values updated for Parent-Centric approach
  const values = [
    {
      title: "Clear Answers for Parents",
      description:
        "We put parents first by replacing confusion with clear, easy-to-follow steps for your child's sports journey.",
      icon: FeatureIcons.Users,
    },
    {
      title: "One Plan, Not Ten Tabs",
      description:
        "Your child's roadmap, guidance, and next steps live in one simple place—so you stop juggling notes, groups, and phone calls.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Honest and Realistic",
      description:
        "We tell you what a sport really takes—time, cost, and effort—so you can decide with confidence, not on a hunch.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Built for Everyday Parents",
      description:
        "No jargon, no pressure. Just simple guidance any parent can act on, whether or not they grew up playing sport.",
      icon: FeatureIcons.Star,
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* Hero Section */}
      <Hero
        variant="page"
        title="About PowerMySport"
        subtitle="Our Story"
        description="We want to make sports simple for parents. We remove the confusion of finding coaches, booking venues, and planning your child's sports journey."
      />

      {/* Mission Section */}
      <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden">
        {/* Ambient background blobs for premium feel */}
        <div className="pointer-events-none absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-100/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-emerald-100/30 blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
          >
            <div>
              <motion.h2
                variants={fadeUp}
                className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-8"
              >
                Our Mission
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="space-y-6 text-lg text-slate-600"
              >
                <p>
                  PowerMySport started because we saw how challenging youth
                  sports is for parents.{" "}
                  <span className="font-semibold text-power-orange">
                    You&apos;re doing all the hard work
                  </span>
                  —trying to pick the right sport, find the next step, and just
                  guessing whether you&apos;re making the right call.
                </p>
                <p>
                  So we started with the hardest part: the plan. Tell us about
                  your child and you get a{" "}
                  <span className="font-semibold text-emerald-600">
                    clear, personalised roadmap
                  </span>{" "}
                  plus expert and AI guidance—free, and live today. No
                  guesswork, no jargon.
                </p>
                <p>
                  And we&apos;re just getting started. We&apos;re building
                  PowerMySport in phases—community, booking, and a gear shop are
                  all on the way—so every part is genuinely useful the day it
                  lands.
                </p>
              </motion.div>
            </div>

            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden shadow-2xl premium-shadow h-[400px] lg:h-[500px]"
            >
              <img
                src="https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=1200&q=80"
                alt="Kids playing sports"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Core Values */}
      <Features
        title="Our Core Values"
        subtitle="What Drives Us"
        description="These principles guide everything we do at PowerMySport to support parents."
        features={values}
        columns={2}
        variant="centered"
      />

      {/* Testimonial Spotlight */}
      <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[120%] -translate-x-1/2 bg-gradient-to-b from-orange-50/40 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 flex justify-center"
          >
            <SectionLabel label="Hear From Parents" color="orange" />
          </motion.div>
          <TestimonialSpotlight testimonials={parentTestimonials} />
        </div>
      </section>

      {/* Team Section */}
      <section className="relative py-16 sm:py-20 lg:py-28 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-bold text-power-orange uppercase tracking-widest mb-3"
            >
              The Team
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            >
              Built by Sports Enthusiasts
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-slate-600 max-w-2xl mx-auto"
            >
              Our team combines deep sports industry knowledge with technical
              expertise to create the ultimate sports ecosystem for parents and
              athletes.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {[
              {
                name: "Jatin",
                role: "Full Stack Web Dev & DevOps",
                desc: "Driving core development, AWS infrastructure, and CI/CD.",
              },
              {
                name: "Rakshak Phogat",
                role: "Full Stack Web Dev",
                desc: "Building robust web features and seamless user interfaces.",
              },
              {
                name: "Vanshika Narang",
                role: "Full Stack Web Dev & DevOps",
                desc: "Powering full stack architecture and reliable deployments.",
              },
            ].map((member, i) => (
              <motion.div
                key={i}
                variants={cardReveal}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={SPRING_STIFF}
                className="group relative bg-white/80 border border-white/70 backdrop-blur-md premium-shadow rounded-3xl p-8 text-center transition-all hover:border-white/90"
              >
                <div className="w-28 h-28 mx-auto rounded-full shadow-lg overflow-hidden mb-6 transform group-hover:scale-110 transition-transform duration-300 ring-4 ring-white bg-slate-100 flex items-center justify-center">
                  <span className="text-5xl font-bold text-power-orange">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {member.name}
                </h3>
                <p className="text-sm font-semibold text-power-orange mb-3">
                  {member.role}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {member.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="relative py-16 sm:py-20 lg:py-28 overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-50/50 to-transparent blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestrator}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <motion.h2
                variants={fadeUp}
                className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-6"
              >
                Our Vision for the Future
              </motion.h2>
              <motion.div
                variants={fadeUp}
                className="space-y-6 text-lg text-slate-600"
              >
                <p>
                  We envision a future where navigating a child&apos;s sports
                  journey is as clear and organized as their academic journey. A
                  world where every neighborhood has accessible, affordable
                  sports facilities, and every athlete has access to quality
                  coaching.
                </p>
                <p>
                  We&apos;re expanding the platform to cover more sports, more
                  service types, and better AI tools to surface community
                  knowledge so parents can find the right fit faster.
                </p>
                <p>
                  Join us on this journey to make it easier for every sports
                  family to share what works, what doesn&apos;t, and where the
                  best experiences are happening.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mt-8 rounded-2xl overflow-hidden shadow-xl premium-shadow h-48 relative"
              >
                <img
                  src="https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1200&q=80"
                  alt="Sports field"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-power-orange/10 mix-blend-multiply" />
              </motion.div>
            </div>

            <div className="space-y-6">
              {[
                {
                  title: "More sports, same community",
                  desc: "Extending the platform across additional sports while keeping the same shared discussion and recommendation layer.",
                  color: "border-orange-200 bg-orange-50/30",
                },
                {
                  title: "AI-Powered Guidance",
                  desc: "Using community feedback and performance data to generate personalized athletic roadmaps for every child.",
                  color: "border-emerald-200 bg-emerald-50/30",
                },
                {
                  title: "A unified sports network",
                  desc: "Building a reliable network where conversations, reviews, and bookings reinforce each other instead of living in fragmented silos.",
                  color: "border-indigo-200 bg-indigo-50/30",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  variants={cardReveal}
                  whileHover={{ x: 8 }}
                  transition={SPRING_STIFF}
                  className={`border-l-4 ${card.color.split(" ")[0]} bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl p-6 hover:shadow-md transition-shadow border-y border-r border-slate-100`}
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {card.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <CTA
        variant="gradient"
        title="Start your child's plan today"
        description="See what PowerMySport can do right now. Build a personalised roadmap and get expert guidance for your child—free, in just a few minutes."
        primaryCTA={{
          label: "Build a Sports Plan",
          href: "/roadmap",
        }}
        secondaryCTA={{
          label: "Contact Us",
          href: "/contact",
        }}
      />
    </main>
  );
}

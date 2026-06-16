"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { getCommunityAppUrl } from "@/lib/community/url";
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
  const communityUrl = getCommunityAppUrl();

  // Core values updated for Parent-Centric approach
  const values = [
    {
      title: "Parent-Centric Clarity",
      description:
        "We put parents first by replacing confusion with clear, actionable roadmaps for their child's athletic journey.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Unified Ecosystem",
      description:
        "Bringing venues, coaches, and academies into one seamless platform, eliminating the fragmented booking struggle.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Verified Quality",
      description:
        "Every coach and academy is vetted, ensuring you only invest your time and money into trusted sports professionals.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Community Wisdom",
      description:
        "Leveraging the collective experience of other sports parents to help you make smarter, faster decisions.",
      icon: FeatureIcons.Star,
    },
  ];

  const communityFeatures = [
    {
      title: "Shared answers",
      description:
        "Parents and coaches can ask practical questions and get context from people who have successfully navigated the system.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Local trust signals",
      description:
        "Honest reviews and recommendations surface which academies and coaches actually deliver real results.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Connected ecosystem",
      description:
        "Bookings, discussion, and verified pathways sit together so the community can influence every crucial decision.",
      icon: FeatureIcons.Calendar,
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* Hero Section */}
      <Hero
        variant="page"
        title="About PowerMySport"
        subtitle="Our Story"
        description="We're on a mission to organize the unorganized sports sector. We solve the biggest problem for parents by providing a clear, dependable pathway for their child's athletic journey."
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
              <motion.h2 variants={fadeUp} className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-8">
                Our Mission
              </motion.h2>
              
              <motion.div variants={fadeUp} className="space-y-6 text-lg text-slate-600">
                <p>
                  PowerMySport was born from a simple observation: the sports sector is fundamentally unorganized, and <span className="font-semibold text-power-orange">parents bear the brunt of it</span>. We saw parents struggling to find credible coaches, navigating fragmented venue booking systems, and guessing what the correct pathway for their child should be.
                </p>
                <p>
                  We built PowerMySport to solve the biggest problem parents face by bringing the entire sports ecosystem into one <span className="font-semibold text-emerald-600">unified, transparent platform</span>. Whether you&apos;re looking to discover your child&apos;s first grassroots academy, or seeking elite professional coaching to take them to the national level, we provide the clarity and tools you need.
                </p>
                <p>
                  Today, we&apos;re focused on building a dependable sports platform where AI-powered pathway discovery, seamless bookings, and a trusted parent community work together so you can make the best decisions for your child&apos;s future in sports without the guesswork.
                </p>
              </motion.div>
            </div>

            <motion.div variants={fadeUp} className="relative rounded-3xl overflow-hidden shadow-2xl premium-shadow h-[400px] lg:h-[500px]">
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

      {/* Community System */}
      <Features
        title="Our Community System"
        subtitle="Shared Sports Intelligence"
        description="PowerMySport is designed to turn experience into useful guidance so players, parents, coaches, and venue partners can all learn from each other."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      {/* Core Values */}
      <Features
        title="Our Core Values"
        subtitle="What Drives Us"
        description="These principles guide everything we do at PowerMySport to support parents."
        features={values}
        columns={2}
        variant="centered"
      />

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
            <motion.p variants={fadeUp} className="text-sm font-bold text-power-orange uppercase tracking-widest mb-3">
              The Team
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Built by Sports Enthusiasts
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our team combines deep sports industry knowledge with technical expertise to create the ultimate sports ecosystem for parents and athletes.
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
              { name: "Amit Mehta", role: "Founder & CEO", desc: "Former national-level badminton player with 10+ years in tech.", img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80" },
              { name: "Priya Sharma", role: "Co-Founder & CTO", desc: "Tech entrepreneur passionate about building scalable platforms.", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80" },
              { name: "Rohan Kapoor", role: "Head of Operations", desc: "Sports facility management expert with an MBA from IIM.", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" }
            ].map((member, i) => (
              <motion.div 
                key={i}
                variants={cardReveal}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={SPRING_STIFF}
                className="group relative bg-white/80 border border-white/70 backdrop-blur-md premium-shadow rounded-3xl p-8 text-center transition-all hover:border-white/90"
              >
                <div className="w-28 h-28 mx-auto rounded-full shadow-lg overflow-hidden mb-6 transform group-hover:scale-110 transition-transform duration-300 ring-4 ring-white">
                  <img src={member.img} alt={member.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{member.name}</h3>
                <p className="text-sm font-semibold text-power-orange mb-3">{member.role}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{member.desc}</p>
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
              <motion.h2 variants={fadeUp} className="font-title text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Our Vision for the Future
              </motion.h2>
              <motion.div variants={fadeUp} className="space-y-6 text-lg text-slate-600">
                <p>
                  We envision a future where navigating a child&apos;s sports journey is as clear and organized as their academic journey. A world where every neighborhood has accessible, affordable sports facilities, and every athlete has access to quality coaching.
                </p>
                <p>
                  We&apos;re expanding the platform to cover more sports, more service types, and better AI tools to surface community knowledge so parents can find the right fit faster.
                </p>
                <p>
                  Join us on this journey to make it easier for every sports family to share what works, what doesn&apos;t, and where the best experiences are happening.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-8 rounded-2xl overflow-hidden shadow-xl premium-shadow h-48 relative">
                <img src="https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1200&q=80" alt="Sports field" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-power-orange/10 mix-blend-multiply" />
              </motion.div>
            </div>

            <div className="space-y-6">
              {[
                { title: "More sports, same community", desc: "Extending the platform across additional sports while keeping the same shared discussion and recommendation layer.", color: "border-orange-200 bg-orange-50/30" },
                { title: "AI-Powered Guidance", desc: "Using community feedback and performance data to generate personalized athletic roadmaps for every child.", color: "border-emerald-200 bg-emerald-50/30" },
                { title: "A unified sports network", desc: "Building a reliable network where conversations, reviews, and bookings reinforce each other instead of living in fragmented silos.", color: "border-blue-200 bg-blue-50/30" }
              ].map((card, i) => (
                <motion.div 
                  key={i}
                  variants={cardReveal}
                  whileHover={{ x: 8 }}
                  transition={SPRING_STIFF}
                  className={`border-l-4 ${card.color.split(' ')[0]} bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl p-6 hover:shadow-md transition-shadow border-y border-r border-slate-100`}
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{card.title}</h3>
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
        title="Be part of the community"
        description="Join the parents using PowerMySport to share advice, compare options, and make smarter sports decisions together."
        primaryCTA={{
          label: "Open Community",
          href: communityUrl,
        }}
        secondaryCTA={{
          label: "Contact Us",
          href: "/contact",
        }}
      />
    </main>
  );
}

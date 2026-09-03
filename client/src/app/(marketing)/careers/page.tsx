import type { Metadata } from "next";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Briefcase, Globe, Heart, Mail, MapPin, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join PowerMySport's engineering, design, and operations team building India's sports pathway platform for parents and young athletes.",
  alternates: {
    canonical: "/careers",
  },
};

const jobOpenings = [
  {
    title: "Full Stack Developer",
    department: "Engineering",
    location: "Bangalore, India",
    type: "Full-time",
    description:
      "Join our engineering team to build scalable features for our sports booking platform. Work with Next.js, TypeScript, Node.js, and MongoDB.",
    requirements: [
      "3+ years of full-stack development experience",
      "Strong proficiency in React, Node.js, and TypeScript",
      "Experience with MongoDB and RESTful APIs",
      "Passion for sports and technology",
    ],
  },
  {
    title: "Product Manager",
    department: "Product",
    location: "Mumbai, India",
    type: "Full-time",
    description:
      "Lead product strategy and roadmap for our platform. Work closely with engineering, design, and business teams to deliver exceptional user experiences.",
    requirements: [
      "5+ years of product management experience",
      "Strong analytical and problem-solving skills",
      "Experience in marketplace or booking platforms",
      "Excellent communication and leadership abilities",
    ],
  },
  {
    title: "UX/UI Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
    description:
      "Create beautiful and intuitive user interfaces for our multi-sided platform. Design for players, venue owners, and coaches.",
    requirements: [
      "3+ years of UX/UI design experience",
      "Proficiency in Figma and design systems",
      "Portfolio showcasing mobile and web projects",
      "Understanding of user-centered design principles",
    ],
  },
  {
    title: "Business Development Manager",
    department: "Sales",
    location: "Delhi, India",
    type: "Full-time",
    description:
      "Drive growth by onboarding premium sports venues and coaches. Build relationships with key stakeholders in the sports industry.",
    requirements: [
      "4+ years of B2B sales or business development",
      "Strong network in sports or fitness industry",
      "Excellent negotiation and presentation skills",
      "Self-motivated with a results-driven approach",
    ],
  },
  {
    title: "Marketing Specialist",
    department: "Marketing",
    location: "Pune, India",
    type: "Full-time",
    description:
      "Develop and execute marketing campaigns to grow our user base. Focus on digital marketing, content creation, and community building.",
    requirements: [
      "2+ years of digital marketing experience",
      "Expertise in SEO, SEM, and social media marketing",
      "Strong content creation and copywriting skills",
      "Data-driven mindset with analytics experience",
    ],
  },
  {
    title: "Customer Support Lead",
    department: "Operations",
    location: "Hyderabad, India",
    type: "Full-time",
    description:
      "Lead our customer support team to ensure exceptional service. Handle escalations, improve processes, and maintain high satisfaction scores.",
    requirements: [
      "3+ years in customer support or operations",
      "Experience leading and mentoring teams",
      "Strong problem-solving and conflict resolution skills",
      "Empathy and patience in dealing with customers",
    ],
  },
];

const benefits = [
  {
    icon: Heart,
    title: "Health & Wellness",
    description: "Comprehensive health insurance and wellness programs",
  },
  {
    icon: TrendingUp,
    title: "Growth Opportunities",
    description: "Career development programs and learning budgets",
  },
  {
    icon: Users,
    title: "Great Team Culture",
    description: "Collaborative environment with talented colleagues",
  },
  {
    icon: Zap,
    title: "Flexible Work",
    description: "Hybrid work options and flexible schedules",
  },
  {
    icon: Globe,
    title: "Sports Access",
    description: "Free credits to book venues and coaches on our platform",
  },
  {
    icon: Briefcase,
    title: "Competitive Compensation",
    description: "Industry-leading salaries and equity options",
  },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
            <div className="relative z-10">
              <div className="mb-2 flex items-center gap-3">
                <Briefcase size={32} className="text-power-orange" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/80 uppercase">
                  Join Us
                </span>
              </div>
              <h1 className="mb-3 text-3xl font-bold sm:text-4xl">
                Build the Future of Sports with Us
              </h1>
              <p className="max-w-2xl text-base text-slate-200 sm:text-lg">
                Join our passionate team and help revolutionize how people discover, book, and
                experience sports. We're looking for talented individuals who share our vision.
              </p>
            </div>
            <div className="bg-power-orange/20 pointer-events-none absolute -top-16 -right-20 h-48 w-48 rounded-full blur-3xl" />
            <div className="bg-turf-green/20 pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Why Join Us Section */}
        <section className="mb-12">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Why Work at PowerMySport?
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card
                  key={index}
                  className="hover:border-power-orange/30 border-2 border-slate-100 bg-white p-6 transition-colors"
                >
                  <Icon size={32} className="text-power-orange mb-3" />
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{benefit.title}</h3>
                  <p className="text-sm text-slate-600">{benefit.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Open Positions Section */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-900 sm:text-3xl">Open Positions</h2>
          <div className="space-y-4">
            {jobOpenings.map((job, index) => (
              <Card
                key={index}
                className="hover:border-power-orange/30 border-2 border-slate-100 bg-white p-6 transition-colors"
              >
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="mb-2 text-xl font-bold text-slate-900">{job.title}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase size={14} className="text-power-orange" />
                        {job.department}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={14} className="text-power-orange" />
                        {job.location}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-turf-green font-medium">{job.type}</span>
                    </div>
                  </div>
                  <Button variant="primary" className="shrink-0">
                    Apply Now
                  </Button>
                </div>

                <p className="mb-4 text-slate-600">{job.description}</p>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">Requirements:</h4>
                  <ul className="space-y-1">
                    {job.requirements.map((req, reqIndex) => (
                      <li key={reqIndex} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-power-orange mt-1">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Application Process Section */}
        <section className="mb-12">
          <Card className="border-2 border-slate-100 bg-white p-8">
            <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">
              Our Hiring Process
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="bg-power-orange/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-power-orange text-xl font-bold">1</span>
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">Apply</h3>
                <p className="text-sm text-slate-600">
                  Submit your application with resume and portfolio
                </p>
              </div>
              <div className="text-center">
                <div className="bg-power-orange/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-power-orange text-xl font-bold">2</span>
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">Screen</h3>
                <p className="text-sm text-slate-600">Initial review and phone screening with HR</p>
              </div>
              <div className="text-center">
                <div className="bg-power-orange/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-power-orange text-xl font-bold">3</span>
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">Interview</h3>
                <p className="text-sm text-slate-600">Technical and cultural fit interviews</p>
              </div>
              <div className="text-center">
                <div className="bg-power-orange/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-power-orange text-xl font-bold">4</span>
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">Offer</h3>
                <p className="text-sm text-slate-600">Receive offer and join the team</p>
              </div>
            </div>
          </Card>
        </section>

        {/* CTA Section */}
        <Card className="from-power-orange/5 to-turf-green/5 border-power-orange/20 border-2 bg-linear-to-br p-8 text-center">
          <Users size={48} className="text-power-orange mx-auto mb-4" />
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Don't See a Perfect Fit?</h2>
          <p className="mx-auto mb-6 max-w-xl text-slate-600">
            We're always looking for talented individuals. Send us your resume and tell us why you'd
            be a great addition to our team.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a href="mailto:teams@powermysport.com">
              <Button variant="primary" size="lg">
                <Mail size={18} className="mr-2" />
                Email Your Resume
              </Button>
            </a>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Contact Us
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

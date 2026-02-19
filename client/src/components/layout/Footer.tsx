import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import Link from "next/link";
import React from "react";

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerSections = {
    company: {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "How It Works", href: "/how-it-works" },
        { label: "Contact", href: "/contact" },
        { label: "Careers", href: "/careers" },
      ],
    },
    services: {
      title: "Services",
      links: [
        { label: "Book Venues", href: "/venues" },
        { label: "List Your Venue", href: "/onboarding" },
        { label: "Become a Coach", href: "/register?role=COACH" },
        { label: "Browse Coaches", href: "/coaches" },
      ],
    },
    policies: {
      title: "Legal & Compliance",
      links: [
        { label: "Terms of Service", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Refund Policy", href: "/refund-policy" },
        { label: "Health Waiver", href: "/health-waiver" },
      ],
    },
    more: {
      title: "More Resources",
      links: [
        { label: "Cookie Policy", href: "/cookies" },
        { label: "Content Policy", href: "/content-policy" },
        { label: "Insurance Info", href: "/insurance-requirements" },
        { label: "Accessibility", href: "/accessibility" },
      ],
    },
  };

  const socialLinks = [
    {
      name: "Facebook",
      href: "#",
      icon: <Facebook className="h-6 w-6" />,
    },
    {
      name: "Instagram",
      href: "#",
      icon: <Instagram className="h-6 w-6" />,
    },
    {
      name: "Twitter",
      href: "#",
      icon: <Twitter className="h-6 w-6" />,
    },
    {
      name: "LinkedIn",
      href: "#",
      icon: <Linkedin className="h-6 w-6" />,
    },
  ];

  return (
    <footer className="bg-linear-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand Section */}
            <div className="lg:col-span-1">
              <Link
                href="/"
                className="text-3xl font-bold bg-linear-to-r from-power-orange to-orange-400 bg-clip-text text-transparent hover:from-orange-400 hover:to-orange-500 transition-all duration-300 inline-block"
              >
                PowerMySport
              </Link>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Connect with premium sports venues and professional coaches near
                you.
              </p>
              {/* Social Links */}
              <div className="flex space-x-4 mt-6">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-power-orange hover:text-white transition-all duration-200"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Footer Links */}
            {Object.entries(footerSections).map(([key, section]) => (
              <div key={key}>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 opacity-90">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-300 hover:text-power-orange transition-colors duration-200 inline-flex items-center group"
                      >
                        <span className="inline-block w-1.5 h-1.5 bg-power-orange rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Bottom Section */}
          <div className="py-8">
            {/* Legal Disclaimer - Compact */}
            <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700 backdrop-blur-sm">
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-slate-100">Disclaimer:</strong>{" "}
                PowerMySport is a marketplace platform. We are not liable for
                service quality, safety, or fitness. Users assume all risks.
                Review our{" "}
                <Link
                  href="/health-waiver"
                  className="text-power-orange hover:underline"
                >
                  Health Waiver
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms"
                  className="text-power-orange hover:underline"
                >
                  Terms
                </Link>{" "}
                before booking. Legal issues:{" "}
                <a
                  href="mailto:legal@powermysport.com"
                  className="text-power-orange hover:underline"
                >
                  legal@powermysport.com
                </a>
              </p>
            </div>

            {/* Copyright */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">
                © {currentYear} PowerMySport. All rights reserved.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-xs">
                <Link
                  href="/privacy"
                  className="text-slate-400 hover:text-power-orange transition-colors"
                >
                  Privacy
                </Link>
                <span className="text-slate-700">•</span>
                <Link
                  href="/terms"
                  className="text-slate-400 hover:text-power-orange transition-colors"
                >
                  Terms
                </Link>
                <span className="text-slate-700">•</span>
                <Link
                  href="/cookies"
                  className="text-slate-400 hover:text-power-orange transition-colors"
                >
                  Cookies
                </Link>
                <span className="text-slate-700">•</span>
                <Link
                  href="/contact"
                  className="text-slate-400 hover:text-power-orange transition-colors"
                >
                  Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

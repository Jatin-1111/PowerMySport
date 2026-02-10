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
        { label: "Services", href: "/services" },
      ],
    },
    support: {
      title: "Support",
      links: [
        { label: "FAQ", href: "/faq" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
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
    <footer className="bg-deep-slate text-ghost-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-8">
          {/* Brand Section */}
          <div className="col-span-1 lg:col-span-1">
            <Link
              href="/"
              className="text-2xl font-bold text-power-orange hover:text-orange-400 transition-colors"
            >
              PowerMySport
            </Link>
            <p className="mt-4 text-sm text-white/80">
              Your one-stop platform for booking sports venues and connecting
              with professional coaches. Empowering athletes and venues across
              the nation.
            </p>
            {/* Social Links */}
            <div className="flex space-x-4 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="text-white/60 hover:text-power-orange transition-colors"
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
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/80 hover:text-power-orange transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-white/60">
              (c) {currentYear} PowerMySport. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link
                href="/privacy"
                className="text-sm text-white/60 hover:text-power-orange transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-gray-400 hover:text-power-orange transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

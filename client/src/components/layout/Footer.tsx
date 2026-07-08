import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import Link from "next/link";
import React from "react";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerSections = {
    company: {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "How It Works", href: "/how-it-works" },
        { label: "Contact", href: "/contact" },
      ],
    },
    services: {
      title: "Services",
      links: [
        { label: "Book Venues", href: "/venues" },
        { label: "List Your Venue", href: "/onboarding" },
        { label: "List Your Academy", href: "/academy/onboarding" },
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
      ],
    },
  };

  const WA_FOOTER_URL = `https://wa.me/918968582443?text=${encodeURIComponent("Hi! I found PowerMySport and would like to know more.")}`;

  const socialLinks = [
    {
      name: "WhatsApp",
      href: WA_FOOTER_URL,
      icon: <WhatsAppIcon />,
      external: true,
    },
    {
      name: "Facebook",
      href: "#",
      icon: <Facebook className="h-6 w-6" />,
      external: false,
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/powermysport",
      icon: <Instagram className="h-6 w-6" />,
      external: true,
    },
    {
      name: "Twitter",
      href: "#",
      icon: <Twitter className="h-6 w-6" />,
      external: false,
    },
    {
      name: "LinkedIn",
      href: "#",
      icon: <Linkedin className="h-6 w-6" />,
      external: false,
    },
  ];

  return (
    <footer className="border-t border-white/60 bg-white/70 text-slate-900 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand Section */}
            <div className="lg:col-span-1">
              <Link href="/" className="inline-flex items-center">
                {/* <Image
                  src="/header_logo_1.png"
                  alt="PowerMySport"
                  width={220}
                  height={56}
                  className="h-40 w-auto"
                /> */}
                <span className="font-title text-3xl font-extrabold tracking-tight leading-none">
                  <span className="text-power-orange">Power</span>
                  <span className="text-slate-900">MySport</span>
                </span>
              </Link>
              <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                Connect with premium sports venues and professional coaches near
                you.
              </p>
              {/* Social Links */}
              <div className="flex space-x-4 mt-6">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-power-orange hover:text-white transition-all duration-200"
                    aria-label={social.name}
                    {...(social.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Footer Links */}
            {Object.entries(footerSections).map(([key, section]) => (
              <div key={key}>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 opacity-90">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-600 hover:text-power-orange transition-colors duration-200 inline-flex items-center group"
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
          <div className="border-t border-slate-200" />

          {/* Bottom Section */}
          <div className="py-8">
            {/* Legal Disclaimer - Compact */}
            <div className="mb-6 p-4 bg-white/80 rounded-lg border border-slate-200 backdrop-blur-sm">
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900">Disclaimer:</strong>{" "}
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
                  href="mailto:teams@powermysport.com"
                  className="text-power-orange hover:underline"
                >
                  teams@powermysport.com
                </a>
              </p>
            </div>

            {/* Copyright */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-500">
                © {currentYear} Powermysport PVT. LTD. All rights reserved.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-xs">
                <Link
                  href="/privacy"
                  className="text-slate-500 hover:text-power-orange transition-colors"
                >
                  Privacy
                </Link>
                <span className="text-slate-300">•</span>
                <Link
                  href="/terms"
                  className="text-slate-500 hover:text-power-orange transition-colors"
                >
                  Terms
                </Link>
                <span className="text-slate-300">•</span>
                <Link
                  href="/cookies"
                  className="text-slate-500 hover:text-power-orange transition-colors"
                >
                  Cookies
                </Link>
                <span className="text-slate-300">•</span>
                <Link
                  href="/contact"
                  className="text-slate-500 hover:text-power-orange transition-colors"
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

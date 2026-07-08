import { Instagram, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import React from "react";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const WA_FOOTER_URL = `https://wa.me/918968582443?text=${encodeURIComponent("Hi! I found PowerMySport and would like to know more.")}`;

const navColumns = [
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Sports Roadmap", href: "/roadmap" },
      { label: "Get Guidance", href: "/guidance" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Book a Session", href: "/booking" },
      { label: "List Your Venue", href: "/onboarding" },
      { label: "List Your Academy", href: "/academy/onboarding" },
      { label: "Become a Coach", href: "/register?role=COACH" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Health Waiver", href: "/health-waiver" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Content Policy", href: "/content-policy" },
    ],
  },
];

const socialLinks = [
  {
    name: "WhatsApp",
    href: WA_FOOTER_URL,
    icon: <WhatsAppIcon />,
    external: true,
    hoverClass: "hover:bg-[#25D366] hover:text-white",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/powermysport",
    icon: <Instagram className="h-4 w-4" />,
    external: true,
    hoverClass: "hover:bg-pink-600 hover:text-white",
  },
  {
    name: "LinkedIn",
    href: "#",
    icon: <Linkedin className="h-4 w-4" />,
    external: false,
    hoverClass: "hover:bg-blue-700 hover:text-white",
  },
];

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-power-orange/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-5">

          {/* Brand column — 2 cols wide on lg */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Link href="/" className="inline-flex items-center">
              <span className="font-title text-3xl font-extrabold leading-none tracking-tight">
                <span className="text-white">Power</span>
                <span className="text-power-orange">My</span>
                <span className="text-white">Sport</span>
              </span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              India&apos;s sports platform for parents — find coaches, book venues,
              and get expert guidance for your child&apos;s sports journey.
            </p>

            {/* Quick contact */}
            <div className="mt-6 space-y-3">
              <a
                href="mailto:teams@powermysport.com"
                className="flex items-center gap-2.5 text-sm text-slate-400 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 shrink-0 text-power-orange" />
                teams@powermysport.com
              </a>
              <a
                href={WA_FOOTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-slate-400 transition-colors hover:text-[#25D366]"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#25D366]">
                  <WhatsAppIcon />
                </span>
                Chat on WhatsApp
              </a>
            </div>

            {/* Social icons */}
            <div className="mt-6 flex flex-wrap gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-all duration-200 ${social.hoverClass}`}
                  {...(social.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation columns */}
          {navColumns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06]" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
          <p className="text-xs text-slate-600">
            © {currentYear} Powermysport PVT. LTD. All rights reserved.
          </p>
          <p className="text-center text-xs text-slate-700 sm:text-right">
            PowerMySport is a marketplace. Users assume all risks.{" "}
            <Link
              href="/health-waiver"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              Health Waiver
            </Link>
            {" · "}
            <Link
              href="/terms"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              Terms
            </Link>
            {" · "}
            <a
              href="mailto:teams@powermysport.com"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              Legal
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

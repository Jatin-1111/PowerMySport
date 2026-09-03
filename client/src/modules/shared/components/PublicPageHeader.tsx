import { LucideIcon } from "lucide-react";
import React from "react";

interface PublicPageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}

export default function PublicPageHeader({
  title,
  subtitle,
  icon: Icon,
  children,
}: PublicPageHeaderProps) {
  return (
    <div className="bg-linear-to-br relative overflow-hidden from-slate-900 to-slate-800 py-12 text-white sm:py-16 md:py-20">
      {/* Blob overlays */}
      <div className="bg-power-orange/10 absolute right-0 top-0 -mr-32 -mt-32 h-96 w-96 rounded-full blur-3xl"></div>
      <div className="bg-turf-green/10 absolute bottom-0 left-0 -mb-32 -ml-32 h-80 w-80 rounded-full blur-3xl"></div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-3xl">
          {/* Icon */}
          <div className="mb-4 flex items-center gap-2">
            <Icon size={36} className="text-power-orange" />
          </div>

          {/* Title */}
          <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>

          {/* Subtitle */}
          <p className="mb-8 text-lg leading-relaxed text-slate-200 sm:text-xl">{subtitle}</p>

          {/* Children (search bar, etc) */}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </div>
  );
}

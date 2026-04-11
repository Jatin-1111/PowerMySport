import React from "react";
import { LucideIcon } from "lucide-react";

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
    <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden py-12 sm:py-16 md:py-20">
      {/* Blob overlays */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-power-orange/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-turf-green/10 rounded-full blur-3xl -ml-32 -mb-32"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          {/* Icon */}
          <div className="mb-4 flex items-center gap-2">
            <Icon size={36} className="text-power-orange" />
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-200 mb-8 leading-relaxed">
            {subtitle}
          </p>

          {/* Children (search bar, etc) */}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </div>
  );
}

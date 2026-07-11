"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function BackToRoadmapLink({ className }: { className?: string }) {
  const [href, setHref] = useState("/roadmap");

  useEffect(() => {
    const saved = localStorage.getItem("pms_roadmap_return_url");
    if (saved) setHref(saved);
  }, []);

  return (
    <Link
      href={href}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-xs font-medium text-white/35 hover:text-white/65 transition"
      }
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Pathway Explorer
    </Link>
  );
}

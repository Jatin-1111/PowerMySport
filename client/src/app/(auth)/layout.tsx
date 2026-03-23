"use client";

import Link from "next/link";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { ArrowLeft } from "lucide-react";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-green-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center">
        {/* Logo */}
        <FadeIn delay={0.1}>
          <div className="mb-6 text-center sm:mb-8">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-power-orange mb-1">
                PowerMySport
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                Power Your Sports Journey
              </p>
            </Link>
          </div>
        </FadeIn>

        {children}

        {/* Footer */}
        <FadeIn delay={0.3}>
          <div className="mt-5 text-center text-sm text-muted-foreground sm:mt-6">
            <Link
              href="/"
              className="text-sm font-medium text-power-orange hover:text-orange-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

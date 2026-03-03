"use client";

import Link from "next/link";
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
        <div className="mb-6 text-center sm:mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-power-orange">
              PowerMySport
            </h1>
            <p className="text-muted-foreground text-sm">
              Power Your Sports Journey
            </p>
          </Link>
        </div>

        {children}

        {/* Footer */}
        <div className="mt-5 text-center text-sm text-muted-foreground sm:mt-6">
          <Link
            href="/"
            className="text-sm text-power-orange hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-green-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
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
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-power-orange transition-colors">
            ? Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}



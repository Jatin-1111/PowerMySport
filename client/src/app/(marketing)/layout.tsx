"use client";

import React from "react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-deep-slate border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-power-orange">
            PowerMySport
          </div>
          <nav className="flex gap-6 items-center">
            <a
              href="/"
              className="text-ghost-white hover:text-power-orange transition-colors"
            >
              Home
            </a>
            <a
              href="/login"
              className="text-ghost-white hover:text-power-orange transition-colors"
            >
              Login
            </a>
            <a
              href="/register"
              className="bg-power-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              Sign Up
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-deep-slate text-ghost-white py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2026 PowerMySport. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

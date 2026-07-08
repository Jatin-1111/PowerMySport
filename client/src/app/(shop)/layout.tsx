import { Footer } from "@/components/layout/Footer";
import { ShopChrome } from "@/components/shop/ShopChrome";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "PowerMySport Shop | Performance Gear",
  description:
    "Shop premium sports gear, customized equipment, and exclusive PowerMySport bundles.",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#f7f9fc]">
      <ShopChrome />
      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-20">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

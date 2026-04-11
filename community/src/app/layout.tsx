import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk, Syne } from "next/font/google";
import { Toaster } from "sonner";
import CommunityTopNav from "@/modules/community/components/layout/CommunityTopNav";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowerMySport Community",
  description: "Anonymous-first player community chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${syne.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-app text-slate-900">
        <div className="min-h-full">
          <CommunityTopNav />
          <main>{children}</main>
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}

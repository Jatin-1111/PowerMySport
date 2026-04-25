import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk, Syne } from "next/font/google";
import { Toaster } from "sonner";
import CommunityNotificationToastListener from "@/modules/community/components/layout/CommunityNotificationToastListener";
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
      <body className="h-dvh bg-app text-slate-900 overflow-y-auto">
        <div className="flex h-dvh flex-col">
          <CommunityTopNav />
          <CommunityNotificationToastListener />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}

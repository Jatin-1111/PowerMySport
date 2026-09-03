import { Suspense } from "react";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import CommunityNotificationToastListener from "@/modules/community/components/layout/CommunityNotificationToastListener";
import CommunityTopNav from "@/modules/community/components/layout/CommunityTopNav";
import { rootMetadata } from "@/lib/seo";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = rootMetadata;

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} bg-app overflow-hidden text-slate-900 antialiased`}
      >
        <div className="flex h-dvh flex-col">
          <Suspense fallback={<div className="h-16 w-full border-b border-white/70 bg-white/90" />}>
            <CommunityTopNav />
          </Suspense>
          <Suspense fallback={null}>
            <CommunityNotificationToastListener />
          </Suspense>
          <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
        <Toaster
          richColors
          closeButton
          position="top-right"
          toastOptions={{ style: { width: "fit-content", maxWidth: "420px" } }}
        />
      </body>
    </html>
  );
}

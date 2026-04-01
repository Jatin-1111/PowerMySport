import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const communitySans = Plus_Jakarta_Sans({
  variable: "--font-community-sans",
  subsets: ["latin"],
});

const communityMono = Space_Mono({
  variable: "--font-community-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
    <html lang="en">
      <body
        className={`${communitySans.variable} ${communityMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}

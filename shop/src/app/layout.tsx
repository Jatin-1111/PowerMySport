import type { Metadata } from "next";
import { Space_Grotesk, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PowerMySport Shop",
  description: "Merchandise storefront for PowerMySport athletes and fans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-app text-slate-900">
        <div className="min-h-full">
          <header className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <Link
                href="/"
                className="font-title text-xl tracking-tight text-slate-900"
              >
                PowerMySport Shop
              </Link>

              <nav className="flex items-center gap-2 text-sm font-medium sm:gap-4">
                <Link href="/products" className="nav-link">
                  Products
                </Link>
                <Link href="/cart" className="nav-link">
                  Cart
                </Link>
                <Link href="/orders" className="nav-link">
                  Orders
                </Link>
              </nav>
            </div>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

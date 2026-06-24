"use client";

import { useEffect } from "react";

export default function CookiePolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">Cookie Policy</h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Overview</h2>
            <p>
              PowerMySport ("we," "us," "our," or "Company") uses essential
              cookies to keep you signed in and protect the platform. We do not
              use advertising cookies. We also collect anonymous, aggregated
              usage analytics (such as which pages are opened) using a random
              visitor id that contains no personal information. When you first
              visit, we show a brief notice so you can acknowledge this policy.
              This Cookie Policy explains how we use cookies and your choices
              regarding them.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. What Are Cookies?
            </h2>
            <p>
              Cookies are small text files stored on your device (computer,
              tablet, or mobile phone) when you visit our website. They contain
              information that is sent back to our servers. Cookies help us
              recognize you, remember your preferences, and improve your user
              experience.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Types of Cookies We Use
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Essential/Necessary Cookies
            </h3>
            <p>
              These cookies are required for the website to function properly
              and cannot be disabled. They enable core functionality such as:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>User authentication and login sessions</li>
              <li>Security measures and fraud prevention</li>
              <li>Secure session management for bookings</li>
            </ul>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Service-Provider Cookies
            </h3>
            <p>
              Payment providers may set their own cookies during checkout to
              secure transactions. These cookies are controlled by the provider
              and are governed by their policies.
            </p>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Anonymous Analytics
            </h3>
            <p>
              To understand which pages and features are useful, we collect
              anonymous, aggregated usage data—for example, how many visitors
              open a page, which links they click, and how far they scroll. To
              count visitors without identifying them, we store a randomly
              generated id in your browser's local storage (key{" "}
              <code>pms-guest-id</code>). This id is not linked to your name,
              email, or any personal detail, and we do not build advertising
              profiles or sell this data. You can clear it any time by clearing
              your browser's site data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Cookie Duration
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Session Cookies:</strong> Deleted after you close your
                browser (e.g., login tokens)
              </li>
              <li>
                <strong>Persistent Cookies:</strong> Remain on your device until
                they expire or you delete them
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Information Collected via Cookies
            </h2>
            <p>Through cookies, we may collect:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Authentication and session identifiers</li>
              <li>Basic security signals needed to protect the platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Your Cookie Choices
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.1 Browser Controls
            </h3>
            <p>
              Most web browsers allow you to control cookies through settings.
              You can:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Block all cookies</li>
              <li>Allow only first-party cookies</li>
              <li>Delete cookies when exiting the browser</li>
              <li>Receive notifications when cookies are set</li>
            </ul>
            <p className="mt-3">
              <strong>Note:</strong> Disabling essential cookies may break
              website functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Local Storage & Similar Technologies
            </h2>
            <p>
              In addition to cookies, we may use other storage technologies such
              as:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Local Storage:</strong> Stores data locally on your
                device (not sent to servers unless retrieved)
              </li>
              <li>
                <strong>Session Storage:</strong> Clears when you close the
                browser
              </li>
              <li>
                <strong>Web Beacons/Pixels:</strong> Transparent 1x1 images used
                to measure engagement
              </li>
            </ul>
            <p className="mt-3">
              You can clear local storage through your browser settings or by
              clearing your browsing data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Pixel Tags & Web Beacons
            </h2>
            <p>
              We use pixel tags (small transparent images) embedded in emails
              and web pages to measure open rates, click-through rates, and
              campaign effectiveness. These do not store information directly
              but communicate with our servers to count page visits.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Third-Party Links
            </h2>
            <p>
              Our website may contain links to third-party websites. We are not
              responsible for the cookie practices of external websites. Please
              review their privacy and cookie policies separately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Cookie Policy periodically to reflect changes
              in our practices, technology, or legal requirements. The "Last
              Updated" date at the top of this page indicates when the policy
              was last modified. Continued use of our website after updates
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Contact Us</h2>
            <p>
              If you have questions or concerns about our use of cookies, please
              contact us at:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                Email:{" "}
                <a
                  href="mailto:teams@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  teams@powermysport.com
                </a>
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This Cookie Policy is a formal document binding both PowerMySport
              and its users. By using our website, you acknowledge receipt and
              understanding of this policy.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}

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
              PowerMySport ("we," "us," "our," or "Company") uses cookies and
              similar tracking technologies on our website and mobile
              applications to enhance your experience, analyze site performance,
              and deliver personalized content. This Cookie Policy explains how
              we use cookies and your choices regarding them.
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
              <li>Server load balancing</li>
              <li>Payment processing and transaction security</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Performance/Analytics Cookies
            </h3>
            <p>
              These cookies help us understand how visitors use our website,
              which pages are popular, and where users encounter errors. They do
              not identify individual users. Services include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Google Analytics:</strong> Analyzes website traffic,
                user behavior, and conversion funnels
              </li>
              <li>
                <strong>Mixpanel:</strong> Tracks user actions and funnel
                analysis for product optimization
              </li>
              <li>
                <strong>Session Recording:</strong> Optional recording of user
                sessions (with explicit consent) to improve UX
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Functional Cookies
            </h3>
            <p>
              These cookies enable enhanced functionality and personalization:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Remembering your preferences and settings</li>
              <li>
                Saving search history and previously viewed venues/coaches
              </li>
              <li>Maintaining your language and location preferences</li>
              <li>
                Implementing user-requested features like theme preferences
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.4 Advertising/Marketing Cookies
            </h3>
            <p>
              If applicable, we use cookies to deliver relevant advertisements,
              measure campaign effectiveness, and track conversions from
              advertising campaigns. Third-party advertisers may place cookies
              on your device.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.5 Third-Party Cookies
            </h3>
            <p>
              Third-party services we integrate may place their own cookies.
              These include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Payment gateways (Razorpay, PayU, etc.) for secure transactions
              </li>
              <li>Google Analytics for traffic analysis</li>
              <li>Chat support providers (if applicable)</li>
              <li>Social media platforms (if you connect via social login)</li>
            </ul>
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
                <strong>Persistent Cookies:</strong> Remain on your device for a
                set period (typically 1-2 years) or until manually deleted
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Information Collected via Cookies
            </h2>
            <p>Through cookies, we may collect:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your device type, browser, and operating system</li>
              <li>Pages visited and time spent on each page</li>
              <li>Clicks, searches, and booking actions</li>
              <li>Referral source (how you arrived at our site)</li>
              <li>General location (city/region level, not precise)</li>
              <li>Your user ID (if logged in)</li>
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

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.2 Cookie Banner
            </h3>
            <p>
              When you first visit our website, we display a cookie consent
              banner. You can:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Accept All:</strong> Allow all non-essential cookies
              </li>
              <li>
                <strong>Reject All:</strong> Decline non-essential cookies
                (essential cookies still used)
              </li>
              <li>
                <strong>Customize:</strong> Choose specific cookie categories
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.3 Opt-Out Tools
            </h3>
            <p>You can opt out of specific services:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Google Analytics:</strong> Install the{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  className="text-blue-600 hover:underline"
                >
                  Google Analytics Opt-out Browser Add-on
                </a>
              </li>
              <li>
                <strong>Mixpanel:</strong> Opt out via{" "}
                <a
                  href="https://mixpanel.com/optout"
                  className="text-blue-600 hover:underline"
                >
                  Mixpanel's opt-out page
                </a>
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.4 Do Not Track (DNT)
            </h3>
            <p>
              Some browsers include a "Do Not Track" feature. Currently, there
              is no industry standard for responding to DNT signals. We will
              honor opt-out preferences you've set in your account settings.
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
                <strong>PowerMySport Legal Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:privacy@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  privacy@powermysport.com
                </a>
              </p>
              <p>
                Email (Legal):{" "}
                <a
                  href="mailto:legal@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  legal@powermysport.com
                </a>
              </p>
              <p>
                Support:{" "}
                <a
                  href="mailto:support@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  support@powermysport.com
                </a>
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

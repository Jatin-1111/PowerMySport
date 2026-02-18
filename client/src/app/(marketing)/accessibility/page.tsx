"use client";

import { useEffect } from "react";

export default function Accessibility() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">Accessibility Statement</h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Commitment to Accessibility
            </h2>
            <p>
              PowerMySport is committed to ensuring that our website, mobile
              applications, and digital services are accessible to all users,
              including individuals with disabilities. We strive to comply with
              the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
              standards and applicable accessibility laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Accessibility Features
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Website Accessibility
            </h3>
            <p>
              PowerMySport website includes the following accessibility
              features:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Keyboard Navigation:</strong> All interactive elements
                can be navigated using keyboard alone (Tab, Enter, Spacebar)
              </li>
              <li>
                <strong>Focus Indicators:</strong> Clear, visible focus
                indicators show which element has keyboard focus
              </li>
              <li>
                <strong>Semantic HTML:</strong> Proper use of heading, list,
                form, and button elements for screen reader users
              </li>
              <li>
                <strong>Image Alt Text:</strong> All meaningful images include
                descriptive alternative text
              </li>
              <li>
                <strong>Form Labels:</strong> All form inputs are properly
                labeled for clarity
              </li>
              <li>
                <strong>Color Contrast:</strong> Text and background colors meet
                WCAG Level AA contrast requirements (4.5:1 minimum)
              </li>
              <li>
                <strong>Responsive Design:</strong> Website is responsive and
                works on various screen sizes
              </li>
              <li>
                <strong>Skip Links:</strong> "Skip to main content" link allows
                users to bypass repetitive navigation
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Mobile App Accessibility
            </h3>
            <p>PowerMySport mobile apps (iOS and Android) include:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>VoiceOver Support (iOS):</strong> Full compatibility
                with Apple's VoiceOver screen reader
              </li>
              <li>
                <strong>TalkBack Support (Android):</strong> Full compatibility
                with Google's TalkBack screen reader
              </li>
              <li>
                <strong>Large Text Support:</strong> App respects system-level
                text size preferences
              </li>
              <li>
                <strong>High Contrast Modes:</strong> App supports device-level
                dark mode and high contrast settings
              </li>
              <li>
                <strong>Haptic Feedback:</strong> Vibration feedback for
                confirmations and notifications (can be disabled)
              </li>
              <li>
                <strong>Touch Target Size:</strong> Interactive elements are at
                least 44x44 points in size
              </li>
              <li>
                <strong>Captions & Transcripts:</strong> Video content includes
                captions where applicable
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.3 Content Accessibility
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Clear Language:</strong> We use plain language and avoid
                jargon where possible
              </li>
              <li>
                <strong>Document Accessibility:</strong> PDFs and downloadable
                documents are tagged for accessibility
              </li>
              <li>
                <strong>Video Captions:</strong> All video content includes
                captions or transcripts
              </li>
              <li>
                <strong>Audio Descriptions:</strong> Important visual
                information in videos is described audibly
              </li>
              <li>
                <strong>Link Text:</strong> Links have descriptive text (not
                "click here" or "read more")
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.4 Communication Accessibility
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Email Support:</strong> Available for users who prefer
                written communication
              </li>
              <li>
                <strong>Phone Support:</strong> Available for users who prefer
                verbal communication
              </li>
              <li>
                <strong>TTY/Relay Services:</strong> Support for Teleprinter
                (TTY) devices for deaf/hard of hearing users
              </li>
              <li>
                <strong>Live Chat:</strong> Text-based chat support for
                immediate assistance
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Accessibility Standards & Compliance
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 WCAG 2.1 Compliance
            </h3>
            <p>
              PowerMySport aims to comply with WCAG 2.1 Level AA standards,
              which include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Perceivable:</strong> Information is presented in ways
                users can perceive (text, images, audio)
              </li>
              <li>
                <strong>Operable:</strong> Interface components are accessible
                via keyboard and other input methods
              </li>
              <li>
                <strong>Understandable:</strong> Content and operations are
                clear and predictable
              </li>
              <li>
                <strong>Robust:</strong> Content works with a wide variety of
                assistive technologies
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Regulatory Compliance
            </h3>
            <p>
              PowerMySport complies with relevant accessibility laws and
              regulations:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>
                  Rights of Persons with Disabilities Act, 2016 (India):
                </strong>{" "}
                Complies with India's disability rights law
              </li>
              <li>
                <strong>
                  Americans with Disabilities Act (ADA) Section 508 (if
                  applicable):
                </strong>{" "}
                Aligns with ADA website accessibility standards
              </li>
              <li>
                <strong>
                  Information Technology (Accessibility) Rules, 2016 (India):
                </strong>{" "}
                Follows guidelines for e-governance and public websites
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Known Accessibility Limitations
            </h2>
            <p>
              We are continuously working to improve accessibility. Currently
              known limitations include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Third-Party Content:</strong> Some embedded third-party
                content (maps, payment gateways) may have accessibility
                limitations beyond our control
              </li>
              <li>
                <strong>User-Generated Content:</strong> Photos, videos, and
                reviews uploaded by users may not include alt text or captions
              </li>
              <li>
                <strong>Legacy Features:</strong> Older features of the platform
                may not fully meet WCAG 2.1 AA standards (we are working to
                remediate these)
              </li>
              <li>
                <strong>Real-Time Features:</strong> Live booking availability
                updates may not be accessible to all screen reader users
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Assistive Technology Compatibility
            </h2>
            <p>
              PowerMySport is compatible with the following assistive
              technologies:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Screen Readers:</strong> NVDA (Windows), JAWS (Windows),
                VoiceOver (Mac/iOS), TalkBack (Android)
              </li>
              <li>
                <strong>Voice Control:</strong> Dragon NaturallySpeaking,
                Windows Speech Recognition, Voice Control (iOS/macOS)
              </li>
              <li>
                <strong>Text Magnification:</strong> Built-in browser zoom,
                operating system text magnification tools
              </li>
              <li>
                <strong>High Contrast Modes:</strong> Windows High Contrast,
                macOS Contrast preferences, iOS/Android dark mode
              </li>
              <li>
                <strong>Captions & Transcripts:</strong> All audio/video content
                compatible with caption/transcript formats
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Accessibility Features You Can Use
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.1 Browser-Level Accessibility
            </h3>
            <p>Most web browsers include accessibility features:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Zoom:</strong> Use Ctrl/Cmd + "+" to increase text size,
                or Ctrl/Cmd + "-" to decrease
              </li>
              <li>
                <strong>Reader Mode:</strong> Many browsers offer a "Reader
                Mode" for simplified, distraction-free reading
              </li>
              <li>
                <strong>High Contrast:</strong> Enable high contrast mode in
                your operating system settings
              </li>
              <li>
                <strong>Dark Mode:</strong> Use your browser or OS dark mode to
                reduce eye strain
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.2 Operating System Accessibility
            </h3>
            <p>Your device's accessibility settings:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Screen Reader:</strong> Enable VoiceOver (Mac), NVDA
                (Windows), or TalkBack (Android)
              </li>
              <li>
                <strong>Text Magnifier:</strong> Use Magnifier app (Windows) or
                Zoom (macOS)
              </li>
              <li>
                <strong>Captions:</strong> Enable live captions on video content
                (Windows 10+, iOS 16+, Android 13+)
              </li>
              <li>
                <strong>Voice Control:</strong> Use Voice Control on iOS 13+ or
                Mac with Voice Control enabled
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.3 PowerMySport-Specific Accessibility Options
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Keyboard-Only Navigation:</strong> Use Tab to navigate,
                Enter to select, Arrow keys to navigate lists
              </li>
              <li>
                <strong>High Contrast Theme:</strong> Available in Account
                Settings → Preferences → Appearance
              </li>
              <li>
                <strong>Reduced Motion:</strong> Turn off animations in Account
                Settings → Preferences → Motion
              </li>
              <li>
                <strong>Font Size:</strong> Adjust font size in Account Settings
                → Preferences
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Accessibility Testing & Improvements
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Regular Testing
            </h3>
            <p>PowerMySport conducts regular accessibility testing:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Automated Testing:</strong> Tools like Axe, WebAIM, and
                WAVE scan for accessibility issues
              </li>
              <li>
                <strong>Manual Testing:</strong> Our team manually tests with
                keyboard-only navigation and screen readers
              </li>
              <li>
                <strong>User Testing:</strong> We conduct testing with users who
                have disabilities to identify real-world issues
              </li>
              <li>
                <strong>Third-Party Audits:</strong> Periodic accessibility
                audits by external experts
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Continuous Improvement
            </h3>
            <p>We regularly:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Update components and pages to meet WCAG 2.1 AA standards</li>
              <li>Add missing alt text to images</li>
              <li>Improve color contrast ratios</li>
              <li>Enhance keyboard navigation</li>
              <li>Fix screen reader compatibility issues</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.3 Version History
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>February 2026:</strong> Achieved WCAG 2.1 Level AA
                compliance for main website
              </li>
              <li>
                <strong>2025:</strong> Implemented app accessibility features
                (VoiceOver, TalkBack)
              </li>
              <li>
                <strong>2024:</strong> Initial accessibility audit and
                remediation program launched
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Reporting Accessibility Issues
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.1 How to Report
            </h3>
            <p>
              If you encounter accessibility barriers while using PowerMySport:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Note the specific issue and which page/feature it affects</li>
              <li>Describe what you were trying to do</li>
              <li>
                Provide details about your device, browser, and assistive
                technology
              </li>
              <li>Contact us using one of the methods below</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.2 Contact Information
            </h3>
            <p>To report accessibility issues or request accommodations:</p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Accessibility Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:accessibility@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  accessibility@powermysport.com
                </a>
              </p>
              <p>
                Phone: <strong>+91-XXX-XXX-XXXX</strong> (TTY support available)
              </p>
              <p>Hours: Monday-Friday, 9 AM - 6 PM IST</p>
              <p>Response Time: 24-48 hours</p>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.3 What Happens Next
            </h3>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                We will acknowledge receipt of your report within 24 hours
              </li>
              <li>Our accessibility team will investigate the issue</li>
              <li>
                We will work with you to identify workarounds if available
              </li>
              <li>We will provide a timeline for fixing the issue</li>
              <li>You will be notified when the issue is resolved</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Alternative Access Methods
            </h2>
            <p>
              If you cannot access a particular feature on our website or app,
              alternative methods are available:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Booking Assistance:</strong> Call us for help making a
                booking over the phone
              </li>
              <li>
                <strong>Information Requests:</strong> Request information about
                coaches, venues, or services in text or audio format
              </li>
              <li>
                <strong>Document Provision:</strong> Request documents in large
                print, Braille, or audio format
              </li>
              <li>
                <strong>Personal Assistance:</strong> For complex bookings, we
                can arrange personal assistance
              </li>
            </ul>
            <p className="mt-3">
              Contact accessibility@powermysport.com to request these services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Third-Party Content & External Links
            </h2>
            <p>PowerMySport is not responsible for the accessibility of:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Third-party websites linked from our site (we encourage
                accessibility but cannot control them)
              </li>
              <li>
                External applications or services integrated with PowerMySport
              </li>
              <li>Content uploaded by users (photos, videos, documents)</li>
            </ul>
            <p className="mt-3">
              If you encounter accessibility issues on a third-party site,
              contact that organization directly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Feedback & Suggestions
            </h2>
            <p>
              We welcome your feedback on how we can improve accessibility. Send
              your suggestions to:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                Email:{" "}
                <a
                  href="mailto:accessibility@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  accessibility@powermysport.com
                </a>
              </p>
              <p>Subject: Accessibility Suggestion</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300 bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-900 font-bold">
              ♿ Accessibility is important to us. Our goal is to ensure that
              everyone, regardless of ability, can use PowerMySport. If you face
              any barriers, please let us know and we'll work to resolve them.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}

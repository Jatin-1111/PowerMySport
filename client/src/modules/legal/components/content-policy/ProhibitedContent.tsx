import { Copyright } from "lucide-react";

export function ProhibitedContent() {
  return (
    <section id="prohibited-content" className="mb-8">
      <h2 className="mb-4 mt-8 text-2xl font-semibold">4. Prohibited Content</h2>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.1 Abusive & Harassing Content</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Harassment, bullying, or intimidation of any individual</li>
        <li>Threats of violence or bodily harm</li>
        <li>
          Hate speech or content promoting discrimination based on race, ethnicity, religion,
          gender, sexual orientation, disability, or other protected characteristics
        </li>
        <li>Doxxing (sharing private personal information to enable harassment)</li>
        <li>Cyberstalking or persistent unwanted contact</li>
        <li>Sexual harassment or unwanted sexual content</li>
        <li>Revenge content (sharing intimate images without consent)</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.2 Illegal & Dangerous Content</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Content promoting, encouraging, or instructing illegal activities</li>
        <li>Scams, fraud, or deceptive practices</li>
        <li>Sale or promotion of illegal drugs or controlled substances</li>
        <li>Promotion of weapons, explosives, or dangerous items</li>
        <li>Child sexual abuse material (CSAM) or child exploitation</li>
        <li>Promotion of suicide, self-harm, or eating disorders</li>
        <li>Instructions for creating weapons or explosives</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.3 Misleading & Fraudulent Content</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Fake reviews (submitted by friends, competitors, or paid reviewers)</li>
        <li>Astroturfing (coordinated false reviews to manipulate ratings)</li>
        <li>Misleading health claims (e.g., "will cure diabetes")</li>
        <li>Investment scams or financial fraud</li>
        <li>Phishing attempts or malware links</li>
        <li>Impersonation of another user, coach, venue, or PowerMySport staff</li>
        <li>Sharing false credentials or certifications</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.4 Inappropriate Media Content</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Explicit sexual content or pornography</li>
        <li>Graphic violence or gore</li>
        <li>Nudity (except in legitimate athletic/medical contexts)</li>
        <li>Content sexualizing minors in any way</li>
        <li>Images without consent of all individuals pictured</li>
        <li>Copyright-infringing media (unauthorized use of songs, movies, photos)</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.5 Spam & Commercial Abuse</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Spam (repetitive, irrelevant posts)</li>
        <li>Commercial advertising or unsolicited promotions</li>
        <li>Spamming links to external websites or referral links</li>
        <li>Multi-level marketing (MLM) recruitment or pitches</li>
        <li>Excessive self-promotion outside of legitimate business context</li>
        <li>Collection of contact information for commercial purposes</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold">4.6 Privacy Violations</h3>
      <p>The following content is strictly prohibited:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          Sharing others' personal information (phone numbers, addresses, emails) without consent
        </li>
        <li>Sharing photos of people without consent</li>
        <li>Publishing private messages or conversations without consent</li>
        <li>Revealing minors' information or images</li>
      </ul>
    </section>
  );
}

export function DataSecurity() {
  return (
    <section id="data-security" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Data Security</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        We implement technical and organizational security measures, consistent with the reasonable
        security practices standard under the Information Technology Act, 2000 and the rules made
        thereunder, designed to protect your personal information against unauthorized access,
        alteration, disclosure, or destruction, including:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          Encryption of sensitive data in transit, and at rest where we have implemented it for that
          data category
        </li>
        <li>Secure payment processing through certified gateways</li>
        <li>Periodic security review of our systems</li>
        <li>Access controls and authentication mechanisms</li>
        <li>Personnel training on data protection practices</li>
      </ul>
      <p className="mb-4 leading-relaxed text-slate-600">
        We are working to extend at-rest encryption to additional categories of sensitive
        information (such as bank account and payout details) not yet covered by it.
      </p>
      <p className="leading-relaxed text-slate-600">
        No method of transmission over the internet or electronic storage is completely secure.
        While we take commercially reasonable steps to protect your information, we cannot and do
        not guarantee its absolute security, and you provide information to us at your own risk. You
        are responsible for keeping your account credentials confidential.
      </p>
    </section>
  );
}

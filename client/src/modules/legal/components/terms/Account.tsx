export function Account() {
  return (
    <section id="account" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Account Registration</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        To use certain features of the Platform, you must register for an account. You agree and
        warrant that you will:
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-600">
        <li>Provide accurate, current, and complete information</li>
        <li>Promptly correct or update your information whenever it changes</li>
        <li>Maintain the confidentiality and security of your account credentials at all times</li>
        <li>Notify us immediately of any unauthorized access</li>
        <li>
          Assume full responsibility for all activities conducted through your account, whether or
          not authorized by you
        </li>
        <li>Not create multiple accounts or share your account</li>
        <li>Not register on behalf of, or impersonate, any third party</li>
        <li>
          Be at least 18 years old (parents/guardians may create and remain solely responsible for
          dependent profiles for minors)
        </li>
      </ul>
      <p className="mt-4 leading-relaxed text-slate-600">
        We reserve the right, at our sole and absolute discretion, to refuse registration, require
        additional identity or document verification, suspend an account pending verification, or
        terminate any account without notice or liability, for any reason, including suspected
        fraud, misrepresentation, or breach of these Terms.
      </p>
    </section>
  );
}

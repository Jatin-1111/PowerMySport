import { Mail } from "lucide-react";

export function Contact() {
  return (
    <section id="contact">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Contact Information</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        For questions about these Terms of Service, please contact us:
      </p>
      <div className="not-prose rounded-lg bg-slate-50 p-4">
        <p className="mb-2 text-slate-700">
          <strong>Legal Entity:</strong> Powermysport Private Limited
        </p>
        <p className="mb-2 text-slate-700">
          <strong>CIN:</strong> U93120PB2026PTC067587
        </p>
        <p className="mb-2 flex items-center gap-2 text-slate-700">
          <Mail size={18} className="text-power-orange" />
          <strong>Email:</strong> teams@powermysport.com
        </p>
        <p className="text-slate-700">
          <strong>Phone:</strong> +91 89685 82443
        </p>
        <p className="text-slate-700">
          <strong>Registered Office:</strong> Mullanpur, Punjab.
        </p>
      </div>
    </section>
  );
}

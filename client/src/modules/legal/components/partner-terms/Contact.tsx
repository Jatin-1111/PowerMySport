import { Mail } from "lucide-react";

export function Contact() {
  return (
            <section id="contact">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Contact Information
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                For questions about these Partner Terms, commission, or
                onboarding, please contact us:
              </p>
              <div className="bg-slate-50 p-4 rounded-lg not-prose">
                <p className="text-slate-700 mb-2">
                  <strong>Legal Entity:</strong> Powermysport Private Limited
                </p>
                <p className="text-slate-700 mb-2">
                  <strong>CIN:</strong> U93120PB2026PTC067587
                </p>
                <p className="text-slate-700 flex items-center gap-2 mb-2">
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

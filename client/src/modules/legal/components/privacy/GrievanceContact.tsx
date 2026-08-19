import { Mail } from "lucide-react";

export function GrievanceContact() {
  return (
          <section id="grievance-contact" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Grievance Officer &amp; Contact
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In accordance with the Information Technology (Intermediary
              Guidelines and Digital Media Ethics Code) Rules, 2021 and the
              Consumer Protection (E-Commerce) Rules, 2020, the Grievance
              Officer for privacy, data, and platform-related complaints can
              be reached at the details below. We will acknowledge your
              complaint within 24 hours and endeavor to redress it within 15
              days (or, for e-commerce/booking-related complaints, within one
              month) of receipt.
            </p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700 mb-2">
                <strong>Legal Entity:</strong> Powermysport Private Limited
                {" — "}
                <strong>CIN:</strong> U93120PB2026PTC067587
              </p>
              <p className="text-slate-700 flex items-center gap-2 mb-2">
                <Mail size={18} className="text-power-orange" />
                <strong>Grievance Officer Email:</strong> teams@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
              <p className="text-slate-700">
                <strong>Registered Office:</strong> Mullanpur, Punjab.
              </p>
            </div>
            <p className="text-slate-600 leading-relaxed mt-4">
              If you are not satisfied with our resolution, you may, once the
              relevant provisions of the Digital Personal Data Protection Act,
              2023 come into force, escalate a personal-data complaint to the
              Data Protection Board of India after first raising it with us.
            </p>
          </section>
  );
}

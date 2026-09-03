"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

const CERTIFICATIONS_OPTIONS = [
  "NASM Certified",
  "ACE Certified",
  "ISSA Certified",
  "IFS Certified",
  "Sports First Aid",
  "CPR Certified",
  "International Coach",
  "University Degree",
  "Professional League",
  "Other",
];

interface CertificationsMultiSelectProps {
  value: string[];
  onChange: (certifications: string[]) => void;
  disabled?: boolean;
}

export default function CertificationsMultiSelect({
  value,
  onChange,
  disabled = false,
}: CertificationsMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCertification = (cert: string) => {
    const updated = value.includes(cert) ? value.filter((c) => c !== cert) : [...value, cert];
    onChange(updated);
  };

  const removeCertification = (cert: string) => {
    onChange(value.filter((c) => c !== cert));
  };

  return (
    <div className="w-full">
      <div className="relative">
        {/* Selected Tags */}
        {value.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {value.map((cert) => (
              <div
                key={cert}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
              >
                <span>{cert}</span>
                <button
                  type="button"
                  onClick={() => removeCertification(cert)}
                  disabled={disabled}
                  className="transition-colors hover:text-blue-900"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <span className="text-slate-700">
            {value.length === 0 ? "Add certifications..." : `${value.length} added`}
          </span>
          <ChevronDown size={20} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg">
            {CERTIFICATIONS_OPTIONS.map((cert) => (
              <label
                key={cert}
                className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(cert)}
                  onChange={() => toggleCertification(cert)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                />
                <span className="text-sm text-slate-900">{cert}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

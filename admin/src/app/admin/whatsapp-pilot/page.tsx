"use client";

import { useState } from "react";
import { AccessTab } from "@/modules/whatsapp-pilot/components/AccessTab";
import { EnquiriesTab } from "@/modules/whatsapp-pilot/components/EnquiriesTab";
import { SummaryTab } from "@/modules/whatsapp-pilot/components/SummaryTab";

const TABS = [
  { id: "enquiries", label: "Enquiries" },
  { id: "summary", label: "Summary" },
  { id: "access", label: "Access" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WhatsAppPilotPage() {
  const [tab, setTab] = useState<TabId>("enquiries");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp pilot</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review what parents asked the assistant, what it advised and how each enquiry ended, and
          choose who can use it.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="WhatsApp pilot"
        className="flex gap-1 border-b border-slate-200"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "enquiries" && <EnquiriesTab />}
      {tab === "summary" && <SummaryTab />}
      {tab === "access" && (
        <div className="max-w-4xl">
          <AccessTab />
        </div>
      )}
    </div>
  );
}

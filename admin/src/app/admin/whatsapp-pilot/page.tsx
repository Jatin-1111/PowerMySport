"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { AccessTab } from "@/modules/whatsapp-pilot/components/AccessTab";
import { EnquiriesTab } from "@/modules/whatsapp-pilot/components/EnquiriesTab";
import { SummaryTab } from "@/modules/whatsapp-pilot/components/SummaryTab";
import { useState } from "react";

const TABS = [
  { id: "enquiries", label: "Enquiries" },
  { id: "summary", label: "Summary" },
  { id: "access", label: "Access" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WhatsAppPilotPage() {
  const [tab, setTab] = useState<TabId>("enquiries");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Overview"
        title="WhatsApp pilot"
        subtitle="What parents asked the assistant, what it advised and how each enquiry ended. Choose who can use it under Access."
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} label="WhatsApp pilot sections" />

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

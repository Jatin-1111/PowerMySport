"use client";

import { HandoffPage } from "@/modules/whatsapp-handoff/components/HandoffPage";
import { Suspense } from "react";

/** The link from the WhatsApp assistant: review what was kept and create the profiles. */
export default function StartPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <Suspense fallback={null}>
        <HandoffPage />
      </Suspense>
    </main>
  );
}

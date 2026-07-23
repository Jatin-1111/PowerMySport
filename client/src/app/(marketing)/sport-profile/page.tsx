"use client";

import { SportKnownFlow } from "@/modules/find-sport/components/SportKnownFlow";
import { useRouter } from "next/navigation";

export default function SportProfilePage() {
  const router = useRouter();
  return <SportKnownFlow onBack={() => router.push("/assessment")} />;
}

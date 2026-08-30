import { noindexMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { MyClassesClient } from "./MyClassesClient";

/**
 * Server shell for `/my-classes`. noindex — a signed-in student's own schedule.
 */
export const metadata: Metadata = noindexMetadata("My classes");

export default function Page() {
  return <MyClassesClient />;
}

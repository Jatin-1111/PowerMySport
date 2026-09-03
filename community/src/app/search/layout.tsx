import { buildMetadata } from "@/lib/seo";

// noindex, like every other results page: a search URL is a different page for
// every query string, and letting crawlers enumerate them buries the questions
// and stories those results point at.
export const metadata = buildMetadata({
  title: "Search",
  description: "Search questions and stories across the PowerMySport community.",
  path: "/search",
  noindex: true,
});

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import Link from "next/link";
import type { BlogListItem } from "@/modules/community/types";

export type ExperienceIndexRow = Pick<BlogListItem, "id" | "title" | "excerpt"> & {
  author?: { name?: string | null } | null;
};

/**
 * What the Experiences index shows until its client UI takes over.
 *
 * The landing UI reads `useSearchParams`, so the statically rendered page ships
 * only the Suspense fallback. That fallback used to be a spinner, which meant the
 * HTML a crawler received held no link to any article, and Google could only find
 * them through the sitemap. A real list of links, in a server component, puts
 * every recent post in the HTML a crawler and a slow connection both get.
 */
export default function ExperienceIndexFallback({ items }: { items: ExperienceIndexRow[] }) {
  if (items.length === 0) {
    return (
      <div className="community-page-shell">
        <div className="community-content-wrap border-border rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
          <p className="mt-4 text-sm text-slate-500">Loading experiences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="community-page-shell">
      <section className="community-content-wrap">
        <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-[1.08] sm:text-5xl">
          Parent experiences
        </h1>
        <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-base leading-relaxed sm:text-lg">
          Tournaments, academies, coaches, gear, travel and costs, written by parents who have been
          through it.
        </p>
        <ul className="mt-8 space-y-6">
          {items.map((post) => {
            const showExcerpt = post.excerpt && post.excerpt.trim() !== post.title.trim();
            return (
              <li key={post.id}>
                <Link
                  href={`/experiences/${post.id}`}
                  className="font-editorial text-ink decoration-ink/30 text-balance text-2xl font-normal leading-tight underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>
                {showExcerpt ? (
                  <p className="text-ink-body mt-2 line-clamp-2 text-base leading-relaxed">
                    {post.excerpt}
                  </p>
                ) : null}
                {post.author?.name ? (
                  <p className="text-ink-muted mt-1 text-sm">By {post.author.name}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

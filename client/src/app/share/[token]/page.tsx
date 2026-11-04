import { noindexMetadata } from "@/lib/seo";
import { PublicSharedProfile } from "@/modules/my-child/components/PublicSharedProfile";
import { fetchSharedProfile } from "@/modules/my-child/services/sharedProfile";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * A child's profile, shared by a parent with one person through a link.
 *
 * No sign-in: the secret in the path is the whole of who may read it. So the page is never
 * cached or indexed, does not pass its address on to other sites, and is drawn on the server so
 * the content is in the HTML. It carries no title naming the child, because a title is shown in
 * browser history and link previews.
 *
 * Metadata is static on purpose. A `generateMetadata` that fetched the profile would make a
 * second request for the same page and count the link as opened twice.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...noindexMetadata("Sporting profile"),
  referrer: "no-referrer",
};

export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await fetchSharedProfile(token);

  // A link we never issued is a plain 404, like any other address that is not a page.
  if (result.kind === "missing") notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {result.kind === "ok" ? (
        <PublicSharedProfile view={result.view} token={token} />
      ) : (
        <section
          role={result.kind === "gone" ? "status" : "alert"}
          className="border-hairline rounded-2xl border bg-white p-6 sm:p-8"
        >
          <h1 className="font-editorial text-ink text-3xl font-light">
            {result.kind === "gone"
              ? "This link is no longer active"
              : "This page could not be loaded"}
          </h1>
          <p className="text-ink-body mt-3 text-pretty">
            {result.kind === "gone" ? "Ask the family for a new one." : "Try again in a minute."}
          </p>
        </section>
      )}
    </main>
  );
}

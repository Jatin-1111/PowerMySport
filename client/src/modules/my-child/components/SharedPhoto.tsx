"use client";

import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

type State =
  { state: "idle" } | { state: "loading" } | { state: "ready"; url: string } | { state: "error" };

/**
 * The certificate photo behind one entry on a shared profile. A reader presses the button, the page
 * asks for a link that works for a few minutes, and the photo is shown. Nothing loads until then, so
 * opening a profile does not fetch images the reader may never look at.
 *
 * In the parent's preview nothing is fetched (`view` is left out): the parent sees that the photo is
 * part of the link, and the photo itself is not loaded for anyone.
 */
export function SharedPhoto({
  entryTitle,
  view,
}: {
  entryTitle: string;
  /** Asks for a viewing link. Left out in a preview. */
  view?: () => Promise<{ url: string }>;
}) {
  const [photo, setPhoto] = useState<State>({ state: "idle" });

  if (!view) {
    return <p className="text-ink-body mt-2 text-sm">A photo of the certificate is included.</p>;
  }

  const show = async () => {
    setPhoto({ state: "loading" });
    try {
      const { url } = await view();
      setPhoto({ state: "ready", url });
    } catch {
      setPhoto({ state: "error" });
    }
  };

  return (
    <div className="mt-2">
      {(photo.state === "idle" || photo.state === "error") && (
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={show}
          aria-label={`View the certificate for ${entryTitle}`}
        >
          View certificate
        </Button>
      )}

      {photo.state === "loading" && (
        <p role="status" className="text-ink-body text-sm">
          Loading the photo
        </p>
      )}

      {photo.state === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          This photo could not be shown. Try again.
        </p>
      )}

      {photo.state === "ready" && (
        <figure>
          {/* A short-lived signed link to private storage, so next/image cannot optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`Certificate for ${entryTitle}`}
            referrerPolicy="no-referrer"
            className="border-hairline max-h-[28rem] w-full rounded-xl border bg-white object-contain"
          />
          <figcaption className="text-ink-body mt-2 text-sm">
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-ink inline-flex min-h-11 items-center underline underline-offset-2"
            >
              Open or save the photo
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

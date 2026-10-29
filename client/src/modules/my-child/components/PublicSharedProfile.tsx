"use client";

import type { ChildSharePublicView } from "@powermysport/shared-types";
import { ContactRequestDialog } from "@/modules/my-child/components/ContactRequestDialog";
import { SharedProfile } from "@/modules/my-child/components/SharedProfile";
import { fetchSharedPlayback, sharedCvUrl } from "@/modules/my-child/services/sharedProfile";
import { Button } from "@/modules/shared/ui/Button";
import { useState } from "react";

/**
 * The shared profile on its public page, with the two things a coach can do with it.
 *
 * A client component because Play and the contact form have to ask the server from the browser,
 * and a function cannot be passed from a server page; the profile itself was drawn into the HTML
 * on the server. "Request contact" is the one orange action on the page. The CV is a plain link
 * to a file, so it works without any script.
 */
export function PublicSharedProfile({
  view,
  token,
}: {
  view: ChildSharePublicView;
  token: string;
}) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <SharedProfile
        view={view}
        play={(videoId) => fetchSharedPlayback(token, videoId)}
        actions={
          <>
            <Button className="min-h-11" onClick={() => setAsking(true)}>
              Request contact
            </Button>
            <a
              href={sharedCvUrl(token)}
              className="border-hairline text-ink hover:bg-paper-deep inline-flex min-h-11 items-center justify-center rounded-lg border px-6 text-base font-semibold"
            >
              Download CV (PDF)
            </a>
          </>
        }
      />
      <ContactRequestDialog isOpen={asking} onClose={() => setAsking(false)} token={token} />
    </>
  );
}

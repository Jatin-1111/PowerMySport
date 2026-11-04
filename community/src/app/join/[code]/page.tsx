"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";

type JoinStatus = "loading" | "success" | "error" | "redirecting";

const isValidInviteCode = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value !== "undefined" &&
    value !== "null"
  );
};

export default function JoinCommunityPage() {
  const params = useParams();
  const router = useRouter();
  const inviteCodeParam = params.code;
  const inviteCode = Array.isArray(inviteCodeParam) ? inviteCodeParam[0] : inviteCodeParam;

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const joinGroup = async () => {
      try {
        if (!isValidInviteCode(inviteCode)) {
          throw new Error("Invalid invite code");
        }

        setStatus("loading");
        const result = await communityService.joinGroupByCode(inviteCode.trim());

        if (!isActive) {
          return;
        }

        setStatus("success");

        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!isActive) {
          return;
        }

        setStatus("redirecting");

        // Navigate to the community page with a stable inbox/conversations context.
        router.push(
          `/chats?sidebar=conversations&conversation=${encodeURIComponent(result.conversationId)}`
        );
      } catch (joinError) {
        if (!isActive) {
          return;
        }

        const message =
          joinError instanceof Error ? joinError.message : "We could not add you to this group";
        setError(message);
        setStatus("error");
        toast.error(message);
      }
    };

    void joinGroup();

    return () => {
      isActive = false;
    };
  }, [inviteCode, router]);

  const btn =
    "btn-motion inline-flex min-h-12 flex-1 items-center justify-center rounded-md px-6 text-base font-semibold";

  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-md" role="status" aria-live="polite">
        {status === "loading" && (
          <>
            <p className="text-ink-muted text-sm">Invite link</p>
            <h1 className="font-editorial text-ink mt-2 text-4xl font-light leading-[1.1]">
              Joining the group
            </h1>
            <p className="text-ink-body mt-3 text-base leading-relaxed">
              One moment while we add you.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <p className="text-sm font-semibold text-green-800">Joined</p>
            <h1 className="font-editorial text-ink mt-2 text-4xl font-light leading-[1.1]">
              You are in.
            </h1>
            <p className="text-ink-body mt-3 text-base leading-relaxed">
              You have been added to the group. Taking you there now.
            </p>
          </>
        )}

        {status === "redirecting" && (
          <>
            <p className="text-ink-muted text-sm">Invite link</p>
            <h1 className="font-editorial text-ink mt-2 text-4xl font-light leading-[1.1]">
              Opening the group
            </h1>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-sm font-semibold text-red-700">Could not join</p>
            <h1 className="font-editorial text-ink mt-2 text-4xl font-light leading-[1.1]">
              That did not work.
            </h1>
            <p className="text-ink-body mt-3 text-base leading-relaxed">{error}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/")}
                className={`${btn} border-ink text-ink hover:bg-ink border hover:text-white`}
              >
                Go to community
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${btn} bg-power-orange-solid text-white hover:bg-indigo-700`}
              >
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

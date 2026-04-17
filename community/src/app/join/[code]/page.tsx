"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";

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
  const inviteCode = Array.isArray(inviteCodeParam)
    ? inviteCodeParam[0]
    : inviteCodeParam;

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinGroup = async () => {
      try {
        if (!isValidInviteCode(inviteCode)) {
          throw new Error("Invalid invite code");
        }

        setStatus("loading");
        const result = await communityService.joinGroupByCode(
          inviteCode.trim(),
        );

        setStatus("success");

        // Auto-redirect after 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setStatus("redirecting");

        // Navigate to the community page with a stable inbox/conversations context.
        router.push(
          `/?sidebar=inbox&conversation=${encodeURIComponent(result.conversationId)}`,
        );
      } catch {
        const message = "Failed to join community";
        setError(message);
        setStatus("error");
        toast.error(message);
      }
    };

    void joinGroup();
  }, [inviteCode, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] px-4 py-6 sm:py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-xl sm:p-8">
        {status === "loading" && (
          <div className="text-center">
            <Loader className="mx-auto h-12 w-12 animate-spin text-power-orange" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
              Joining Group...
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Please wait while we add you to the group
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-turf-green" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
              Successfully Joined!
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;ve been added to the community group. Redirecting...
            </p>
          </div>
        )}

        {status === "redirecting" && (
          <div className="text-center">
            <Loader className="mx-auto h-12 w-12 animate-spin text-power-orange" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
              Taking you to the group...
            </h2>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
              Could Not Join
            </h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-border bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                Go to Community
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-power-orange px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { walletApi } from "@/modules/wallet/services/wallet";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";

function VerifyWalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const merchantOrderId = searchParams.get("orderId");
  
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  
  useEffect(() => {
    if (merchantOrderId) {
      verifyTopUp(merchantOrderId);
    } else {
      setStatus("failed");
      toast.error("Invalid verification request");
    }
  }, [merchantOrderId]);

  const verifyTopUp = async (orderId: string) => {
    try {
      const response = await walletApi.verifyTopUp(orderId);
      if (response.status === "COMPLETED") {
        setStatus("success");
      } else {
        setStatus("failed");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      setStatus("failed");
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-power-orange" />
          <h2 className="text-2xl font-bold text-slate-900">Verifying Payment...</h2>
          <p className="text-slate-500">Please wait while we confirm your top-up.</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <h2 className="text-2xl font-bold text-slate-900">Top-up Successful!</h2>
          <p className="text-slate-500">Your wallet balance has been updated.</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard/wallet")}>
            Return to Wallet
          </Button>
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-16 w-16 text-rose-500" />
          <h2 className="text-2xl font-bold text-slate-900">Payment Failed</h2>
          <p className="text-slate-500">We couldn't verify your top-up payment.</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/dashboard/wallet")}>
            Return to Wallet
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VerifyWalletPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-power-orange" />
      </div>
    }>
      <VerifyWalletContent />
    </Suspense>
  );
}

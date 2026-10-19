"use client";

import { Input } from "@/modules/shared/ui/Input";
import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { Wallet, walletApi } from "@/modules/wallet/services/wallet";
import { History, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState } from "react";

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch (error) {
      toast.error("Failed to load wallet data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!amount || amount < 1) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsToppingUp(true);
    try {
      const response = await walletApi.topUpWallet(amount);
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
      } else {
        toast.error("Failed to initiate payment");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to top up wallet");
    } finally {
      setIsToppingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="bg-paper-deep h-10 w-56 animate-pulse rounded-lg" />
          <div className="bg-paper-deep h-5 w-72 animate-pulse rounded-lg" />
        </div>
        <div className="bg-paper-deep h-40 animate-pulse rounded-xl" />
      </div>
    );
  }

  const transactions = wallet?.transactions || [];

  return (
    <div className="space-y-10">
      <PlayerPageHeader
        title="My wallet"
        subtitle="Manage your funds, add money, and view transaction history."
        action={
          <Button onClick={() => setIsTopUpOpen(!isTopUpOpen)} icon={<WalletIcon size={16} />}>
            Add funds
          </Button>
        }
      />

      <SlideUp delay={0.1}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-labelledby="wallet-balance" className="space-y-4">
            <div className="bg-paper-deep rounded-xl p-6">
              <p id="wallet-balance" className="text-ink-muted text-sm">
                Available balance
              </p>
              <p className="text-ink mt-3 text-5xl font-light tabular-nums leading-none tracking-tight">
                ₹{wallet?.balance.toFixed(2) || "0.00"}
              </p>
            </div>

            {isTopUpOpen && (
              <FadeIn className="border-hairline space-y-4 rounded-xl border bg-white p-5">
                <div>
                  <label htmlFor="wallet-topup" className="text-ink mb-2 block text-sm font-medium">
                    Amount to add (₹)
                  </label>
                  <Input
                    id="wallet-topup"
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {[500, 1000, 2000].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setTopUpAmount(amt.toString())}
                    >
                      ₹{amt}
                    </Button>
                  ))}
                </div>
                <Button
                  fullWidth
                  onClick={handleTopUp}
                  disabled={isToppingUp || !topUpAmount}
                  loading={isToppingUp}
                >
                  {isToppingUp ? "Processing" : "Proceed to pay"}
                </Button>
              </FadeIn>
            )}
          </section>

          <section aria-labelledby="wallet-transactions">
            <h2
              id="wallet-transactions"
              className="font-editorial text-ink border-hairline border-b pb-4 text-2xl font-light tracking-tight"
            >
              Recent transactions
            </h2>
            {transactions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No transactions yet"
                description="Money you add, spend or get back as a refund will show up here."
              />
            ) : (
              <ul className="divide-hairline divide-y">
                {transactions.map((tx) => {
                  const isCredit = tx.type === "CREDIT";
                  const isRefund =
                    isCredit &&
                    typeof tx.reason === "string" &&
                    tx.reason.toLowerCase().includes("refund");
                  return (
                    <li key={tx.id} className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="text-ink font-medium">
                          {tx.reason}
                          {isRefund && (
                            <span className="text-ink-muted font-normal"> · Refund</span>
                          )}
                        </p>
                        <p className="text-ink-muted mt-0.5 text-sm tabular-nums">
                          {new Date(tx.createdAt).toLocaleDateString()} at{" "}
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-ink font-medium tabular-nums">
                          {isCredit ? "+" : "−"}₹{tx.amount.toFixed(2)}
                        </p>
                        {tx.status !== "COMPLETED" && (
                          <p
                            className={`mt-0.5 text-sm ${
                              tx.status === "PENDING" ? "text-amber-700" : "text-error-red"
                            }`}
                          >
                            {tx.status === "PENDING" ? "Pending" : "Failed"}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </SlideUp>
    </div>
  );
}

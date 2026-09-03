"use client";

import { Badge } from "@/modules/shared/ui/Badge";
import { Input } from "@/modules/shared/ui/Input";
import { toast } from "@/lib/toast";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/Card";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { Wallet, walletApi } from "@/modules/wallet/services/wallet";
import { ArrowDownRight, ArrowUpRight, History, Wallet as WalletIcon } from "lucide-react";
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm sm:p-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-3 h-5 w-64 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  const transactions = wallet?.transactions || [];

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        title="My Wallet"
        subtitle="Manage your funds, add money, and view transaction history."
        action={
          <Button onClick={() => setIsTopUpOpen(!isTopUpOpen)} icon={<WalletIcon size={16} />}>
            Add Funds
          </Button>
        }
      />

      <SlideUp delay={0.1}>
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3">
          <div className="md:col-span-1">
            <Card className="relative h-full overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl transition-all hover:shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]">
              {/* Premium Glow Effects */}
              <div className="bg-power-orange/20 pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px]" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />

              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/80">
                  Available Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-extrabold text-white drop-shadow-md">
                    ₹{wallet?.balance.toFixed(2) || "0.00"}
                  </span>
                  <div className="flex h-12 w-16 items-center justify-center rounded-lg border border-white/30 bg-white/20 shadow-inner backdrop-blur-md">
                    <WalletIcon className="h-6 w-6 text-white" />
                  </div>
                </div>

                {isTopUpOpen && (
                  <FadeIn className="mt-8 space-y-4 rounded-xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Add Funds (₹)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 500"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="focus:ring-power-orange/50 border-white/20 bg-white/90 text-slate-900 shadow-inner transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      {[500, 1000, 2000].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-white/20 bg-white/10 font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
                          onClick={() => setTopUpAmount(amt.toString())}
                        >
                          ₹{amt}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-white font-bold text-slate-900 shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:bg-slate-100"
                      onClick={handleTopUp}
                      disabled={isToppingUp || !topUpAmount}
                    >
                      {isToppingUp ? "Processing..." : "Proceed to Pay"}
                    </Button>
                  </FadeIn>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="shop-surface premium-shadow h-full border-0 bg-white/70 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-100/60 pb-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-500" />
                  <CardTitle>Recent Transactions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-slate-500">No transactions found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              tx.type === "CREDIT"
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            {tx.type === "CREDIT" ? (
                              <ArrowDownRight size={20} />
                            ) : (
                              <ArrowUpRight size={20} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{tx.reason}</p>
                              {tx.type === "CREDIT" &&
                                typeof tx.reason === "string" &&
                                tx.reason.toLowerCase().includes("refund") && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    Refund
                                  </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(tx.createdAt).toLocaleDateString()} at{" "}
                              {new Date(tx.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${tx.type === "CREDIT" ? "text-emerald-600" : "text-slate-900"}`}
                          >
                            {tx.type === "CREDIT" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                          </p>
                          <Badge
                            className={`mt-1 text-[10px] ${
                              tx.status === "COMPLETED"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : tx.status === "PENDING"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SlideUp>
    </div>
  );
}

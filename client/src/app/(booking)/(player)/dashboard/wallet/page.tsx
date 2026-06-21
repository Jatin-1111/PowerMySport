"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Wallet as WalletIcon, CreditCard, ArrowDownRight, ArrowUpRight, History } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { walletApi, Wallet, WalletTransaction } from "@/modules/wallet/services/wallet";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";

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
          <Button 
            onClick={() => setIsTopUpOpen(!isTopUpOpen)} 
            icon={<WalletIcon size={16} />}
          >
            Add Funds
          </Button>
        }
      />

      <SlideUp delay={0.1}>
        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3">
          <div className="md:col-span-1">
            <Card className="relative overflow-hidden border-0 shadow-2xl h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-all hover:shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]">
              {/* Premium Glow Effects */}
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-power-orange/20 blur-[80px] pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px] pointer-events-none" />
              
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-white/80 uppercase tracking-wider">
                  Available Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-extrabold text-white drop-shadow-md">
                    ₹{wallet?.balance.toFixed(2) || "0.00"}
                  </span>
                  <div className="h-12 w-16 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner">
                    <WalletIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                
                {isTopUpOpen && (
                  <FadeIn className="mt-8 space-y-4 rounded-xl bg-white/10 backdrop-blur-md p-5 border border-white/20 shadow-xl">
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">
                        Add Funds (₹)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 500"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="bg-white/90 border-white/20 text-slate-900 placeholder:text-slate-400 focus:ring-power-orange/50 transition-all shadow-inner"
                      />
                    </div>
                    <div className="flex gap-2">
                      {[500, 1000, 2000].map(amt => (
                        <Button 
                          key={amt} 
                          variant="outline" 
                          size="sm"
                          className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all font-medium backdrop-blur-sm"
                          onClick={() => setTopUpAmount(amt.toString())}
                        >
                          ₹{amt}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02]" 
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
                      <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            tx.type === "CREDIT" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                          }`}>
                            {tx.type === "CREDIT" ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{tx.reason}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.type === "CREDIT" ? "text-emerald-600" : "text-slate-900"}`}>
                            {tx.type === "CREDIT" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                          </p>
                          <Badge className={`mt-1 text-[10px] ${
                            tx.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                            tx.status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" : 
                            "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
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

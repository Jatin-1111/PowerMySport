"use client";

import { formatInr } from "@/lib/shop/format";
import { walletApi, type Wallet as WalletType } from "@/modules/wallet/services/wallet";
import { cn } from "@/utils/cn";
import { CreditCard, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export function BalanceView() {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch (err: any) {
      setError(err.message || "Failed to load wallet details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleAddFunds = () => {
    window.location.href = "/dashboard/wallet";
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#ff5722]" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const balance = wallet ? wallet.balance : 0;
  const transactions = wallet ? wallet.transactions : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">PowerMySport Wallet</h2>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff5722] opacity-20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Available Balance
            </p>
            <p className="mt-2 text-5xl font-black text-white">{formatInr(balance)}</p>
          </div>
          <button
            onClick={handleAddFunds}
            className="flex items-center gap-2 rounded-xl bg-[#ff5722] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#ff5722]/30 transition-all hover:bg-[#e64a19] active:scale-95"
          >
            <CreditCard className="h-4 w-4" />
            Add Funds
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
            No transactions recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full font-bold",
                      t.type === "CREDIT"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-red-100 text-red-600"
                    )}
                  >
                    {t.type === "CREDIT" ? "+" : "-"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {t.reason || (t.type === "CREDIT" ? "Wallet Topup" : "Purchase")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "font-bold",
                    t.type === "CREDIT" ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {t.type === "CREDIT" ? "+" : "-"} {formatInr(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

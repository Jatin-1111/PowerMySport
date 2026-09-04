"use client";

import { AddressManagement } from "@/modules/shop/components/AddressManagement";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, CreditCard, Heart, MapPin, Package, UserSquare, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { OrdersView } from "./views/OrdersView";
import { BalanceView } from "./views/BalanceView";
import { SavedItemsView } from "./views/SavedItemsView";
import { ContactView } from "./views/ContactView";
import { SellerDashboardView } from "./views/SellerDashboardView";

const tabs = [
  { id: "orders", name: "Orders", icon: Package },
  { id: "balance", name: "Balance Amount", icon: Wallet },
  { id: "saved", name: "Saved Items", icon: Heart },
  { id: "address", name: "Address", icon: MapPin },
  { id: "contact", name: "Contact Details", icon: UserSquare },
  { id: "selling", name: "Seller Dashboard", icon: CreditCard },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && tabs.some((t) => t.id === tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tabId);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">My Account</h1>
        <p className="mt-2 text-slate-500">Manage your orders, balance, and personal details.</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-72">
          <nav className="flex flex-col gap-2 rounded-[2rem] border border-slate-200/60 bg-white p-4 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-2xl px-4 py-4 text-sm font-bold transition-all",
                    isActive
                      ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform group-hover:scale-110",
                        isActive ? "text-white" : "text-slate-400"
                      )}
                    />
                    {tab.name}
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isActive ? "text-white/80" : "text-slate-300 group-hover:translate-x-1"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-h-[500px] flex-1 rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "orders" && <OrdersView />}
              {activeTab === "balance" && <BalanceView />}
              {activeTab === "saved" && <SavedItemsView />}
              {activeTab === "address" && <AddressManagement />}
              {activeTab === "contact" && <ContactView />}
              {activeTab === "selling" && <SellerDashboardView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

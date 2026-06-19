"use client";

import React, { useState } from "react";
import { Package, Wallet, MapPin, UserSquare, ChevronRight, CreditCard, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";

const tabs = [
  { id: "orders", name: "Orders", icon: Package },
  { id: "balance", name: "Balance Amount", icon: Wallet },
  { id: "address", name: "Address", icon: MapPin },
  { id: "contact", name: "Contact Details", icon: UserSquare },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("orders");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">My Account</h1>
        <p className="mt-2 text-slate-500">Manage your orders, balance, and personal details.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <nav className="flex flex-col gap-2 rounded-[2rem] border border-slate-200/60 bg-white p-4 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-2xl px-4 py-4 text-sm font-bold transition-all",
                    isActive
                      ? "bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400")} />
                    {tab.name}
                  </div>
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isActive ? "text-white/80" : "text-slate-300 group-hover:translate-x-1")} />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 rounded-[2rem] border border-slate-200/60 bg-white p-6 sm:p-10 shadow-sm min-h-[500px]">
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
              {activeTab === "address" && <AddressView />}
              {activeTab === "contact" && <ContactView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function OrdersView() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">Recent Orders</h2>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 p-6 transition-all hover:border-[#ff5722]/30 hover:shadow-md">
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Order #PMS-2026{i}4A</p>
                <p className="text-sm text-slate-500">Placed on June 1{i}, 2026</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">
                  Delivered
                </span>
              </div>
            </div>
            <div className="mt-2 sm:mt-0 flex w-full sm:w-auto flex-row sm:flex-col items-center sm:items-end justify-between gap-2">
              <p className="font-black text-lg text-slate-900">₹4,250.00</p>
              <button className="text-sm font-bold text-[#ff5722] hover:underline">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceView() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900">PowerMySport Wallet</h2>
      
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff5722] opacity-20 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Available Balance</p>
            <p className="mt-2 text-5xl font-black text-white">₹12,450</p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-[#ff5722] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#ff5722]/30 transition-all hover:bg-[#e64a19] active:scale-95">
            <CreditCard className="h-4 w-4" />
            Add Funds
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl p-4 bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                +
              </div>
              <div>
                <p className="font-bold text-slate-900">Cashback received</p>
                <p className="text-xs text-slate-500">June 15, 2026</p>
              </div>
            </div>
            <p className="font-bold text-green-600">+ ₹250.00</p>
          </div>
          <div className="flex items-center justify-between rounded-xl p-4 bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                -
              </div>
              <div>
                <p className="font-bold text-slate-900">Purchase - Order #PMS-202614A</p>
                <p className="text-xs text-slate-500">June 10, 2026</p>
              </div>
            </div>
            <p className="font-bold text-red-600">- ₹4,250.00</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Saved Addresses</h2>
        <button className="text-sm font-bold text-[#ff5722] hover:underline">+ Add New</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative rounded-2xl border-2 border-[#ff5722]/20 bg-[#ff5722]/5 p-6 transition-all hover:border-[#ff5722]/40">
          <span className="absolute right-4 top-4 rounded-full bg-[#ff5722] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
            Default
          </span>
          <div className="flex items-start gap-4">
            <MapPin className="h-5 w-5 mt-1 text-[#ff5722]" />
            <div>
              <p className="font-bold text-slate-900">Home Address</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                A-124, Rosewood Apartments,<br />
                Koramangala, 5th Block,<br />
                Bengaluru, Karnataka 560095<br />
                India
              </p>
              <div className="mt-4 flex gap-4">
                <button className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900">
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Contact Details</h2>
        <button className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900">
          <Edit2 className="h-4 w-4" /> Edit Profile
        </button>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
          <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg">
            <UserSquare className="h-10 w-10 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Rajni Narang</h3>
            <p className="text-sm text-slate-500">Member since 2024</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</p>
            <p className="mt-1 font-semibold text-slate-900">Rajni Narang</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</p>
            <p className="mt-1 font-semibold text-slate-900">rajni@example.com</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</p>
            <p className="mt-1 font-semibold text-slate-900">+91 98765 43210</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferred Sport</p>
            <p className="mt-1 font-semibold text-slate-900">Running, Tennis</p>
          </div>
        </div>
      </div>
    </div>
  );
}

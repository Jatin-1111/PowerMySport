"use client";

import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight, BellRing } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import axiosInstance from "@/lib/api/axios";
import { toast } from "sonner";

export default function ShopWaitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      await axiosInstance.post("/v1/waitlist", { email });
      setSubmitted(true);
      toast.success("Successfully joined the waitlist!");
      setTimeout(() => setSubmitted(false), 3000);
      setEmail("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex-1 w-full overflow-hidden bg-slate-50 flex flex-col items-center justify-center font-sans py-12 -mb-12">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-power-orange/20 blur-[120px] mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-amber-400/20 blur-[120px] mix-blend-multiply pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-3xl px-6 py-12 flex flex-col items-center text-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#E97316,#F59E0B)] shadow-2xl shadow-power-orange/30"
        >
          <ShoppingBag className="text-white" size={48} strokeWidth={1.5} />
        </motion.div>

        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
          Gear Up. <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
            Coming Soon.
          </span>
        </h1>

        <p className="mb-10 max-w-xl text-lg text-slate-600 sm:text-xl">
          The official PowerMySport Shop is almost here. Get ready to elevate
          your game with premium sports gear, customized equipment, and
          exclusive coaching bundles.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md relative mb-12"
        >
          <div className="relative flex items-center">
            <BellRing className="absolute left-4 text-slate-400" size={20} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Get notified when we launch"
              required
              className="w-full rounded-full border border-slate-200 bg-white/80 py-4 pl-12 pr-36 text-sm text-slate-900 shadow-sm outline-none backdrop-blur-xl transition-all focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 flex items-center justify-center rounded-full bg-power-orange px-6 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Joining..." : submitted ? "Subscribed!" : "Notify Me"}
            </button>
          </div>
        </form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex gap-4"
        >
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm border border-slate-200 transition-all hover:border-power-orange/30 hover:shadow-md"
          >
            Back to Dashboard
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

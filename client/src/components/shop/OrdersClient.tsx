"use client";

import { listOrders, type Order } from "@/lib/shop/ecommerce-api";
import { formatInr } from "@/lib/shop/format";
import { motion } from "framer-motion";
import { PackageCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<
    "loading" | "ready" | "signed-out" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  async function loadOrders() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    if (!token) {
      setStatus("signed-out");
      return;
    }

    setStatus("loading");
    try {
      const data = await listOrders({ page: 1, limit: 20 });
      setOrders(data.orders);
      setStatus("ready");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load orders.",
      );
      setStatus("error");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
            Order History
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Your orders
          </h1>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {status === "loading" ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : null}

      {status === "signed-out" ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-slate-950">
            Sign in to view backend orders
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Local demo checkout clears the cart immediately. Authenticated
            checkout creates server orders that appear here.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white"
          >
            Sign In
          </Link>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {message}
        </div>
      ) : null}

      {status === "ready" && orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-4 text-xl font-black text-slate-950">
            No orders yet
          </h2>
          <p className="mt-2 text-slate-600">
            Your completed shop orders will appear here.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white"
          >
            Start Shopping
          </Link>
        </div>
      ) : null}

      {status === "ready" && orders.length > 0 ? (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <motion.article
              key={order.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    {order.orderNumber}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {formatInr(order.totalAmount)}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                  {order.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Placed {new Date(order.createdAt).toLocaleString("en-IN")}
              </p>
            </motion.article>
          ))}
        </div>
      ) : null}
    </main>
  );
}

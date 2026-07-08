"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import {
    StaggerContainer,
    StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { ClientSummary } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import {
    Activity,
    Calendar,
    ChevronRight,
    Clock,
    Dumbbell,
    Search,
    User,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type FilterTab = "All" | "Active" | "Inactive";

// ─── skeleton ───────────────────────────────────────────────────────────────

function ClientCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
        <div className="w-16 h-6 bg-slate-100 rounded-full" />
      </div>
      <div className="flex gap-2 mb-5">
        <div className="h-6 w-20 bg-slate-100 rounded-full" />
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="flex justify-between mb-5">
        <div className="h-10 w-24 bg-slate-100 rounded-xl" />
        <div className="h-10 w-24 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-9 bg-slate-100 rounded-xl" />
    </div>
  );
}

// ─── stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`rounded-2xl border p-5 flex items-center gap-4 ${
        accent
          ? "bg-power-orange border-power-orange text-white"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          accent ? "bg-white/20" : "bg-orange-50"
        }`}
      >
        <span className={accent ? "text-white" : "text-power-orange"}>
          {icon}
        </span>
      </div>
      <div>
        <p
          className={`text-2xl font-bold leading-none ${accent ? "text-white" : "text-slate-900"}`}
        >
          {value}
        </p>
        <p
          className={`text-sm mt-0.5 ${accent ? "text-orange-100" : "text-slate-500"}`}
        >
          {label}
        </p>
        {sub && (
          <p
            className={`text-xs mt-0.5 ${accent ? "text-orange-200" : "text-slate-400"}`}
          >
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── client card ─────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: ClientSummary }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 hover:shadow-md hover:border-orange-200 transition-all duration-200">
      {/* header row */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-power-orange flex items-center justify-center text-white font-bold text-base shrink-0 select-none">
          {getInitials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{client.name}</p>
          <p className="text-sm text-slate-500 truncate">{client.email}</p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            client.isActive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {client.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* sport tags */}
      {client.sports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {client.sports.map((sport) => (
            <span
              key={sport}
              className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-xs font-medium px-2.5 py-1 rounded-full border border-orange-100"
            >
              <Dumbbell className="w-3 h-3" />
              {sport}
            </span>
          ))}
        </div>
      )}

      {/* stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-xs">Sessions</span>
          </div>
          <p className="text-lg font-bold text-slate-900 leading-none">
            {client.totalSessions}
          </p>
          <p className="text-xs text-slate-400">
            {client.completedSessions} completed
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs">Last session</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">
            {formatDate(client.lastSessionDate)}
          </p>
          {client.firstSessionDate && (
            <p className="text-xs text-slate-400">
              Since {formatDate(client.firstSessionDate)}
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link href={`/coach/clients/${client.clientId}`} className="block">
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={<ChevronRight className="w-4 h-4" />}
          className="justify-between"
        >
          View Profile
        </Button>
      </Link>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function CoachClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setIsLoading(true);
        const res = await coachApi.getClients();
        if (res.success && res.data) {
          setClients(res.data);
        } else {
          toast.error(res.message ?? "Failed to load clients.");
        }
      } catch {
        toast.error("Something went wrong while fetching clients.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClients();
  }, []);

  // derived stats
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.isActive).length;
  const avgSessions =
    totalClients > 0
      ? Math.round(
          clients.reduce((sum, c) => sum + c.totalSessions, 0) / totalClients,
        )
      : 0;

  // filtered list
  const filtered = useMemo(() => {
    let list = clients;

    if (activeTab === "Active") list = list.filter((c) => c.isActive);
    else if (activeTab === "Inactive") list = list.filter((c) => !c.isActive);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.sports.some((s) => s.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [clients, activeTab, search]);

  const tabs: FilterTab[] = ["All", "Active", "Inactive"];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── page header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-power-orange flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Clients &amp; Athletes
              </h1>
            </div>
            <p className="text-slate-500 text-sm ml-[52px]">
              Manage your roster, track sessions, and view athlete profiles.
            </p>
          </div>
        </motion.div>

        {/* ── stats row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total Clients"
            value={totalClients}
            accent
          />
          <StatCard
            icon={<User className="w-5 h-5" />}
            label="Active Clients"
            value={activeClients}
            sub={
              totalClients > 0
                ? `${Math.round((activeClients / totalClients) * 100)}% of roster`
                : undefined
            }
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Avg Sessions / Client"
            value={avgSessions}
          />
        </div>

        {/* ── search + filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email or sport…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
            />
          </div>

          {/* filter tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 self-start sm:self-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-power-orange text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── loading skeletons ── */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ClientCardSkeleton />
            <ClientCardSkeleton />
            <ClientCardSkeleton />
          </div>
        )}

        {/* ── client grid ── */}
        {!isLoading && filtered.length > 0 && (
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((client) => (
                <StaggerItem key={client.clientId}>
                  <ClientCard client={client} />
                </StaggerItem>
              ))}
            </AnimatePresence>
          </StaggerContainer>
        )}

        {/* ── empty state ── */}
        {!isLoading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
              <Users className="w-9 h-9 text-slate-300" />
            </div>
            {search || activeTab !== "All" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  No clients match your search
                </h3>
                <p className="text-slate-500 text-sm max-w-xs">
                  Try adjusting your search term or changing the filter tab.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveTab("All");
                  }}
                  className="mt-4 text-power-orange text-sm font-medium hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  No clients yet
                </h3>
                <p className="text-slate-500 text-sm max-w-xs">
                  Once athletes book sessions with you, they will appear here so
                  you can track their progress.
                </p>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

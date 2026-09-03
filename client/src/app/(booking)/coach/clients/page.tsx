"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { StaggerContainer, StaggerItem } from "@/modules/shared/ui/motion/StaggerContainer";
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
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="mb-5 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-slate-100" />
        <div className="h-6 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="mb-5 flex justify-between">
        <div className="h-10 w-24 rounded-xl bg-slate-100" />
        <div className="h-10 w-24 rounded-xl bg-slate-100" />
      </div>
      <div className="h-9 rounded-xl bg-slate-100" />
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
      className={`flex items-center gap-4 rounded-2xl border p-5 ${
        accent
          ? "bg-power-orange border-power-orange text-white"
          : "border-slate-200 bg-white text-slate-800"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          accent ? "bg-white/20" : "bg-orange-50"
        }`}
      >
        <span className={accent ? "text-white" : "text-power-orange"}>{icon}</span>
      </div>
      <div>
        <p
          className={`text-2xl leading-none font-bold ${accent ? "text-white" : "text-slate-900"}`}
        >
          {value}
        </p>
        <p className={`mt-0.5 text-sm ${accent ? "text-orange-100" : "text-slate-500"}`}>{label}</p>
        {sub && (
          <p className={`mt-0.5 text-xs ${accent ? "text-orange-200" : "text-slate-400"}`}>{sub}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── client card ─────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: ClientSummary }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-orange-200 hover:shadow-md">
      {/* header row */}
      <div className="flex items-start gap-4">
        <div className="bg-power-orange flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white select-none">
          {getInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{client.name}</p>
          <p className="truncate text-sm text-slate-500">{client.email}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            client.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
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
              className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600"
            >
              <Dumbbell className="h-3 w-3" />
              {sport}
            </span>
          ))}
        </div>
      )}

      {/* stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-xs">Sessions</span>
          </div>
          <p className="text-lg leading-none font-bold text-slate-900">{client.totalSessions}</p>
          <p className="text-xs text-slate-400">{client.completedSessions} completed</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">Last session</span>
          </div>
          <p className="text-sm leading-tight font-semibold text-slate-900">
            {formatDate(client.lastSessionDate)}
          </p>
          {client.firstSessionDate && (
            <p className="text-xs text-slate-400">Since {formatDate(client.firstSessionDate)}</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link href={`/coach/clients/${client.clientId}`} className="block">
        <Button
          variant="outline"
          size="sm"
          fullWidth
          icon={<ChevronRight className="h-4 w-4" />}
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
        toast.error("Unable to load clients.");
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
      ? Math.round(clients.reduce((sum, c) => sum + c.totalSessions, 0) / totalClients)
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
          c.sports.some((s) => s.toLowerCase().includes(q))
      );
    }

    return list;
  }, [clients, activeTab, search]);

  const tabs: FilterTab[] = ["All", "Active", "Inactive"];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── page header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="bg-power-orange flex h-10 w-10 items-center justify-center rounded-xl">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Clients &amp; Athletes
              </h1>
            </div>
            <p className="ml-[52px] text-sm text-slate-500">
              Manage your roster, track sessions, and view athlete profiles.
            </p>
          </div>
        </motion.div>

        {/* ── stats row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total Clients"
            value={totalClients}
            accent
          />
          <StatCard
            icon={<User className="h-5 w-5" />}
            label="Active Clients"
            value={activeClients}
            sub={
              totalClients > 0
                ? `${Math.round((activeClients / totalClients) * 100)}% of roster`
                : undefined
            }
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Avg Sessions / Client"
            value={avgSessions}
          />
        </div>

        {/* ── search + filters ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or sport…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-orange-400 focus:outline-none"
            />
          </div>

          {/* filter tabs */}
          <div className="flex items-center gap-1 self-start rounded-xl border border-slate-200 bg-white p-1 sm:self-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ClientCardSkeleton />
            <ClientCardSkeleton />
            <ClientCardSkeleton />
          </div>
        )}

        {/* ── client grid ── */}
        {!isLoading && filtered.length > 0 && (
          <StaggerContainer className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Users className="h-9 w-9 text-slate-300" />
            </div>
            {search || activeTab !== "All" ? (
              <>
                <h3 className="mb-1 text-lg font-semibold text-slate-800">
                  No clients match your search
                </h3>
                <p className="max-w-xs text-sm text-slate-500">
                  Try adjusting your search term or changing the filter tab.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveTab("All");
                  }}
                  className="text-power-orange mt-4 text-sm font-medium hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h3 className="mb-1 text-lg font-semibold text-slate-800">No clients yet</h3>
                <p className="max-w-xs text-sm text-slate-500">
                  Once athletes book sessions with you, they will appear here so you can track their
                  progress.
                </p>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

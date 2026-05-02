"use client";

import React, { useState } from "react";
import { useActiveGroup } from "@/modules/community/context/ActiveGroupContext";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/components/ui/input";

export function GroupToolsPanel() {
  const { activeGroupId, setActiveGroupId } = useActiveGroup();
  const [workflowTab, setWorkflowTab] = useState<
    "discover" | "manage" | "invite"
  >("discover");
  const [mode, setMode] = useState<"all" | "joined" | "discover">("discover");
  const [query, setQuery] = useState("");

  return (
    <aside className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-500">GROUP TOOLS</h3>

      <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          WORKFLOW
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setWorkflowTab("discover")}
            className={`w-full rounded-md py-2 text-sm font-semibold transition-colors ${
              workflowTab === "discover"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => setWorkflowTab("manage")}
            className={`w-full rounded-md py-2 text-sm font-semibold transition-colors ${
              workflowTab === "manage"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            Manage
          </button>
          <button
            onClick={() => setWorkflowTab("invite")}
            className={`w-full rounded-md py-2 text-sm font-semibold transition-colors ${
              workflowTab === "invite"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            Invite
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-600">
          Use Discover to join groups, Manage for policy and controls, and
          Invite to share group access.
        </p>

        {/* Modes */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMode("joined")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "joined"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            Joined
          </button>
          <button
            onClick={() => setMode("discover")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "discover"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-100"
            }`}
          >
            Discover
          </button>
          <div className="ml-auto">
            <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
              New group
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <Input
            placeholder="Search groups by name, sport, city"
            value={query}
            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </div>

        {/* Content area */}
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
          {activeGroupId ? (
            <div>
              <p className="font-semibold text-slate-800">Active group</p>
              <p className="mt-1 text-xs text-slate-600">{activeGroupId}</p>
              <div className="mt-3 flex justify-center">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveGroupId(null)}
                >
                  Close group
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Other group tools are locked while a group is active.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-700">
                No discoverable groups right now. Try changing search or switch
                to All mode.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

"use client";

import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import {
  clientFollowStore,
  FollowItem,
} from "@/modules/shared/lib/followStore";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Bookmark, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function SavedPage() {
  const [items, setItems] = useState<FollowItem[]>([]);

  useEffect(() => {
    setItems(clientFollowStore.getAll());
  }, []);

  const savedCoaches = useMemo(
    () => items.filter((item) => item.kind === "coach"),
    [items],
  );
  const savedVenues = useMemo(
    () => items.filter((item) => item.kind === "venue"),
    [items],
  );

  const removeItem = (item: FollowItem) => {
    clientFollowStore.toggle({
      id: item.id,
      label: item.label,
      subtitle: item.subtitle,
      href: item.href,
      kind: item.kind,
    });
    setItems(clientFollowStore.getAll());
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_52%,#fff8ee_100%)] flex flex-col">
      <Navigation sticky />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-power-orange/15 text-power-orange">
                <Bookmark size={18} />
              </span>
              <div>
                <h1 className="font-title text-2xl font-semibold text-slate-900">
                  Saved & Followed
                </h1>
                <p className="text-sm text-slate-600">
                  Quick access to coaches and venues you plan to revisit.
                </p>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-8 text-center">
              <p className="text-slate-700 font-medium">No saved items yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Use the Save button on coach and venue cards to build your
                shortlist.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={16} className="text-turf-green" />
                  <h2 className="font-semibold text-slate-900">Coaches</h2>
                </div>
                <div className="space-y-2">
                  {savedCoaches.length === 0 ? (
                    <p className="text-sm text-slate-500">No saved coaches.</p>
                  ) : (
                    savedCoaches.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-slate-500">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={item.href}
                            className="text-xs font-semibold text-power-orange hover:underline inline-flex items-center gap-1"
                          >
                            Open
                            <ExternalLink size={12} />
                          </Link>
                          <button
                            onClick={() => removeItem(item)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-power-orange" />
                  <h2 className="font-semibold text-slate-900">Venues</h2>
                </div>
                <div className="space-y-2">
                  {savedVenues.length === 0 ? (
                    <p className="text-sm text-slate-500">No saved venues.</p>
                  ) : (
                    savedVenues.map((item) => (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-slate-500">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={item.href}
                            className="text-xs font-semibold text-power-orange hover:underline inline-flex items-center gap-1"
                          >
                            Open
                            <ExternalLink size={12} />
                          </Link>
                          <button
                            onClick={() => removeItem(item)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/venues">Discover more venues</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

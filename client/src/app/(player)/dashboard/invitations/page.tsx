"use client";

import { useEffect, useState } from "react";
import { bookingApi } from "@/modules/booking/services/booking";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  IndianRupee,
  History,
} from "lucide-react";
import { motion } from "framer-motion";

interface BookingInvitation {
  id: string;
  bookingId: any;
  inviterId: {
    name: string;
    email: string;
    photoUrl?: string;
  };
  venueId: {
    name: string;
    address: string;
  };
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  estimatedAmount: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<BookingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const data = await bookingApi.getMyInvitations();
      setInvitations(data);
    } catch (error) {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (invitationId: string, accept: boolean) => {
    try {
      await bookingApi.respondToInvitation(invitationId, accept);
      toast.success(accept ? "Invitation accepted!" : "Invitation declined");
      loadInvitations();
    } catch (error) {
      toast.error("Failed to respond to invitation");
    }
  };

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "PENDING",
  );
  const respondedInvitations = invitations.filter(
    (inv) => inv.status !== "PENDING",
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Invitations" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="Booking Invitations"
        subtitle="Manage invitations to group bookings from your friends."
      />

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {pendingInvitations.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Responded
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {respondedInvitations.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {invitations.length}
          </p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <div className="space-y-6">
          {/* Pending Invitations */}
          <Card className="shop-surface premium-shadow overflow-hidden p-0">
            <ProfileSectionHeader
              icon={Clock}
              title="Pending Invitations"
              description="Group booking invitations waiting for your response."
              action={
                pendingInvitations.length > 0 ? (
                  <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                    {pendingInvitations.length} awaiting
                  </Badge>
                ) : undefined
              }
            />
            <CardContent className="px-6 py-5 space-y-4">
              {pendingInvitations.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No pending invitations"
                  description="Your friends can invite you to join their bookings. Check back later!"
                />
              ) : (
                pendingInvitations.map((invitation) => (
                  <motion.div
                    key={invitation.id}
                    className="flex rounded-xl border border-slate-200/70 overflow-hidden"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {/* Accent stripe */}
                    <div className="w-1 shrink-0 bg-power-orange" />
                    <div className="flex flex-1 flex-col gap-4 bg-slate-50/40 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                              <Users className="h-4 w-4 text-power-orange" />
                            </div>
                            <h3 className="font-semibold text-slate-900">
                              Group Booking Invitation
                            </h3>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            From{" "}
                            <span className="font-medium text-slate-700">
                              {invitation.inviterId.name}
                            </span>
                          </p>
                        </div>
                        <Badge className="border-orange-200 bg-orange-50 text-power-orange hover:bg-orange-50 capitalize shrink-0">
                          {invitation.sport}
                        </Badge>
                      </div>

                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-medium">{invitation.venueId.name}</span>
                          {invitation.venueId.address && (
                            <span className="text-slate-400">— {invitation.venueId.address}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>
                            {new Date(invitation.date).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>
                            {invitation.startTime} – {invitation.endTime}
                          </span>
                        </div>
                        {invitation.estimatedAmount > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 self-start">
                            <IndianRupee className="h-3.5 w-3.5" />
                            Your share: {invitation.estimatedAmount.toFixed(2)}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-1">
                        <Button
                          variant="primary"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleRespond(invitation.id, true)}
                          icon={<CheckCircle size={16} />}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleRespond(invitation.id, false)}
                          icon={<XCircle size={16} />}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Past Invitations */}
          {respondedInvitations.length > 0 && (
            <Card className="shop-surface premium-shadow overflow-hidden p-0">
              <ProfileSectionHeader
                icon={History}
                title="Past Invitations"
                description="Invitations you have already responded to."
              />
              <CardContent className="px-6 py-5 space-y-3">
                {respondedInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex rounded-xl border border-slate-200/70 overflow-hidden opacity-75 transition-opacity hover:opacity-100"
                  >
                    <div
                      className={`w-1 shrink-0 ${
                        invitation.status === "ACCEPTED"
                          ? "bg-emerald-400"
                          : "bg-slate-300"
                      }`}
                    />
                    <div className="flex flex-1 items-center justify-between gap-3 bg-slate-50/30 p-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {invitation.venueId.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          From {invitation.inviterId.name} •{" "}
                          {new Date(invitation.date).toLocaleDateString("en-US")}{" "}
                          · {invitation.startTime} – {invitation.endTime}
                        </p>
                      </div>
                      <Badge
                        className={
                          invitation.status === "ACCEPTED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 shrink-0"
                            : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100 shrink-0"
                        }
                      >
                        {invitation.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

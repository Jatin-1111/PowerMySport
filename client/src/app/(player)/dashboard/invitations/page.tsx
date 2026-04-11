"use client";

import { useEffect, useState } from "react";
import { bookingApi } from "@/modules/booking/services/booking";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";

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

      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <div className="space-y-8">
          {/* Pending Invitations */}
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
              {pendingInvitations.length > 0 && (
                <Badge variant="destructive">{pendingInvitations.length}</Badge>
              )}
            </h2>

            {pendingInvitations.length === 0 ? (
              <Card className="bg-white">
                <EmptyState
                  icon={Clock}
                  title="No pending invitations"
                  description="Your friends can invite you to join their bookings"
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => (
                  <Card
                    key={invitation.id}
                    className="bg-white border-l-4 border-l-orange-600 hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Group Booking Invitation
                          </CardTitle>
                          <CardDescription>
                            From {invitation.inviterId.name}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {invitation.sport}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">
                            {invitation.venueId.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
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
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span>
                            {invitation.startTime} - {invitation.endTime}
                          </span>
                        </div>
                        {invitation.estimatedAmount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600">Your share:</span>
                            <span className="font-semibold text-lg">
                              ₹{invitation.estimatedAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => handleRespond(invitation.id, true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => handleRespond(invitation.id, false)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Past Invitations */}
          {respondedInvitations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Past Invitations
              </h2>
              <div className="space-y-4">
                {respondedInvitations.map((invitation) => (
                  <Card
                    key={invitation.id}
                    className="bg-white opacity-75 hover:opacity-90 transition-opacity"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {invitation.venueId.name}
                          </CardTitle>
                          <CardDescription>
                            From {invitation.inviterId.name}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            invitation.status === "ACCEPTED"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {invitation.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-slate-600">
                        ",
                        {new Date(invitation.date).toLocaleDateString(
                          "en-US",
                        )}{" "}
                        • {invitation.startTime} - {invitation.endTime}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

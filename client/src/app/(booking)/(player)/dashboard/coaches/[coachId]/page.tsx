"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { venueApi } from "@/modules/venue/services/venue";
import { Coach, User, Venue } from "@/types";
import { getDashboardPathByRole } from "@/utils/roleDashboard";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function BookCoachPage() {
  const params = useParams();
  const router = useRouter();
  const coachId = params.coachId as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    sport: "",
    dependentId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Availability slot state
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [coachId]);

  // Fetch available slots whenever date or sport changes
  useEffect(() => {
    if (bookingData.date && bookingData.sport) {
      fetchAvailableSlots(bookingData.date, bookingData.sport);
    } else {
      setAvailableSlots([]);
      setSelectedSlot("");
      setBookingData((prev) => ({ ...prev, startTime: "", endTime: "" }));
    }
  }, [bookingData.date, bookingData.sport]);

  const fetchAvailableSlots = async (date: string, sport: string) => {
    setLoadingSlots(true);
    setSelectedSlot("");
    setBookingData((prev) => ({ ...prev, startTime: "", endTime: "" }));
    try {
      const response = await bookingApi.getCoachAvailability(coachId, date, sport);
      if (response.success && response.data) {
        setAvailableSlots(response.data.availableSlots || []);
      } else {
        setAvailableSlots([]);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotSelect = (slot: string) => {
    const [startTime = "", endTime = ""] = slot.split("-");
    setSelectedSlot(slot);
    setBookingData((prev) => ({ ...prev, startTime, endTime }));
  };

  const loadData = async () => {
    try {
      const coachResponse = await coachApi.getCoachById(coachId);
      if (coachResponse.success && coachResponse.data) {
        const coachData = coachResponse.data;
        setCoach(coachData);

        // Try to load linked venue
        const coachVenueId = (coachData as { venueId?: string }).venueId;
        if (coachVenueId) {
          loadVenue(coachVenueId);
        } else {
          // OWN_VENUE coaches may have ownVenueDetails but no separate venue doc
          setLoading(false);
        }
      }

      const userResponse = await authApi.getProfile();
      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data);
        if (userResponse.data.role !== "Player") {
          toast.error("Only player accounts can create bookings.");
          router.replace(getDashboardPathByRole(userResponse.data.role));
          return;
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load details");
      setLoading(false);
    }
  };

  const loadVenue = async (venueId: string) => {
    try {
      const response = await venueApi.getVenue(venueId);
      if (response.success && response.data) {
        setVenue(response.data);
      }
    } catch (err) {
      console.error("Failed to load venue for coach", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setBookingData({
      ...bookingData,
      [e.target.name]: e.target.value,
    });
  };

  const calculateDuration = () => {
    if (!bookingData.startTime || !bookingData.endTime) return 0;
    const [startH = "0", startM = "0"] = bookingData.startTime.split(":");
    const [endH = "0", endM = "0"] = bookingData.endTime.split(":");
    const startMins = parseInt(startH) * 60 + parseInt(startM);
    const endMins = parseInt(endH) * 60 + parseInt(endM);
    return Math.max(0, (endMins - startMins) / 60);
  };

  const getSportPrice = (sport: string) => {
    if (!venue) return 0;
    if (sport && venue.sportPricing && venue.sportPricing[sport] !== undefined) {
      return venue.sportPricing[sport];
    }
    return venue.pricePerHour;
  };

  const calculateTotal = () => {
    if (!coach) return 0;
    const duration = calculateDuration();
    let total = duration * coach.hourlyRate;
    if (venue) {
      total += duration * getSportPrice(bookingData.sport);
    }
    return total;
  };

  // Sports to show: prefer venue sports, fall back to coach sports
  const sportsOptions = venue?.sports?.length
    ? venue.sports
    : coach?.sports || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user && user.role !== "Player") {
      toast.error("Only player accounts can create bookings.");
      return;
    }

    if (!bookingData.date || !bookingData.startTime || !bookingData.endTime || !bookingData.sport) {
      toast.error("Please select a date, sport, and time slot");
      return;
    }

    if (!selectedSlot) {
      toast.error("Please select an available time slot");
      return;
    }

    setIsSubmitting(true);

    try {
      const urlParams = new URLSearchParams({
        type: "coach",
        coachId,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        sport: bookingData.sport,
        ...(bookingData.dependentId && {
          dependentId: bookingData.dependentId,
        }),
      });

      router.push(`/dashboard/checkout?${urlParams.toString()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Loading coach details...</p>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Coach not found</p>
      </div>
    );
  }

  const duration = calculateDuration();
  const total = calculateTotal();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Coaches", href: "/coaches" },
          { label: coach.sports?.[0] || "Book Coach" },
        ]}
      />

      <PlayerPageHeader
        badge="Booking"
        title="Book a Coach"
        subtitle="Review the session details and reserve your coaching time."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coach Details */}
        <Card className="shop-surface premium-shadow">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Coach Details
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/50 border border-slate-200/60 p-3 rounded-lg">
              <span className="font-semibold text-slate-700">Service Mode</span>
              <span className="text-sm bg-indigo-100/70 text-indigo-700 px-2 py-1 rounded-full text-xs font-semibold">
                {coach.serviceMode}
              </span>
            </div>

            <div>
              <p className="text-sm text-slate-600">Sports</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {coach.sports.map((sport, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full"
                  >
                    {sport}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-600">Coach Rate</p>
              <p className="text-xl font-bold text-power-orange sm:text-2xl">
                ₹{coach.hourlyRate}
                <span className="text-sm text-slate-600">/hour</span>
              </p>
            </div>

            {venue && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Venue: {venue.name}
                </h3>
                <p className="text-sm text-slate-600">
                  Venue Rate: ₹
                  {getSportPrice(bookingData.sport || venue.sports[0] || "")}
                  /hour
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Note: Total price includes both coach and venue fees.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Booking Form */}
        <Card className="shop-surface premium-shadow">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Select Date & Time
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sport Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Sport *
              </label>
              <select
                name="sport"
                value={bookingData.sport}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-slate-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/40 bg-white/80 text-slate-900 transition-all text-sm"
              >
                <option value="">Select a sport</option>
                {sportsOptions.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Date *
              </label>
              <input
                type="date"
                name="date"
                value={bookingData.date}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                required
                className="w-full px-3 py-2.5 border border-slate-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/40 bg-white/80 text-slate-900 transition-all text-sm"
              />
            </div>

            {/* Available Slots */}
            {bookingData.date && bookingData.sport && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Available Time Slots *
                </label>
                {loadingSlots ? (
                  <p className="text-sm text-slate-500">Loading slots...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-red-500">
                    No available slots for this date and sport.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                          selectedSlot === slot
                            ? "bg-power-orange text-white border-power-orange"
                            : "bg-white/80 text-slate-700 border-slate-200/60 hover:border-power-orange/50"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Participant Selection */}
            {user && user.dependents && user.dependents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Who is attending?
                </label>
                <select
                  name="dependentId"
                  value={bookingData.dependentId}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-slate-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/40 bg-white/80 text-slate-900 transition-all text-sm"
                >
                  <option value="">Me ({user.name})</option>
                  {user.dependents.map((dependent) => (
                    <option key={dependent._id} value={dependent._id || ""}>
                      {dependent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Price summary */}
            {duration > 0 && (
              <div className="bg-white/50 rounded-lg p-4 border border-slate-200/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Duration</span>
                  <span className="font-semibold text-slate-900">
                    {duration} hour{duration !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Rate / hr</span>
                  <span className="font-semibold text-slate-900">
                    ₹{coach.hourlyRate + (venue ? getSportPrice(bookingData.sport) : 0)}
                  </span>
                </div>
                <div className="border-t border-slate-200/60 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-power-orange">
                      ₹{total}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !selectedSlot}
              variant="primary"
              className="w-full"
            >
              {isSubmitting ? "Processing..." : "Confirm Booking"}
            </Button>

            <Button
              type="button"
              onClick={() => router.back()}
              variant="secondary"
              className="w-full"
            >
              Cancel
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
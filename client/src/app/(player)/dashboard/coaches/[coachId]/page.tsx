"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { venueApi } from "@/modules/venue/services/venue";
import { authApi } from "@/modules/auth/services/auth";
import { Coach, Venue, User } from "@/types";
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
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [coachId]);

  const loadData = async () => {
    try {
      const coachResponse = await coachApi.getCoachById(coachId);
      if (coachResponse.success && coachResponse.data) {
        const coachData = coachResponse.data;
        setCoach(coachData);

        // If coach has a venue, fetch it
        if (coachData.venueId) {
          loadVenue(coachData.venueId);
        }
      }

      // Also load user data for dependents
      const userResponse = await authApi.getProfile();
      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load details");
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
    setError("");
  };

  const calculateDuration = () => {
    if (!bookingData.startTime || !bookingData.endTime) return 0;
    const start = parseInt(bookingData.startTime.split(":")[0]);
    const end = parseInt(bookingData.endTime.split(":")[0]);
    return end - start;
  };

  const getSportPrice = (sport: string) => {
    if (!venue) return 0;
    if (
      sport &&
      venue.sportPricing &&
      venue.sportPricing[sport] !== undefined
    ) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !bookingData.date ||
      !bookingData.startTime ||
      !bookingData.endTime ||
      !bookingData.sport
    ) {
      setError("Please fill in all fields");
      return;
    }

    const duration = calculateDuration();
    if (duration <= 0) {
      setError("End time must be after start time");
      return;
    }

    if (!venue) {
      setError("This coach does not have an associated venue for booking.");
      return;
    }

    setIsSubmitting(true);

    try {
      await bookingApi.initiateBooking({
        venueId: venue.id,
        coachId: coachId,
        sport: bookingData.sport,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        dependentId: bookingData.dependentId || undefined,
      });

      router.push("/dashboard/my-bookings?success=true");
    } catch (error: any) {
      console.error("Booking failed:", error);
      setError(
        error.response?.data?.message ||
          "Failed to create booking. Please try again.",
      );
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
      <PlayerPageHeader
        badge="Booking"
        title="Book a Coach"
        subtitle="Review the session details and reserve your coaching time."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coach Details */}
        <Card className="bg-white">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Coach Details
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
              <span className="font-semibold text-slate-700">Service Mode</span>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
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
              <p className="text-2xl font-bold text-power-orange">
                ?{coach.hourlyRate}
                <span className="text-sm text-slate-600">/hour</span>
              </p>
            </div>

            {venue && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Venue: {venue.name}
                </h3>
                <p className="text-sm text-slate-600">
                  Venue Rate: ?
                  {getSportPrice(bookingData.sport || venue.sports[0] || "")}
                  /hour
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Note: Total price includes both coach and venue fees.
                </p>
              </div>
            )}

            {!venue && (
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                Warning: This coach does not have a linked venue. Booking may
                not be possible.
              </div>
            )}
          </div>
        </Card>

        {/* Booking Form */}
        <Card className="bg-white">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Select Date & Time
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sport Selection */}
            {venue && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Sport *
                </label>
                <select
                  name="sport"
                  value={bookingData.sport}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
                >
                  <option value="">Select a sport</option>
                  {venue.sports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
              />
            </div>

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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
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

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Start Time *
              </label>
              <input
                type="time"
                name="startTime"
                value={bookingData.startTime}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                End Time *
              </label>
              <input
                type="time"
                name="endTime"
                value={bookingData.endTime}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900 transition-all"
              />
            </div>

            {duration > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Duration</span>
                  <span className="font-semibold text-slate-900">
                    {duration} hours
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Rate / hr</span>
                  <span className="font-semibold text-slate-900">
                    ?{coach.hourlyRate + (venue ? venue.pricePerHour : 0)}
                  </span>
                </div>
                <div className="border-t border-slate-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-power-orange">
                      ?{total}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || duration <= 0 || !venue}
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

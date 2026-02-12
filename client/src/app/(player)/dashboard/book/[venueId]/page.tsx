"use client";

import { authApi } from "@/modules/auth/services/auth";
import { bookingApi } from "@/modules/booking/services/booking";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { venueApi } from "@/modules/venue/services/venue";
import { User, Venue } from "@/types";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function BookVenuePage() {
  const params = useParams();
  const router = useRouter();
  const venueId = params.venueId as string;

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
  }, [venueId]);

  const loadData = async () => {
    try {
      const [venueResponse, userResponse] = await Promise.all([
        venueApi.getVenue(venueId),
        authApi.getProfile(),
      ]);

      if (venueResponse.success && venueResponse.data) {
        setVenue(venueResponse.data);
      }
      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load booking details");
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
    if (!venue) return 0;
    const duration = calculateDuration();
    return duration * getSportPrice(bookingData.sport);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
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

    setIsSubmitting(true);

    try {
      // Convert date to ISO datetime format
      const bookingDate = new Date(bookingData.date).toISOString();

      const response = await bookingApi.initiateBooking({
        venueId,
        sport: bookingData.sport,
        date: bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        dependentId: bookingData.dependentId || undefined,
      });

      // Redirect to bookings page with success message
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
        <p className="text-slate-600">Loading venue details...</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Venue not found</p>
      </div>
    );
  }

  const duration = calculateDuration();
  const total = calculateTotal();

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Booking"
        title="Book a Venue"
        subtitle="Confirm your session details and reserve the venue in minutes."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Venue Details */}
        <Card className="bg-white">
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            {venue.name}
          </h2>

          {venue.images && venue.images.length > 0 && (
            <img
              src={venue.images[0]}
              alt={venue.name}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          )}

          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Sports</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {venue.sports.map((sport, index) => (
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
              <p className="text-sm text-slate-600">Price</p>
              <p className="text-2xl font-bold text-power-orange">
                ?{getSportPrice(bookingData.sport || venue.sports[0] || "")}
                <span className="text-sm text-slate-600">/hour</span>
              </p>
            </div>

            {venue.amenities && venue.amenities.length > 0 && (
              <div>
                <p className="text-sm text-slate-600 mb-1">Amenities</p>
                <div className="flex flex-wrap gap-1">
                  {venue.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
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

            {/* Start Time */}
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

            {/* End Time */}
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

            {/* Price Summary */}
            {duration > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Duration</span>
                  <span className="font-semibold text-slate-900">
                    {duration} hours
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Price per hour</span>
                  <span className="font-semibold text-slate-900">
                    ?{venue.pricePerHour}
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

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || duration <= 0}
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

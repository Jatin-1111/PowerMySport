"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Availability, Venue } from "@/types";
import {
  Calendar,
  Check,
  Clock,
  IndianRupee,
  MapPin,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function VenueDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const venueId = params.venueId as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (venueId) {
      loadVenueDetails();
    }
  }, [venueId]);

  useEffect(() => {
    if (venueId && selectedDate) {
      loadAvailability();
    }
  }, [venueId, selectedDate]);

  const loadVenueDetails = async () => {
    try {
      const response = await discoveryApi.getVenueById(venueId);
      if (response.success && response.data) {
        setVenue(response.data);
        if (response.data.sports && response.data.sports.length > 0) {
          setSelectedSport(response.data.sports[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load venue details:", error);
      setError("Failed to load venue details");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    try {
      const response = await bookingApi.getVenueAvailability(
        venueId,
        selectedDate,
      );
      if (response.success && response.data) {
        setAvailability(response.data);
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
    }
  };

  const handleBooking = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      router.push("/login?redirect=/venues/" + venueId);
      return;
    }

    if (!selectedSlot || !selectedSport) {
      setError("Please select a sport and time slot");
      return;
    }

    setBookingLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        sport: selectedSport,
      });

      router.push(`/dashboard/book/${venueId}/checkout?${params.toString()}`);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange"></div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Venue not found</h1>
          <p className="text-slate-600">
            The venue you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/venues">
            <Button variant="primary">Browse All Venues</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <Navigation variant="dark" sticky />
      <main className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                      {venue.name}
                    </h1>
                    {venue.address && (
                      <p className="text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                        <MapPin size={18} />
                        {venue.address}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-1">
                        <Star
                          size={18}
                          className="text-yellow-400 fill-yellow-400"
                        />
                        <span className="font-semibold">
                          {venue.rating?.toFixed(1) || "5.0"}
                        </span>
                        <span className="text-slate-300 text-sm">
                          ({venue.reviewCount || 0} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-300 mb-1">
                      Starting from
                    </p>
                    <div className="flex items-center justify-end gap-1 text-3xl font-bold text-power-orange">
                      <IndianRupee size={24} />
                      {venue.pricePerHour}
                      <span className="text-sm text-slate-300">/hr</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Images */}
              {venue.images && venue.images.length > 0 && (
                <Card className="overflow-hidden bg-white">
                  <div className="h-80 sm:h-96 w-full overflow-hidden bg-slate-100">
                    <img
                      src={venue.images[0]}
                      alt={venue.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </Card>
              )}

              {/* Description */}
              <Card className="p-6 bg-white">
                <h2 className="text-xl font-bold mb-4 text-slate-900">
                  About this Venue
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  {venue.description ||
                    "Experience world-class sports facilities at this premium venue. Perfect for athletes of all levels looking for quality training and play spaces."}
                </p>
              </Card>

              {/* Sports Available */}
              <Card className="p-6 bg-white">
                <h2 className="text-lg font-semibold mb-4 text-slate-900">
                  Sports Available
                </h2>
                <div className="flex flex-wrap gap-2">
                  {venue.sports?.map((sport, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-linear-to-br from-power-orange/10 to-power-orange/5 border border-power-orange/20 text-power-orange rounded-lg text-sm font-semibold"
                    >
                      {sport}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Amenities */}
              {venue.amenities && venue.amenities.length > 0 && (
                <Card className="p-6 bg-white">
                  <h2 className="text-lg font-semibold mb-4 text-slate-900">
                    Amenities & Facilities
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {venue.amenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 rounded-lg text-sm"
                      >
                        <Check size={16} className="text-turf-green shrink-0" />
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column - Booking Widget */}
            <div className="lg:col-span-1">
              <Card className="p-6 bg-white sticky top-6 border-2 border-slate-100 shadow-xl">
                <h2 className="text-xl font-bold mb-6 text-slate-900">
                  Book Your Slot
                </h2>

                <div className="space-y-5">
                  {/* Sport Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Select Sport
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {venue.sports?.map((sport) => (
                        <button
                          key={sport}
                          onClick={() => setSelectedSport(sport)}
                          className={`px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all ${
                            selectedSport === sport
                              ? "bg-power-orange text-white border-power-orange shadow-md"
                              : "bg-white text-slate-700 border-slate-200 hover:border-power-orange hover:bg-power-orange/5"
                          }`}
                        >
                          {sport}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Select Date
                    </label>
                    <div className="relative">
                      <Calendar
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        size={18}
                      />
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                      <Clock size={16} />
                      Available Time Slots
                    </label>
                    {availability ? (
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {availability.availableSlots?.length > 0 ? (
                          availability.availableSlots.map((slot: any) => {
                            const startTime = slot.split("-")[0] || slot;
                            const startHour = parseInt(
                              startTime.split(":")[0] || "0",
                              10,
                            );
                            const endTime =
                              slot.split("-")[1] ||
                              `${String(startHour + 1).padStart(2, "0")}:00`;

                            const isSelected =
                              selectedSlot?.startTime === startTime;

                            return (
                              <button
                                key={slot}
                                onClick={() =>
                                  setSelectedSlot({ startTime, endTime })
                                }
                                className={`px-3 py-2.5 text-sm font-semibold rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? "bg-turf-green text-white border-turf-green shadow-md"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-turf-green hover:bg-turf-green/5"
                                }`}
                              >
                                {startTime}
                              </button>
                            );
                          })
                        ) : (
                          <div className="col-span-2 text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                            <p className="text-sm text-slate-500">
                              No slots available
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-power-orange"></div>
                      </div>
                    )}
                  </div>

                  {/* Summary & CTA */}
                  <div className="pt-5 border-t-2 border-slate-100">
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border-2 border-red-100 font-medium">
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border-2 border-green-100 font-medium">
                        {success}
                      </div>
                    )}

                    {selectedSport && selectedSlot && (
                      <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Sport:</span>
                          <span className="font-semibold text-slate-900">
                            {selectedSport}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Time:</span>
                          <span className="font-semibold text-slate-900">
                            {selectedSlot.startTime} - {selectedSlot.endTime}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="text-slate-600 font-medium">
                            Total:
                          </span>
                          <span className="text-xl font-bold text-slate-900 flex items-center">
                            <IndianRupee size={18} />
                            {venue.sportPricing?.[selectedSport] ||
                              venue.pricePerHour}
                          </span>
                        </div>
                      </div>
                    )}

                    {user ? (
                      <Button
                        variant="primary"
                        className="w-full h-12 text-base font-semibold shadow-lg"
                        onClick={handleBooking}
                        disabled={
                          bookingLoading || !selectedSlot || !selectedSport
                        }
                      >
                        {bookingLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check size={20} className="mr-2" />
                            Confirm Booking
                          </>
                        )}
                      </Button>
                    ) : (
                      <Link href={`/login?redirect=/venues/${venueId}`}>
                        <Button
                          variant="secondary"
                          className="w-full h-12 text-base font-semibold"
                        >
                          Sign In to Book
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      {/* Footer */}
      <Footer />
    </div>
  );
}

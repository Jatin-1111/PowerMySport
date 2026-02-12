"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Venue, Availability } from "@/types";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import PublicPageHeader from "@/modules/shared/components/PublicPageHeader";
import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  Check,
  User,
  Info,
} from "lucide-react";
import Link from "next/link";
import { bookingApi } from "@/modules/booking/services/booking";

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
      const response = await bookingApi.initiateBooking({
        venueId,
        sport: selectedSport,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      if (response) {
        setSuccess("Booking initiated successfully!");
        // Navigate to payment or confirmation
        setTimeout(() => {
          router.push("/dashboard/my-bookings");
        }, 1500);
      }
    } catch (error: any) {
      console.error("Booking failed:", error);
      setError(error.response?.data?.message || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange"></div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Venue not found</h1>
        <Link href="/venues">
          <Button variant="outline">Back to Venues</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <PublicPageHeader
        title={venue.name}
        subtitle={venue.address || "Sports Venue"}
        icon={Building2}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Images */}
            {venue.images && venue.images.length > 0 && (
              <div className="rounded-xl overflow-hidden shadow-lg h-96 relative bg-slate-100">
                <img
                  src={venue.images[0]}
                  alt={venue.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Description */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Info size={20} className="text-power-orange" />
                About this Venue
              </h2>
              <p className="text-slate-600 leading-relaxed">
                {venue.description || "No description available."}
              </p>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {venue.amenities?.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Sports Available</h3>
                <div className="flex flex-wrap gap-2">
                  {venue.sports?.map((sport, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 border border-slate-200 text-slate-700 rounded-full text-sm font-medium"
                    >
                      {sport}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 border-power-orange/20 shadow-lg">
              <h2 className="text-xl font-bold mb-6">Book a Slot</h2>

              <div className="space-y-6">
                {/* Sport Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Sport
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {venue.sports?.map((sport) => (
                      <button
                        key={sport}
                        onClick={() => setSelectedSport(sport)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                          selectedSport === sport
                            ? "bg-power-orange text-white border-power-orange"
                            : "bg-white text-slate-700 border-slate-200 hover:border-power-orange"
                        }`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Date
                  </label>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                    />
                  </div>
                </div>

                {/* Slots */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Available Slots
                  </label>
                  {availability ? (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {availability.availableSlots?.length > 0 ? (
                        availability.availableSlots.map((slot: any) => {
                          // Handle different slot formats if necessary, assuming string "HH:mm" like "09:00"
                          // But type says availableSlots string[].
                          // We need start/end. Assuming backend sends "HH:mm-HH:mm" or just start time?
                          // Checking type: availableSlots: string[].
                          // Let's assume it's "HH:mm" start time and 1 hour duration or similar constraint.
                          // Actually, let's parse it if it is a range or just start.
                          // For now, assume simple string
                          const startTime = slot.split("-")[0] || slot;
                          const endTime =
                            slot.split("-")[1] ||
                            `${parseInt(startTime.split(":")[0]) + 1}:00`;

                          const isSelected =
                            selectedSlot?.startTime === startTime;

                          return (
                            <button
                              key={slot}
                              onClick={() =>
                                setSelectedSlot({ startTime, endTime })
                              }
                              className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                                isSelected
                                  ? "bg-green-600 text-white border-green-600"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-green-500"
                              }`}
                            >
                              {startTime} - {endTime}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 col-span-2 text-center py-4">
                          No slots available for this date.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-power-orange"></div>
                    </div>
                  )}
                </div>

                {/* Price Display */}
                <div className="pt-4 border-t border-slate-200">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
                      {success}
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600">Price per hour</span>
                    <span className="text-xl font-bold text-slate-900 flex items-center">
                      <IndianRupee size={18} />
                      {venue.sportPricing?.[selectedSport] ||
                        venue.pricePerHour}
                    </span>
                  </div>

                  {user ? (
                    <Button
                      variant="primary"
                      className="w-full h-12 text-lg"
                      onClick={handleBooking}
                      disabled={bookingLoading || !selectedSlot}
                    >
                      {bookingLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Check size={20} className="mr-2" />
                      )}
                      Confirm Booking
                    </Button>
                  ) : (
                    <Link href={`/login?redirect=/venues/${venueId}`}>
                      <Button variant="secondary" className="w-full h-12">
                        <User size={20} className="mr-2" />
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
    </>
  );
}

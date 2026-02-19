"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Availability, Coach } from "@/types";
import {
  ArrowLeft,
  Award,
  Calendar,
  Check,
  IndianRupee,
  Info,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CoachDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const coachId = params.coachId as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getVerificationBadge = (coachData: Coach) => {
    const status =
      coachData.verificationStatus ||
      (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");

    switch (status) {
      case "VERIFIED":
        return {
          label: "Verified",
          className: "bg-green-100 text-green-700 border border-green-200",
        };
      case "PENDING":
        return {
          label: "Pending",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
        };
      case "REVIEW":
        return {
          label: "In Review",
          className: "bg-blue-100 text-blue-700 border border-blue-200",
        };
      case "REJECTED":
        return {
          label: "Unverified",
          className: "bg-red-100 text-red-700 border border-red-200",
        };
      default:
        return {
          label: "Unverified",
          className: "bg-slate-100 text-slate-700 border border-slate-200",
        };
    }
  };

  useEffect(() => {
    if (coachId) {
      loadCoachDetails();
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId && selectedDate) {
      loadAvailability();
    }
  }, [coachId, selectedDate]);

  const loadCoachDetails = async () => {
    try {
      const response = await discoveryApi.getCoachById(coachId);
      if (response.success && response.data) {
        setCoach(response.data);
        if (response.data.sports && response.data.sports.length > 0) {
          setSelectedSport(response.data.sports[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load coach details:", error);
      setError("Failed to load coach details");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    setAvailabilityLoading(true);
    try {
      const response = await bookingApi.getCoachAvailability(
        coachId,
        selectedDate,
      );
      if (response.success && response.data) {
        setAvailability(response.data);
      } else {
        setAvailability({ availableSlots: [] } as Availability);
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
      setAvailability({ availableSlots: [] } as Availability);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleBooking = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      router.push("/login?redirect=/coaches/" + coachId);
      return;
    }

    if (!selectedSlot || !selectedSport) {
      setError("Please select a sport and time slot");
      return;
    }

    setBookingLoading(true);
    try {
      // Convert date to ISO datetime format
      const bookingDate = new Date(selectedDate).toISOString();

      const response = await bookingApi.initiateBooking({
        venueId: coach?.venueId || "freelance", // Handle freelance or venue-based
        coachId: coachId,
        sport: selectedSport,
        date: bookingDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      if (response) {
        setSuccess("Booking initiated successfully!");
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

  if (!coach) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-bold mb-4">Coach not found</h1>
        <Link href="/coaches">
          <Button variant="outline">Back to Coaches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
            <div className="relative z-10">
              {/* Back button */}
              <Link
                href="/coaches"
                className="inline-flex items-center gap-2 text-slate-200 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="text-sm font-medium">Back to All Coaches</span>
              </Link>

              <div className="flex items-center gap-3 mb-2">
                <Award size={32} className="text-turf-green" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  {coach.sports.join(", ")}
                </span>
                {(() => {
                  const badge = getVerificationBadge(coach);
                  return (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                {coach.sports[0]} Coach
              </h1>

              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Star size={20} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-lg">
                    {coach.rating.toFixed(1)}
                  </span>
                  <span className="text-slate-300 text-sm">
                    ({coach.reviewCount} reviews)
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-600"></div>
                <div className="flex items-center gap-1">
                  <IndianRupee size={20} className="text-turf-green" />
                  <span className="font-bold text-xl text-turf-green">
                    {coach.hourlyRate}
                  </span>
                  <span className="text-slate-300 text-sm">/hour</span>
                </div>
                <div className="h-4 w-px bg-slate-600"></div>
                <span className="px-2.5 py-1 bg-turf-green/20 border border-turf-green/30 rounded-lg text-turf-green font-semibold text-xs">
                  {coach.serviceMode}
                </span>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-turf-green/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About the Coach */}
            <Card className="bg-white border-2 border-slate-100 overflow-hidden">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Info size={24} className="text-turf-green" />
                  About the Coach
                </h2>
              </div>
              <div className="p-6">
                <p className="text-slate-700 leading-relaxed text-base">
                  {coach.bio ||
                    "Expert coach offering professional training sessions to help you improve your skills."}
                </p>
              </div>
            </Card>

            {/* Certifications */}
            <Card className="bg-white border-2 border-slate-100 overflow-hidden">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Award size={24} className="text-turf-green" />
                  Certifications
                </h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {coach.certifications?.length > 0 ? (
                    coach.certifications.map((cert, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-turf-green/10 border border-turf-green/30 text-turf-green rounded-lg text-sm font-medium"
                      >
                        {cert}
                      </span>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">
                      No certifications listed.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-2 border-turf-green/20 shadow-lg overflow-hidden sticky top-24">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">
                  Book a Session
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-5">
                  {/* Sport Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Select Sport
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {coach.sports?.map((sport) => (
                        <button
                          key={sport}
                          onClick={() => setSelectedSport(sport)}
                          className={`px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                            selectedSport === sport
                              ? "bg-turf-green text-white border-turf-green shadow-md"
                              : "bg-white text-slate-700 border-slate-200 hover:border-turf-green"
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
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      />
                    </div>
                  </div>

                  {/* Slots */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Available Slots
                    </label>
                    {availabilityLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-turf-green"></div>
                      </div>
                    ) : availability &&
                      availability.availableSlots?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {availability.availableSlots.map((slot: any) => {
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
                              className={`px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "bg-turf-green text-white border-turf-green shadow-md"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-turf-green"
                              }`}
                            >
                              {startTime} - {endTime}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No slots available for this date.
                      </p>
                    )}
                  </div>

                  {/* Price Display */}
                  <div className="pt-5 border-t-2 border-slate-100">
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

                    <div className="bg-turf-green/5 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">
                          Hourly Rate
                        </span>
                        <span className="text-2xl font-bold text-turf-green flex items-center">
                          <IndianRupee size={20} />
                          {coach.hourlyRate}
                        </span>
                      </div>
                    </div>

                    {user ? (
                      <Button
                        variant="primary"
                        className="w-full h-12 text-base font-semibold bg-turf-green hover:bg-green-700 shadow-md"
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
                      <Link href={`/login?redirect=/coaches/${coachId}`}>
                        <Button
                          variant="secondary"
                          className="w-full h-12 font-semibold"
                        >
                          <User size={20} className="mr-2" />
                          Sign In to Book
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import PublicPageHeader from "@/modules/shared/components/PublicPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Availability, Coach } from "@/types";
import {
  Award,
  Calendar,
  Check,
  IndianRupee,
  Info,
  Star,
  User,
  Users,
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
    try {
      const response = await bookingApi.getCoachAvailability(
        coachId,
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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Coach not found</h1>
        <Link href="/coaches">
          <Button variant="outline">Back to Coaches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation variant="dark" sticky />
      <main className="flex-1">
        <PublicPageHeader
          title={`${coach.sports[0]} Coach`}
          subtitle={`Train with a professional ${coach.sports.join(", ")} coach`}
          icon={Users}
        />

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center">
                    <User size={40} className="text-slate-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Coach Profile
                    </h2>
                    {coach &&
                      (() => {
                        const badge = getVerificationBadge(coach);
                        return (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full mt-2 ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                    <div className="flex items-center gap-2 mt-1">
                      <Star
                        className="text-yellow-500 fill-yellow-500"
                        size={20}
                      />
                      <span className="font-bold text-lg">
                        {coach.rating.toFixed(1)}
                      </span>
                      <span className="text-slate-500">
                        ({coach.reviewCount} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Info size={20} className="text-power-orange" />
                  About
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  {coach.bio || "No bio available."}
                </p>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Award size={20} className="text-power-orange" />
                    Certifications
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.certifications?.length > 0 ? (
                      coach.certifications.map((cert, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
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
              <Card className="p-6 sticky top-24 border-power-orange/20 shadow-lg">
                <h2 className="text-xl font-bold mb-6">Book a Session</h2>

                <div className="space-y-6">
                  {/* Sport Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Sport
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {coach.sports?.map((sport) => (
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
                      <span className="text-slate-600">Hourly Rate</span>
                      <span className="text-xl font-bold text-slate-900 flex items-center">
                        <IndianRupee size={18} />
                        {coach.hourlyRate}
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
                      <Link href={`/login?redirect=/coaches/${coachId}`}>
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
      </main>
      {/* Footer */}
      <Footer />
    </div>
  );
}

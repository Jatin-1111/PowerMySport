import { CheckoutEntityCard } from "@/modules/booking/components/checkout/CheckoutEntityCard";
import {
  SectionCard,
  SectionHeader,
} from "@/modules/booking/components/checkout/CheckoutPrimitives";
import { AcademyCard, BookingType } from "@/modules/booking/utils/checkoutHelpers";
import { Coach, User, Venue } from "@/types";
import { Calendar, Clock, Users, Zap } from "lucide-react";

interface CheckoutReviewStepProps {
  entityLabel: string;
  coach: Coach | null;
  venue: Venue | null;
  academy: AcademyCard | null;
  type: BookingType;

  availableSports: string[];
  sport: string;
  setSport: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  durationHours: number;

  user: User | null;
  selectedDependentId: string;
  setSelectedDependentId: (value: string) => void;
}

export function CheckoutReviewStep({
  entityLabel,
  coach,
  venue,
  academy,
  type,
  availableSports,
  sport,
  setSport,
  date,
  setDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  durationHours,
  user,
  selectedDependentId,
  setSelectedDependentId,
}: CheckoutReviewStepProps) {
  return (
    <>
      <SectionCard>
        <SectionHeader
          step={1}
          title={`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} overview`}
          description="Confirm who you're booking with."
        />
        <div className="p-5 sm:p-6">
          <CheckoutEntityCard coach={coach} venue={venue} academy={academy} type={type} />
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          step={2}
          title="Booking details"
          description="Choose your sport, date, and time."
        />
        <div className="space-y-4 p-5 sm:p-6">
          {/* Sport */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Zap size={12} />
              Sport
            </label>
            {availableSports.length > 0 ? (
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
              >
                <option value="">Select sport</option>
                {availableSports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="e.g. Cricket, Football"
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2"
              />
            )}
          </div>
          {/* Date */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Calendar size={12} />
              Date
            </label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
            />
          </div>
          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Clock size={12} />
                Start time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Clock size={12} />
                End time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
              />
            </div>
          </div>
          {durationHours > 0 && (
            <p className="text-xs text-slate-500">
              Duration:{" "}
              <span className="font-semibold text-slate-700">
                {durationHours} hr{durationHours !== 1 ? "s" : ""}
              </span>
            </p>
          )}
          {/* Attendee */}
          {user?.dependents && user.dependents.length > 0 && (
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Users size={12} />
                Who is attending?
              </label>
              <select
                value={selectedDependentId}
                onChange={(e) => setSelectedDependentId(e.target.value)}
                className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2"
              >
                <option value="">Me ({user.name})</option>
                {user.dependents.map((d) => (
                  <option key={d._id} value={d._id || ""}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
            <Clock size={13} className="shrink-0 text-amber-500" />
            <p className="text-xs font-medium text-amber-700">
              Arrive 10 minutes before your slot starts.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

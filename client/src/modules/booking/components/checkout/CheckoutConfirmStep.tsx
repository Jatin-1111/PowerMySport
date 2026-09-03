import {
  BookingSummaryRow,
  SectionCard,
  SectionHeader,
} from "@/modules/booking/components/checkout/CheckoutPrimitives";
import { PaymentMethodOption } from "@/modules/booking/components/checkout/PaymentMethodSelector";
import {
  AcademyCard,
  BookingType,
  getCoachImageCandidates,
  normalizeImageUrl,
} from "@/modules/booking/utils/checkoutHelpers";
import { Coach, Venue } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { Calendar, Clock, MapPin, User as UserIcon, Users, Wallet } from "lucide-react";

interface CheckoutConfirmStepProps {
  type: BookingType;
  coach: Coach | null;
  venue: Venue | null;
  academy: AcademyCard | null;
  entityName: string;

  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  participantName: string;

  paymentMethod: string;
  dynamicPaymentOptions: PaymentMethodOption[];
}

export function CheckoutConfirmStep({
  type,
  coach,
  venue,
  academy,
  entityName,
  sport,
  date,
  startTime,
  endTime,
  durationHours,
  participantName,
  paymentMethod,
  dynamicPaymentOptions,
}: CheckoutConfirmStepProps) {
  return (
    <SectionCard>
      <SectionHeader step={1} title="Confirm booking" description="Final review before payment." />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-200">
            {type === "coach" && coach && getCoachImageCandidates(coach)[0] ? (
              <img
                src={getCoachImageCandidates(coach)[0]}
                alt={entityName}
                className="h-full w-full object-cover"
              />
            ) : type === "venue" && venue?.images?.[0] ? (
              <img src={venue.images[0]} alt={venue.name} className="h-full w-full object-cover" />
            ) : type === "academy" && academy ? (
              normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl) ? (
                <img
                  src={
                    normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl)
                  }
                  alt={academy.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Users size={18} className="text-slate-400" />
                </div>
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <MapPin size={18} className="text-slate-400" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{entityName}</p>
            <p className="text-xs text-slate-500">
              {sport && `${sport} · `}
              {date ? formatDate(date) : ""}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4">
          <BookingSummaryRow
            icon={<Calendar size={15} />}
            label="Date"
            value={date ? formatDate(date) : "Not selected"}
          />
          <BookingSummaryRow
            icon={<Clock size={15} />}
            label="Time"
            value={
              startTime && endTime
                ? `${formatTime(startTime)} – ${formatTime(endTime)}`
                : "Not selected"
            }
            hint={durationHours ? `${durationHours} hour(s)` : undefined}
          />
          <BookingSummaryRow
            icon={<UserIcon size={15} />}
            label="Participant"
            value={participantName}
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Wallet size={16} className="shrink-0 text-slate-500" />
          <div>
            <p className="text-xs text-slate-400">Paying with</p>
            <p className="text-sm font-semibold text-slate-800">
              {dynamicPaymentOptions.find((o) => o.id === paymentMethod)?.label}
            </p>
          </div>
          <span className="bg-turf-green/10 text-turf-green ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Encrypted
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

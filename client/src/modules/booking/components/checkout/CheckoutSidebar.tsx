import {
  SectionCard,
  SectionHeader,
} from "@/modules/booking/components/checkout/CheckoutPrimitives";
import { fadeUp } from "@/modules/booking/utils/checkoutHelpers";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ShieldCheck, TicketPercent } from "lucide-react";

interface CheckoutSidebarProps {
  isZeroCommission: boolean;
  promoCode: string;
  setPromoCode: (value: string) => void;
  onApplyPromo: (e: React.FormEvent<HTMLFormElement>) => void;
  isApplyingPromo: boolean;
  promoMessage: string | null;
  promoSuccess: boolean;

  type: "coach" | "venue" | "academy";
  pricePerHour: number;
  subtotal: number;
  durationHours: number;
  serviceFee: number;
  taxes: number;
  discount: number;
  total: number;

  entityLabel: string;
  sport: string;
  communityUrl: string;
  showCommunityInsights: boolean;

  ctaButtons: React.ReactNode;
}

export function CheckoutSidebar({
  isZeroCommission,
  promoCode,
  setPromoCode,
  onApplyPromo,
  isApplyingPromo,
  promoMessage,
  promoSuccess,
  type,
  pricePerHour,
  subtotal,
  durationHours,
  serviceFee,
  taxes,
  discount,
  total,
  entityLabel,
  sport,
  communityUrl,
  showCommunityInsights,
  ctaButtons,
}: CheckoutSidebarProps) {
  const shouldReduceMotion = useReducedMotion();

  const summaryItems = [
    {
      label: type === "coach" ? "Coach rate" : type === "academy" ? "Academy rate" : "Venue rate",
      value: `${formatCurrency(pricePerHour)}/hr`,
      sub: null as string | null,
    },
    {
      label: "Subtotal",
      value: formatCurrency(subtotal),
      sub: durationHours ? `${durationHours} hr` : null,
    },
    {
      label: isZeroCommission ? "Platform fee" : "Service fee",
      value: formatCurrency(serviceFee),
      sub: isZeroCommission ? "Free" : null,
    },
    {
      label: "Taxes",
      value: formatCurrency(taxes),
      sub: "Estimated",
    },
  ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.15 }}
        className="space-y-4"
      >
        {isZeroCommission && (
          <div className="border-turf-green/20 from-turf-green/5 relative overflow-hidden rounded-2xl border bg-gradient-to-br via-white to-emerald-50/40 p-4">
            <div className="bg-turf-green/10 absolute -right-6 -top-6 h-16 w-16 rounded-full blur-xl" />
            <div className="relative flex items-start gap-3">
              <div className="bg-turf-green/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <span className="text-turf-green text-xs font-extrabold">0%</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Limited offer
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  Zero platform commission
                </p>
                <p className="mt-0.5 text-xs text-slate-500">You pay only the rate plus taxes.</p>
              </div>
            </div>
          </div>
        )}

        {/* Promo code */}
        <SectionCard>
          <div className="flex items-center gap-2 border-b border-slate-100 p-4 sm:p-5">
            <TicketPercent size={16} className="text-slate-500" />
            <h2 className="font-title text-base font-semibold text-slate-900">Offers & Promos</h2>
          </div>
          <div className="p-4 sm:p-5">
            <form onSubmit={onApplyPromo} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TicketPercent
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter promo code"
                    className="focus:border-power-orange focus:ring-power-orange/20 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm uppercase text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isApplyingPromo}
                  className="w-auto px-4"
                >
                  {isApplyingPromo ? "..." : "Apply"}
                </Button>
              </div>
            </form>
            <AnimatePresence>
              {promoMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                    promoSuccess
                      ? "bg-turf-green/10 text-turf-green"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {promoSuccess && <CheckCircle2 size={13} className="shrink-0" />}
                  {promoMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SectionCard>

        {/* Order summary */}
        <SectionCard>
          <SectionHeader title="Order summary" />
          <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            <div className="space-y-2.5">
              {summaryItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="text-slate-600">{item.label}</p>
                    {item.sub && <p className="text-xs text-slate-400">{item.sub}</p>}
                  </div>
                  <p className="shrink-0 font-medium text-slate-800">{item.value}</p>
                </div>
              ))}
              {discount > 0 && (
                <div className="bg-turf-green/8 flex items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-sm">
                  <div>
                    <p className="text-turf-green font-semibold">Promo discount</p>
                    <p className="text-turf-green/70 text-xs">{promoCode.toUpperCase()}</p>
                  </div>
                  <p className="text-turf-green shrink-0 font-semibold">
                    -{formatCurrency(discount)}
                  </p>
                </div>
              )}
            </div>

            <div className="from-power-orange/8 mt-4 rounded-xl bg-gradient-to-r to-amber-50/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Total due</span>
                <motion.span
                  key={total}
                  initial={shouldReduceMotion ? false : { scale: 1.08, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-power-orange text-2xl font-bold"
                >
                  {formatCurrency(total)}
                </motion.span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {type === "venue"
                  ? "Slot reserved for 10 min after confirmation."
                  : "Confirmed after payment."}
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="mt-6 hidden lg:block">{ctaButtons}</div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Protected checkout</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Payments are 256-bit encrypted. Reschedule any time from your dashboard.
            </p>
          </div>
        </div>

        <CommunityInsightsCard
          title="Second opinion before paying?"
          description={`See what players are saying about this ${entityLabel} before you confirm.`}
          q={`${sport} ${entityLabel}`}
          sport={sport}
          ctaUrl={communityUrl}
          enabled={showCommunityInsights}
        />
      </motion.div>
    </aside>
  );
}

import { GroupBookingInviteSection } from "@/modules/booking/components/GroupBookingInviteSection";
import { PaymentType } from "@/modules/booking/components/PaymentTypeSelector";
import {
  PaymentMethodOption,
  PaymentMethodSelector,
} from "@/modules/booking/components/checkout/PaymentMethodSelector";
import {
  SectionCard,
  SectionHeader,
} from "@/modules/booking/components/checkout/CheckoutPrimitives";
import { BookingType } from "@/modules/booking/utils/checkoutHelpers";
import { CreditCard, Users } from "lucide-react";

interface CheckoutPaymentStepProps {
  type: BookingType;
  isGroupBooking: boolean;
  setIsGroupBooking: (value: boolean) => void;
  selectedFriendIds: string[];
  setSelectedFriendIds: (ids: string[]) => void;
  paymentType: PaymentType;
  setPaymentType: (value: PaymentType) => void;
  total: number;

  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  dynamicPaymentOptions: PaymentMethodOption[];
}

export function CheckoutPaymentStep({
  type,
  isGroupBooking,
  setIsGroupBooking,
  selectedFriendIds,
  setSelectedFriendIds,
  paymentType,
  setPaymentType,
  total,
  paymentMethod,
  setPaymentMethod,
  dynamicPaymentOptions,
}: CheckoutPaymentStepProps) {
  return (
    <>
      {type !== "academy" && (
        <SectionCard>
          <SectionHeader
            step={1}
            icon={<Users size={15} />}
            title="Group booking"
            description="Invite friends and split the cost."
          />
          <div className="p-5 sm:p-6">
            <GroupBookingInviteSection
              isGroupBooking={isGroupBooking}
              onGroupBookingChange={setIsGroupBooking}
              selectedFriendIds={selectedFriendIds}
              onFriendSelectionChange={setSelectedFriendIds}
              paymentType={paymentType}
              onPaymentTypeChange={setPaymentType}
              totalAmount={total}
            />
          </div>
        </SectionCard>
      )}
      <SectionCard>
        <SectionHeader
          step={type !== "academy" ? 2 : 1}
          icon={<CreditCard size={15} />}
          title="Payment method"
          description="Choose how you want to pay."
        />
        <div className="space-y-4 p-5 sm:p-6">
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={dynamicPaymentOptions}
          />
        </div>
      </SectionCard>
    </>
  );
}

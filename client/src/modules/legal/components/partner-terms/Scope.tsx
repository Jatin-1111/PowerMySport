import Link from "next/link";

export function Scope() {
  return (
            <section id="scope" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Scope &amp; Acceptance
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                These Partner Terms &amp; Conditions (&quot;Partner Terms&quot;)
                govern the onboarding and continued participation of Experts and
                Academies (each a &quot;Partner,&quot; &quot;you,&quot; or
                &quot;your&quot;) on the PowerMySport platform, operated by
                Powermysport Private Limited (&quot;PowerMySport,&quot;
                &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
              </p>
              <div className="bg-orange-50 border-l-4 border-power-orange p-4 mb-4 rounded-r-lg not-prose">
                <p className="text-slate-700 text-sm font-medium">
                  By submitting an onboarding application, ticking the agreement
                  checkbox, or accepting your first booking on the Platform, you
                  confirm that you have read, understood, and agree to be bound
                  by these Partner Terms. If you do not agree, do not submit an
                  application and do not accept bookings.
                </p>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                These Partner Terms are supplemental to, and are read together
                with, our{" "}
                <Link href="/terms" className="text-orange-600 hover:underline">
                  Terms of Service
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  className="text-orange-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                ,{" "}
                <Link
                  href="/refund-policy"
                  className="text-orange-600 hover:underline"
                >
                  Cancellation, Refund &amp; Dispute Policy
                </Link>
                , and{" "}
                <Link
                  href="/content-policy"
                  className="text-orange-600 hover:underline"
                >
                  Content Policy
                </Link>
                , each of which is incorporated here by reference.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Where these Partner Terms conflict with the general Terms of
                Service on a matter specific to Partners — commission, payouts,
                verification, listing standards, or exit — these Partner Terms
                control. On all other matters, the Terms of Service control.
              </p>
            </section>
  );
}

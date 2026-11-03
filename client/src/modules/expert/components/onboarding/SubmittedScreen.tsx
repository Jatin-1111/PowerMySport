import { Button } from "@/modules/shared/ui/Button";

/**
 * Shown once a profile is with our team. The profile and payout method are both
 * locked while it is PENDING (every server action returns 403 and the expert
 * layout sends a non-approved expert back here), so this does not promise any
 * access it cannot deliver.
 */
export function SubmittedScreen({
  email,
  onHome,
}: {
  email: string | undefined;
  onHome: () => void;
}) {
  return (
    <div className="max-w-xl">
      <p className="text-ink-body text-sm">Expert onboarding</p>
      <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
        Submitted for review
      </h1>
      <p className="text-ink-body mt-4 text-pretty">
        Our team is reviewing your profile. We&apos;ll email you at <strong>{email}</strong> once
        it&apos;s approved. This is usually done within 3 to 5 days.
      </p>
      <p className="text-ink-body border-hairline mt-6 text-pretty border-t pt-6">
        Your profile is locked for editing until this review finishes. There is nothing else to do
        right now except wait for our email.
      </p>
      <div className="mt-8">
        <Button variant="secondary" className="min-h-11" onClick={onHome}>
          Back to home
        </Button>
      </div>
    </div>
  );
}

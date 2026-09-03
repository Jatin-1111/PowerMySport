import { Button } from "@/modules/shared/ui/Button";
import { CheckCircle, Mail } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Application Submitted",
  description: "Your academy onboarding has been submitted for approval",
};

export default function AcademySubmissionSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="space-y-6 rounded-2xl bg-white p-8 text-center shadow-lg">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full bg-emerald-100" />
              <CheckCircle className="absolute inset-0 h-20 w-20 text-emerald-600" />
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="mb-2 text-3xl font-bold text-slate-900">Application Submitted!</h1>
            <p className="text-slate-600">
              Your academy onboarding has been submitted for approval
            </p>
          </div>

          {/* Info Box */}
          <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
              <div className="text-left">
                <h3 className="text-sm font-semibold text-blue-900">Check Your Email</h3>
                <p className="mt-1 text-xs text-blue-800">
                  We&apos;ve sent a confirmation email to the owner email address provided. Keep an
                  eye on your inbox for approval updates.
                </p>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="space-y-3 rounded-lg bg-slate-50 p-4 text-left">
            <h3 className="text-sm font-semibold text-slate-900">What Happens Next?</h3>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-power-orange font-semibold">1.</span>
                <span>Our team reviews your application</span>
              </li>
              <li className="flex gap-2">
                <span className="text-power-orange font-semibold">2.</span>
                <span>We verify your KYC documents (24-48 hours)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-power-orange font-semibold">3.</span>
                <span>Your academy goes live once approved</span>
              </li>
            </ol>
          </div>

          {/* Timeline */}
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600">
              ⏱️ Expected Approval Time:{" "}
              <span className="font-semibold text-slate-900">24-48 hours</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Link href="/academy" className="w-full">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
            <Link href="/booking?tab=academies" className="w-full">
              <Button variant="outline" className="w-full">
                Browse Academies
              </Button>
            </Link>
          </div>

          {/* Support */}
          <div className="border-t border-slate-200 pt-4 text-center">
            <p className="text-sm text-slate-600">
              Need help?{" "}
              <a
                href="mailto:support@powermysport.com"
                className="text-power-orange font-semibold hover:underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

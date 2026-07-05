import { Button } from "@/modules/shared/ui/Button";
import Link from "next/link";
import { CheckCircle, Mail } from "lucide-react";

export const metadata = {
  title: "Application Submitted - PowerMySport",
  description: "Your academy onboarding has been submitted for approval",
};

export default function AcademySubmissionSuccessPage() {
  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 bg-emerald-100 rounded-full" />
              <CheckCircle className="w-20 h-20 text-emerald-600 absolute inset-0" />
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Application Submitted!
            </h1>
            <p className="text-slate-600">
              Your academy onboarding has been submitted for approval
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-left">
                <h3 className="font-semibold text-blue-900 text-sm">
                  Check Your Email
                </h3>
                <p className="text-xs text-blue-800 mt-1">
                  We&apos;ve sent a confirmation email to the owner email
                  address provided. Keep an eye on your inbox for approval
                  updates.
                </p>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="text-left space-y-3 bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 text-sm">
              What Happens Next?
            </h3>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="font-semibold text-power-orange">1.</span>
                <span>Our team reviews your application</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-power-orange">2.</span>
                <span>We verify your KYC documents (24-48 hours)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-power-orange">3.</span>
                <span>Your academy goes live once approved</span>
              </li>
            </ol>
          </div>

          {/* Timeline */}
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 font-medium">
              ⏱️ Expected Approval Time:{" "}
              <span className="text-slate-900 font-semibold">24-48 hours</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Link href="/academy" className="w-full">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
            <Link href="/academies" className="w-full">
              <Button variant="outline" className="w-full">
                Browse Academies
              </Button>
            </Link>
          </div>

          {/* Support */}
          <div className="text-center pt-4 border-t border-slate-200">
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

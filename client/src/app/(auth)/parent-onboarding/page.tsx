"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/modules/shared/ui/Card";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { Input } from "@/components/ui/input";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import { DEFAULT_DEPENDENT_RELATION, DEPENDENT_RELATIONS } from "@/modules/player/constants/dependentRelations";
import { Calendar, UserRound } from "lucide-react";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";

export default function ParentOnboardingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    relation: DEFAULT_DEPENDENT_RELATION,
    sports: [] as string[],
  });

  const maxDob = new Date().toISOString().split("T")[0];
  const minDob = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  })();

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getDependentAge = (dob: string | Date): number | null => {
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData.dob) {
      toast.error("Date of birth is required");
      return;
    }

    const age = getDependentAge(formData.dob);
    if (age === null || age >= 18) {
      toast.error("Dependents must be under 18 years old");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.addDependent(formData);
      toast.success("Child profile added successfully!");
      router.push("/dashboard/my-bookings");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save dependent";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SlideUp duration={0.6} yOffset={20} className="w-full max-w-xl">
        <Card className="w-full glass-panel-heavy premium-shadow border-0">
          <CardHeader>
            <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white">
              Add Your Athlete
            </h1>
            <p className="text-center text-slate-600 dark:text-slate-300 mt-2">
              Let&apos;s create a profile for your child so you can book venues, coaches, and connect with other parents.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <ProfileEditField
                label="Athlete Name"
                htmlFor="dependent-name"
                required
                icon={UserRound}
              >
                <Input
                  id="dependent-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., John Doe"
                  className="bg-white/50 backdrop-blur-sm"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Date of Birth"
                htmlFor="dependent-dob"
                required
                icon={Calendar}
                hint={
                  previewAge !== null
                    ? `Age: ${previewAge} years · Must be under 18.`
                    : "Must be under 18 years old."
                }
              >
                <Input
                  id="dependent-dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange("dob", e.target.value)}
                  min={minDob}
                  max={maxDob}
                  className="bg-white/50 backdrop-blur-sm"
                />
              </ProfileEditField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ProfileEditField label="Gender" htmlFor="dependent-gender">
                  <ProfileFormSelect
                    id="dependent-gender"
                    value={formData.gender}
                    onChange={(value) => handleChange("gender", value)}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                </ProfileEditField>

                <ProfileEditField
                  label="Your Relation"
                  htmlFor="dependent-relation"
                  required
                >
                  <ProfileFormSelect
                    id="dependent-relation"
                    value={formData.relation}
                    onChange={(value) => handleChange("relation", value)}
                    options={DEPENDENT_RELATIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </ProfileEditField>
              </div>

              <ProfileEditField label="Sports Interests (Optional)" hint="Helps personalize recommendations">
                <SportsMultiSelect
                  value={formData.sports}
                  onChange={(sports) => handleChange("sports", sports)}
                />
              </ProfileEditField>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push("/dashboard/my-bookings")}
                  disabled={isSubmitting}
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full premium-shadow"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Athlete"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </SlideUp>
    </div>
  );
}

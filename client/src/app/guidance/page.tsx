"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import api from "@/lib/api/client";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { BrainCircuit, Star, Trophy, Users } from "lucide-react";
import { useState, type FormEvent } from "react";

type GuidanceFormState = {
  child_age: number;
  child_gender: "male" | "female";
  current_fitness_level: "Low" | "Moderate" | "High";
  personality_tags: string[];
  primary_objective: "Recreational" | "Health" | "Social" | "Competitive";
  weekly_time_commitment: number;
  budget_tier: "Budget" | "Moderate" | "Premium";
  parent_specific_question: string;
};

type GuidanceResponse = {
  profileAnalysis: string;
  topSportRecommendations: Array<{
    sport: string;
    reasonWhy: string;
  }>;
  idealCoachingStyle: string;
  weeklyBlueprint: {
    trainingHours: string;
    freePlayHours: string;
    restDays: string;
  };
  recommendedPlatformActions: string;
};

type GuidanceSubmission = {
  id: string;
  query: GuidanceFormState;
  response: GuidanceResponse;
  createdAt: string;
  updatedAt: string;
};

type GuidanceApiResponse = {
  success: boolean;
  message: string;
  data: GuidanceSubmission;
};

const personalityOptions = [
  "Shy",
  "Energetic",
  "Competitive",
  "Social",
  "Focused",
  "Curious",
  "Patient",
  "Team-oriented",
] as const;

const initialForm: GuidanceFormState = {
  child_age: 8,
  child_gender: "male",
  current_fitness_level: "Moderate",
  personality_tags: [],
  primary_objective: "Recreational",
  weekly_time_commitment: 3,
  budget_tier: "Moderate",
  parent_specific_question: "",
};

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-32 w-full" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
      <SkeletonBlock className="h-28 w-full" />
      <SkeletonBlock className="h-28 w-full" />
    </div>
  );
}

export default function GuidancePage() {
  const [form, setForm] = useState<GuidanceFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<GuidanceSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof GuidanceFormState>(
    key: K,
    value: GuidanceFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const toggleTag = (tag: string) => {
    setForm((current) => {
      const hasTag = current.personality_tags.includes(tag);
      return {
        ...current,
        personality_tags: hasTag
          ? current.personality_tags.filter((item) => item !== tag)
          : [...current.personality_tags, tag],
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...form,
      child_age: Number(form.child_age),
      weekly_time_commitment: Number(form.weekly_time_commitment),
    };

    try {
      const response = await api.post<GuidanceApiResponse>(
        "/guidance",
        payload,
      );
      setSubmission(response.data.data);
      toast.success("Guidance generated and saved successfully");
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to generate guidance right now.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_50%,#fff8ee_100%)] text-slate-900">
      <Navigation variant="light" sticky />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur">
              <BrainCircuit className="h-4 w-4 text-power-orange" />
              AI guidance portal
            </div>
            <h1 className="font-title text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Get structured sports advice for the child you are supporting.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Fill out a compact child profile and the platform will return a
              recommendation set for sports, coaching style, weekly rhythm, and
              the next bookings to make.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-[1.75rem] border border-white/80 bg-white/90 p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      child_age
                    </span>
                    <input
                      type="number"
                      min={3}
                      max={21}
                      value={form.child_age}
                      onChange={(event) =>
                        updateField("child_age", Number(event.target.value))
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      child_gender
                    </span>
                    <select
                      value={form.child_gender}
                      onChange={(event) =>
                        updateField(
                          "child_gender",
                          event.target
                            .value as GuidanceFormState["child_gender"],
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      current_fitness_level
                    </span>
                    <select
                      value={form.current_fitness_level}
                      onChange={(event) =>
                        updateField(
                          "current_fitness_level",
                          event.target
                            .value as GuidanceFormState["current_fitness_level"],
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    >
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      primary_objective
                    </span>
                    <select
                      value={form.primary_objective}
                      onChange={(event) =>
                        updateField(
                          "primary_objective",
                          event.target
                            .value as GuidanceFormState["primary_objective"],
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    >
                      <option value="Recreational">Recreational</option>
                      <option value="Health">Health</option>
                      <option value="Social">Social</option>
                      <option value="Competitive">Competitive</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      weekly_time_commitment
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={form.weekly_time_commitment}
                      onChange={(event) =>
                        updateField(
                          "weekly_time_commitment",
                          Number(event.target.value),
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      budget_tier
                    </span>
                    <select
                      value={form.budget_tier}
                      onChange={(event) =>
                        updateField(
                          "budget_tier",
                          event.target
                            .value as GuidanceFormState["budget_tier"],
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                    >
                      <option value="Budget">Budget</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    personality_tags
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {personalityOptions.map((tag) => {
                      const selected = form.personality_tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${selected ? "border-power-orange bg-power-orange/10 text-power-orange" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    parent_specific_question
                  </span>
                  <textarea
                    rows={5}
                    value={form.parent_specific_question}
                    onChange={(event) =>
                      updateField(
                        "parent_specific_question",
                        event.target.value,
                      )
                    }
                    placeholder="What is your biggest concern or goal right now?"
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-power-orange focus:ring-4 focus:ring-power-orange/10"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  className="h-14 w-full rounded-2xl text-base shadow-[0_12px_30px_-10px_rgba(233,115,22,0.45)]"
                >
                  Generate Guidance
                </Button>
              </form>
            </Card>

            <Card className="rounded-[1.75rem] border border-white/80 bg-white/90 p-6 shadow-sm">
              {/* Intentionally left minimal: response-only view (no dashboard titles) */}

              {loading ? (
                <ResultSkeleton />
              ) : submission ? (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-slate-100 bg-[linear-gradient(135deg,#fff8ee_0%,#f7fbff_100%)] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      profileAnalysis
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {submission.response.profileAnalysis}
                    </p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <h3 className="font-semibold text-slate-900">
                        topSportRecommendations
                      </h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {submission.response.topSportRecommendations.map(
                        (item) => (
                          <div
                            key={item.sport}
                            className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4"
                          >
                            <p className="font-semibold text-slate-900">
                              {item.sport}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {item.reasonWhy}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        trainingHours
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {submission.response.weeklyBlueprint.trainingHours}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        freePlayHours
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {submission.response.weeklyBlueprint.freePlayHours}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        restDays
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {submission.response.weeklyBlueprint.restDays}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <h3 className="font-semibold text-slate-900">
                      idealCoachingStyle
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {submission.response.idealCoachingStyle}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
                    <h3 className="font-semibold text-emerald-800">
                      recommendedPlatformActions
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-emerald-900/85">
                      {submission.response.recommendedPlatformActions}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-130 flex-col items-start justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/60 p-6 text-slate-600">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <h3 className="font-title text-2xl font-semibold text-slate-900">
                    Your recommendation dashboard is waiting.
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                    Submit the profile form to receive structured guidance that
                    helps you decide which sport, coach style, and booking path
                    to explore first.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                    <Users className="h-4 w-4 text-power-orange" />
                    JSON response will render here
                  </div>
                </div>
              )}
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

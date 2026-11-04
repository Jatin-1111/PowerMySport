// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The public expert profile used to start in a loading state, so the server HTML
// was a skeleton (about 100 words, no H1) even though the page had already
// fetched the expert. Rendering to a string runs no effects, which is exactly
// what a crawler without JavaScript sees.

vi.mock("next/navigation", () => ({
  useParams: () => ({ expertId: "exp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/modules/auth/store/authStore", () => ({
  useAuthStore: (select: (s: { user: null }) => unknown) => select({ user: null }),
}));
vi.mock("@/lib/api/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("@/modules/expert/services/expert", () => ({
  expertApi: { getExpert: vi.fn(), getExpertReviews: vi.fn(), initiateSession: vi.fn() },
}));
vi.mock("@/modules/expert/components/SlotPicker", () => ({ SlotPicker: () => null }));
vi.mock("@/modules/community/components/ParentExperiencesBand", () => ({ default: () => null }));
vi.mock("@/modules/player/components/CompleteProfileNudge", () => ({
  CompleteProfileNudge: () => null,
  shouldShowTraitsNudge: () => false,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ExpertDetailClient } from "@/app/(booking)/experts/[expertId]/ExpertDetailClient";

const expert = {
  id: "exp-1",
  name: "Asha Rao",
  bio: "Former national-level player and coach.",
  sports: ["Tennis"],
  expertise: ["Technical Coaching"],
  sessionFee: 1500,
  sessionMode: "ONLINE" as const,
  sessionDurationMinutes: 45,
  city: "Chandigarh",
  languages: ["English", "Hindi"],
  isActive: true,
  rating: 4.5,
  reviewCount: 2,
};

describe("ExpertDetailClient first render", () => {
  it("puts the profile in the HTML when the server has already fetched it", () => {
    const html = renderToString(<ExpertDetailClient initialExpert={expert} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Asha Rao");
    expect(html).toContain("Chandigarh");
    expect(html).toContain("45 minutes");
    expect(html).toContain("₹1,500");
  });

  it("still shows the loading skeleton when there is nothing to render yet", () => {
    const html = renderToString(<ExpertDetailClient />);
    expect(html).not.toContain("<h1");
  });
});

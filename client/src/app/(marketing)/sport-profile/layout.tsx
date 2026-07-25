import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build Your Child's Sport Profile | PowerMySport",
  description:
    "Already know your child's sport? Tell us the details and we'll personalise their roadmap, milestones, and guidance around it.",
  alternates: { canonical: "https://www.powermysport.com/sport-profile" },
};

export default function SportProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { ExpertSessions } from "@/modules/expert/components/sessions/ExpertSessions";

export const metadata = {
  title: "Expert sessions",
  description: "Answer session requests, add meeting links and complete sessions with notes.",
};

export default function ExpertSessionsPage() {
  return <ExpertSessions />;
}

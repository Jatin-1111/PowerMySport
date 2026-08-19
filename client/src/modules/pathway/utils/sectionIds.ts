// ─── Section anchors ─────────────────────────────────────────────────────────
//
// The five buckets' DOM ids, in one place so everything that points at a section
// agrees on its name: the reader's own jump bar, and `/roadmap`, which links
// straight to a stage's questions from the index.
//
// A separate module rather than an export from the reader, so a server component
// can link into a section without importing a client component to do it.

export type SectionId =
  | "overview"
  | "questions"
  | "signals"
  | "decisions"
  | "next";

export const sectionDomId = (id: SectionId) => `pathway-section-${id}`;
export const headingDomId = (id: SectionId) => `pathway-heading-${id}`;

import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests share a jsdom document, so an uncleaned tree from one test
// leaks into the next and makes failures depend on file order.
//
// Guarded because this setup file also runs for the node-environment tests,
// where there is no document to clean and `cleanup()` would throw.
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
  }
});

// `findBy*` and `waitFor` give up after 1000ms by default. That is wall-clock time, and
// the full suite runs dozens of jsdom files in parallel, so a heavy page (the expert
// onboarding wizard) could take over a second to render a step on a busy machine and fail
// a test that passes alone. A generous ceiling costs nothing when the element is there,
// because these resolve as soon as it appears; it only changes how long a real failure waits.
if (typeof document !== "undefined") {
  configure({ asyncUtilTimeout: 5000 });
}

// jsdom has no IntersectionObserver, but framer-motion's `whileInView`
// (used throughout the app/ marketing and booking pages) reaches for it on
// mount — without a stub, rendering any such page throws
// "IntersectionObserver is not defined" before a single assertion runs.
if (typeof window !== "undefined" && typeof window.IntersectionObserver === "undefined") {
  class IntersectionObserverStub {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = IntersectionObserverStub;
  globalThis.IntersectionObserver = IntersectionObserverStub;
}

// Animations are for people, not assertions. With them on, a test can read an element
// halfway through a fade (and axe can score its colour at half opacity), so framer-motion
// is told to land every animation on its final frame at once. Loaded only where there is a
// document, so the node-only logic suite does not pay to import it.
if (typeof window !== "undefined") {
  const { MotionGlobalConfig } = await import("framer-motion");
  MotionGlobalConfig.skipAnimations = true;
}

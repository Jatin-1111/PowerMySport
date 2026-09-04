import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
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

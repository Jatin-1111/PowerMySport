// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  askPanelBox,
  cancelAskTransition,
  finishAskTransition,
  startAskTransition,
} from "../src/modules/guidance/utils/askTransition";

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  })) as unknown as typeof window.matchMedia;
};

/** jsdom has no Web Animations; a fake that finishes at once is enough to drive the sequence. */
const installAnimate = () => {
  const animate = vi.fn(() => ({
    playState: "finished",
    finished: Promise.resolve(),
    cancel: vi.fn(),
  }));
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
  return animate;
};

const makeCard = () => {
  const card = document.createElement("div");
  card.innerHTML = '<form id="home-ask"><input id="inner" /></form><a href="/ask">Ask</a>';
  card.id = "card";
  card.getBoundingClientRect = () =>
    ({ left: 700, top: 200, width: 600, height: 470, right: 1300, bottom: 670 }) as DOMRect;
  document.body.appendChild(card);
  return card;
};

const ghostOnScreen = () => document.querySelector('body > div[aria-hidden="true"][inert]');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  setReducedMotion(false);
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: 1440,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
});
afterEach(() => {
  cancelAskTransition();
  document.body.innerHTML = "";
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe("askPanelBox", () => {
  it("matches the workspace panel on a desktop screen", () => {
    expect(askPanelBox(1440, 900)).toEqual({ left: 176, top: 88, width: 1088, height: 764 });
  });

  it("uses tighter padding on a tablet and a phone", () => {
    expect(askPanelBox(700, 900)).toMatchObject({ left: 24, width: 652 });
    expect(askPanelBox(390, 800)).toMatchObject({ left: 16, width: 358, height: 664 });
  });

  it("never gets shorter than the panel's minimum height", () => {
    expect(askPanelBox(1440, 500).height).toBe(520);
  });
});

describe("startAskTransition", () => {
  it("lays a copy of the card over it, hidden from assistive technology", () => {
    installAnimate();
    startAskTransition(makeCard());

    const ghost = ghostOnScreen() as HTMLElement;
    expect(ghost).toBeTruthy();
    expect(ghost.style.left).toBe("700px");
    expect(ghost.style.width).toBe("600px");
    expect(ghost.textContent).toContain("Ask");
  });

  it("strips ids from the copy so the page never has two of them", () => {
    installAnimate();
    startAskTransition(makeCard());

    const ghost = ghostOnScreen() as HTMLElement;
    expect(ghost.querySelector("[id]")).toBeNull();
    expect(document.querySelectorAll("#home-ask").length).toBe(1);
  });

  it("grows the copy to the workspace's box", () => {
    const animate = installAnimate();
    startAskTransition(makeCard());

    const [keyframes] = animate.mock.calls[0] as unknown as [Array<Record<string, string>>];
    expect(keyframes[1]).toEqual({ left: "176px", top: "88px", width: "1088px", height: "764px" });
  });

  it("does nothing when the visitor prefers reduced motion", () => {
    installAnimate();
    setReducedMotion(true);
    startAskTransition(makeCard());

    expect(ghostOnScreen()).toBeNull();
  });

  it("does nothing in a browser without Web Animations, or without a card", () => {
    startAskTransition(makeCard());
    expect(ghostOnScreen()).toBeNull();

    installAnimate();
    startAskTransition(null);
    expect(ghostOnScreen()).toBeNull();
  });
});

describe("finishing and cancelling", () => {
  it("fades the copy out and removes it once the workspace is ready", async () => {
    installAnimate();
    startAskTransition(makeCard());
    expect(ghostOnScreen()).toBeTruthy();

    finishAskTransition();
    await tick();
    await tick();

    expect(ghostOnScreen()).toBeNull();
  });

  it("is safe to call when no copy is on screen", () => {
    expect(() => finishAskTransition()).not.toThrow();
    expect(() => cancelAskTransition()).not.toThrow();
  });

  it("removes the copy at once when cancelled", () => {
    installAnimate();
    startAskTransition(makeCard());

    cancelAskTransition();

    expect(ghostOnScreen()).toBeNull();
  });

  it("replaces an earlier copy rather than stacking a second", () => {
    installAnimate();
    startAskTransition(makeCard());
    startAskTransition(makeCard());

    expect(document.querySelectorAll('body > div[aria-hidden="true"][inert]').length).toBe(1);
  });
});

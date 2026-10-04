/**
 * The homepage "Ask before you decide" card growing into the /ask workspace.
 *
 * On click, a copy of the card is laid over it, fixed to the viewport, and
 * animated to the exact box the workspace occupies. Meanwhile a veil in the
 * page's own background colour fades in over the rest of the homepage, so it
 * dissolves instead of being cut away. Only once the veil is complete does the
 * route change, which means the swap to the new page happens out of sight. When
 * the workspace has rendered, the copy and veil fade away to reveal it. Both
 * live on `document.body`, outside React, so they survive the route change.
 *
 * This is deliberately not the browser's View Transitions API. That needs the
 * destination page to be ready in the same render as the navigation, which only
 * happens for prefetched pages in a production build; in `next dev` it never
 * fires. This works the same in dev, in production and in every browser.
 *
 * Reduced motion skips the whole thing: the navigation is just a navigation.
 */

const DURATION_MS = 1100;
const FADE_OUT_MS = 420;
/** How long the old page takes to dissolve before the route is allowed to change. */
const VEIL_MS = 500;
/** Never leave the copy on screen longer than this, whatever the page is doing. */
const MAX_LIFETIME_MS = 6000;

/**
 * Set on <html> while the copy is on screen. globals.css hides the real
 * workspace under it, so the page never shows through a copy that has not yet
 * grown to cover it; removing the attribute is what starts the crossfade.
 */
const ACTIVE_ATTRIBUTE = "data-ask-transition";

// Eases in and out symmetrically: it leaves gently, covers the distance
// steadily and settles without a bounce. An earlier spring covered half the
// distance in the first fifth of the time, which read as a snap, and its
// overshoot added to the sense of speed.
const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

let ghost: HTMLElement | null = null;
let veil: HTMLElement | null = null;
let growing: Animation | null = null;
let lifetimeTimer: number | undefined;

/**
 * Where the /ask panel sits once the page has loaded. These numbers mirror the
 * layout in AskWorkspace (a max-w-6xl column with responsive padding, under the
 * 64px nav with 24px of room, filling the rest of the viewport), so the copy
 * lands on the real panel rather than near it.
 */
export function askPanelBox(viewportWidth: number, viewportHeight: number): Box {
  const column = Math.min(viewportWidth, 1152);
  const pad = viewportWidth >= 1024 ? 32 : viewportWidth >= 640 ? 24 : 16;
  const top = 64 + 24;
  return {
    left: (viewportWidth - column) / 2 + pad,
    top,
    width: column - pad * 2,
    height: Math.max(520, viewportHeight - 136),
  };
}

const px = (box: Box) => ({
  left: `${box.left}px`,
  top: `${box.top}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
});

function animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  return el.animate(keyframes, { easing: EASE, ...options });
}

/** The workspace's header and composer as outlines, so it arrives already looking like a chat. */
const WORKSPACE_HINT = `
  <div class="absolute inset-x-0 top-0 flex items-center gap-3 border-b border-slate-200 px-4 py-3">
    <span class="flex h-9 w-9 items-center justify-center rounded-md bg-orange-50"></span>
    <span class="text-base font-bold text-slate-900">PowerMySport AI</span>
  </div>
  <div class="absolute inset-x-0 bottom-0 border-t border-slate-200 p-4">
    <div class="h-11 rounded-md border border-slate-300"></div>
  </div>`;

function dispose() {
  document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE);
  window.clearTimeout(lifetimeTimer);
  growing?.cancel();
  growing = null;
  ghost?.remove();
  ghost = null;
  veil?.remove();
  veil = null;
}

/**
 * Start the grow, and call `navigate` once the old page is out of sight (at
 * once when there is nothing to animate: reduced motion, or no Web Animations).
 * `navigate` is called exactly once, whatever happens to the animation.
 */
export function startAskTransition(card: HTMLElement | null, navigate: () => void): void {
  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate();
  };

  if (
    typeof window === "undefined" ||
    !card ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof card.animate !== "function"
  ) {
    go();
    return;
  }

  dispose();

  const rect = card.getBoundingClientRect();
  const from: Box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  const to = askPanelBox(document.documentElement.clientWidth, window.innerHeight);

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  el.className =
    "pointer-events-none fixed z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg";
  Object.assign(el.style, px(from));

  // The card as it was, at its own width so it does not reflow as the box grows.
  const clone = card.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.removeAttribute("id");
  Object.assign(clone.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${from.width}px`,
    margin: "0",
    border: "0",
    boxShadow: "none",
  });
  el.appendChild(clone);

  const hint = document.createElement("div");
  hint.className = "absolute inset-0";
  hint.style.opacity = "0";
  hint.innerHTML = WORKSPACE_HINT;
  el.appendChild(hint);

  // The page dissolves into its own background beneath the card, below the nav.
  const cover = document.createElement("div");
  cover.setAttribute("aria-hidden", "true");
  cover.setAttribute("inert", "");
  Object.assign(cover.style, {
    position: "fixed",
    top: "65px",
    right: "0",
    bottom: "0",
    left: "0",
    zIndex: "39",
    background: "var(--background)",
    opacity: "0",
    pointerEvents: "none",
  });

  document.body.appendChild(cover);
  document.body.appendChild(el);
  document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, "");
  veil = cover;
  ghost = el;

  growing = animate(el, [px(from), px(to)], { duration: DURATION_MS, fill: "forwards" });
  // The card's contents leave over the first half; the workspace's outline
  // arrives over the second, so the two never fight for the same pixels.
  animate(clone, [{ opacity: 1 }, { opacity: 0 }], {
    duration: DURATION_MS * 0.45,
    fill: "forwards",
  });
  animate(hint, [{ opacity: 0 }, { opacity: 1 }], {
    duration: DURATION_MS * 0.45,
    delay: DURATION_MS * 0.4,
    fill: "forwards",
  });

  const dissolving = animate(cover, [{ opacity: 0 }, { opacity: 1 }], {
    duration: VEIL_MS,
    fill: "forwards",
  });
  dissolving.finished.then(go, go);
  // If the animation never reports in (a hidden tab), navigate anyway.
  window.setTimeout(go, VEIL_MS + 300);

  lifetimeTimer = window.setTimeout(dispose, MAX_LIFETIME_MS);
}

/**
 * The workspace is on screen: let the copy finish growing, then fade it out to
 * reveal the real panel beneath it.
 */
export function finishAskTransition(): void {
  if (typeof window === "undefined" || !ghost) return;
  const el = ghost;
  const reveal = () => {
    if (ghost !== el) return;
    // The real workspace fades in (its own CSS transition) as the copy fades out.
    document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE);
    if (veil) {
      animate(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, fill: "forwards" });
    }
    const fade = animate(el, [{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_OUT_MS,
      fill: "forwards",
    });
    fade.finished.then(dispose, dispose);
  };
  if (growing && growing.playState === "running") {
    growing.finished.then(reveal, reveal);
  } else {
    reveal();
  }
}

/** Remove the copy at once (the page it belonged to is gone). */
export function cancelAskTransition(): void {
  if (typeof window === "undefined") return;
  dispose();
}

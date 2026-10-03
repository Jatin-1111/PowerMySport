/**
 * The homepage "Ask before you decide" card growing into the /ask workspace.
 *
 * On click, a copy of the card is laid over it, fixed to the viewport, and
 * animated to the exact box the workspace occupies. The route changes while it
 * grows, and once the workspace has rendered the copy fades away to reveal it.
 * The copy lives on `document.body`, outside React, so it survives the route
 * change.
 *
 * This is deliberately not the browser's View Transitions API. That needs the
 * destination page to be ready in the same render as the navigation, which only
 * happens for prefetched pages in a production build; in `next dev` it never
 * fires. This works the same in dev, in production and in every browser.
 *
 * Reduced motion skips the whole thing: the navigation is just a navigation.
 */

const DURATION_MS = 760;
const FADE_OUT_MS = 240;
/** Never leave the copy on screen longer than this, whatever the page is doing. */
const MAX_LIFETIME_MS = 6000;

// A damped spring sampled into linear(): peaks about 3% past the target and
// settles. Browsers without linear() get the cubic-bezier below.
const SPRING =
  "linear(0, 0.052, 0.186, 0.357, 0.532, 0.688, 0.813, 0.904, 0.966, 1.005, 1.026, 1.034, 1.033, 1.027, 1.02, 1.013, 1.008, 1.004, 1.001, 0.999, 0.999, 0.999, 1, 1, 1, 1)";
const FALLBACK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

let ghost: HTMLElement | null = null;
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
  try {
    return el.animate(keyframes, options);
  } catch {
    // A browser that rejects linear() easing: retry with a plain curve.
    return el.animate(keyframes, { ...options, easing: FALLBACK_EASE });
  }
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
  window.clearTimeout(lifetimeTimer);
  growing?.cancel();
  growing = null;
  ghost?.remove();
  ghost = null;
}

/** Start the grow. Safe to call anywhere: it does nothing it cannot do. */
export function startAskTransition(card: HTMLElement | null): void {
  if (typeof window === "undefined" || !card) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof card.animate !== "function") return;

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

  document.body.appendChild(el);
  ghost = el;

  growing = animate(el, [px(from), px(to)], {
    duration: DURATION_MS,
    easing: SPRING,
    fill: "forwards",
  });
  animate(clone, [{ opacity: 1 }, { opacity: 0 }], {
    duration: 260,
    easing: "ease-out",
    fill: "forwards",
  });
  animate(hint, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 320,
    delay: 220,
    easing: "ease-out",
    fill: "forwards",
  });

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
    const fade = animate(el, [{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_OUT_MS,
      easing: "ease-out",
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

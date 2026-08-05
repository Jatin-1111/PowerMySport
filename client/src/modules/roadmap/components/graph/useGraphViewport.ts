"use client";

// ─── Pan / zoom viewport ────────────────────────────────────────────────────
//
// A layered pathway is far longer along the flow than it is across it, so the
// default view fits the SHORT axis at a readable scale and lets the parent pan
// along the long one — fitting both would shrink the labels past legibility.
// Which axis is short depends on the orientation, so that decision lives in
// `initialTransform`. The overview button drops to fit-everything, which is also
// the zoom-out floor.
//
// A single CSS transform carries both the SVG edge layer and the HTML node
// layer, so dragging never re-runs layout or re-renders React.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clamp,
  fitTransform,
  initialTransform,
  Orientation,
} from "../../graph/geometry";

const MAX_SCALE = 1.6;

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export function useGraphViewport(
  width: number,
  height: number,
  orientation: Orientation = "horizontal",
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  /** Animate programmatic moves (fit, focus, buttons) but never a live drag. */
  const [animating, setAnimating] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  /** Fit-everything scale, which doubles as the zoom-out floor. */
  const fitScaleRef = useRef(0.3);
  const sizeRef = useRef({ w: 0, h: 0 });
  /** Only auto-apply the default view once per diagram, not on every resize. */
  const appliedInitialRef = useRef(false);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const { clientWidth: w, clientHeight: h } = el;
    if (w === 0 || h === 0) return null;
    sizeRef.current = { w, h };
    fitScaleRef.current = fitTransform(w, h, width, height).scale;
    return { w, h };
  }, [width, height]);

  /** Zoom out to show the entire diagram. */
  const fit = useCallback(
    (animate = true) => {
      const size = measure();
      if (!size) return;
      setAnimating(animate);
      setTransform(fitTransform(size.w, size.h, width, height));
    },
    [measure, width, height],
  );

  /** Reset to the readable default: height-fitted, anchored at the start node. */
  const reset = useCallback(
    (animate = true) => {
      const size = measure();
      if (!size) return;
      setAnimating(animate);
      setTransform(initialTransform(size.w, size.h, width, height, orientation));
    },
    [measure, width, height, orientation],
  );

  // Measure on mount and on container resize. The default view is applied once
  // per diagram so a resize doesn't yank the parent back to the start node.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    appliedInitialRef.current = false;
    const apply = () => {
      const size = measure();
      if (!size) return;
      if (!appliedInitialRef.current) {
        appliedInitialRef.current = true;
        setAnimating(false);
        setTransform(
          initialTransform(size.w, size.h, width, height, orientation),
        );
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, width, height, orientation]);

  const clampScale = useCallback((s: number) => {
    return clamp(s, fitScaleRef.current * 0.9, MAX_SCALE);
  }, []);

  /** Zoom keeping the given container-space point visually fixed. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setAnimating(false);
      setTransform((t) => {
        const scale = clampScale(t.scale * factor);
        const ratio = scale / t.scale;
        return {
          scale,
          tx: px - (px - t.tx) * ratio,
          ty: py - (py - t.ty) * ratio,
        };
      });
    },
    [clampScale],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const { w, h } = sizeRef.current;
      setAnimating(true);
      setTransform((t) => {
        const scale = clampScale(t.scale * factor);
        const ratio = scale / t.scale;
        const px = w / 2;
        const py = h / 2;
        return {
          scale,
          tx: px - (px - t.tx) * ratio,
          ty: py - (py - t.ty) * ratio,
        };
      });
    },
    [clampScale],
  );

  /** Centre a diagram-space point — used when selecting a node off-screen. */
  const focusPoint = useCallback(
    (cx: number, cy: number, targetScale?: number) => {
      const { w, h } = sizeRef.current;
      if (w === 0) return;
      setAnimating(true);
      setTransform((t) => {
        const scale = targetScale ? clampScale(targetScale) : t.scale;
        return { scale, tx: w / 2 - cx * scale, ty: h / 2 - cy * scale };
      });
    },
    [clampScale],
  );

  // ── Wheel zoom ──
  // Attached natively because React's synthetic wheel handler is passive, and a
  // passive listener cannot preventDefault — the page would scroll instead.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ── Drag to pan, two-finger pinch to zoom ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Let node buttons and inspector controls handle their own clicks.
    if ((e.target as HTMLElement).closest("[data-graph-interactive]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 1) {
      setIsPanning(true);
      setAnimating(false);
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const prev = pointers.current.get(e.pointerId)!;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        setTransform((t) => ({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
        return;
      }

      if (pointers.current.size === 2) {
        const [p1, p2] = [...pointers.current.values()];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const cx = (p1.x + p2.x) / 2 - rect.left;
        const cy = (p1.y + p2.y) / 2 - rect.top;
        if (pinchRef.current && pinchRef.current.dist > 0) {
          zoomAt(dist / pinchRef.current.dist, cx, cy);
        }
        pinchRef.current = { dist };
      }
    },
    [zoomAt],
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) setIsPanning(false);
  }, []);

  return {
    containerRef,
    transform,
    animating,
    isPanning,
    fit,
    reset,
    zoomBy,
    focusPoint,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
    },
  };
}

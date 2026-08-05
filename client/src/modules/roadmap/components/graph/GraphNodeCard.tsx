"use client";

// ─── Node card ──────────────────────────────────────────────────────────────
//
// Rendered as absolutely-positioned HTML rather than inside the SVG, so text
// stays crisp at any zoom, Tailwind works normally, and each node is a real
// <button> that keyboard and screen-reader users can reach.
//
// The face carries a hard text budget: name, scope line, and one row of three
// facts — where your child stands on the sport's own scale, the age window, and
// what a year of it costs. Everything else belongs in the inspector. Money earns
// its place on the face because it is the fact that actually decides whether a
// family attempts a tier, and burying it made the map read as more optimistic
// than the sport is.
//
// The name is allowed to WRAP to two lines rather than truncate — "AITA
// Championsh…" tells a parent nothing, and a slightly taller card is a cheap
// price for a readable one.

import { HandCoins, Pin, Target } from "lucide-react";

import { PlacedNode } from "../../graph/geometry";
import { GOALS } from "../../graph/goals";
import { LaneTone } from "../../graph/types";
import { LANE_TONES, nodeIcon, NODE_STYLES } from "./tokens";

interface GraphNodeCardProps {
  node: PlacedNode;
  /** Tone of the lane this card sits in — where its colour comes from. */
  tone: LaneTone;
  active: boolean;
  selected: boolean;
  /** The child's current position, from their profile. */
  isCurrent: boolean;
  /** The goal the family said they're aiming at. */
  isGoalTarget: boolean;
  onSelect: (id: string) => void;
}

export function GraphNodeCard({
  node,
  tone,
  active,
  selected,
  isCurrent,
  isGoalTarget,
  onSelect,
}: GraphNodeCardProps) {
  const style = NODE_STYLES[node.kind];
  const goal = node.goalId ? GOALS[node.goalId] : null;
  const accent = goal?.accent ?? LANE_TONES[tone];
  const isStart = node.kind === "start";
  const isGoal = node.kind === "goal";

  return (
    <div
      className="absolute"
      style={{
        left: node.cx - node.w / 2,
        top: node.cy - node.h / 2,
        width: node.w,
        height: node.h,
      }}
    >
      <button
        type="button"
        data-graph-interactive
        onClick={() => onSelect(node.id)}
        aria-pressed={selected}
        className={`group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-[20px] border pl-[18px] pr-3.5 text-left transition-all duration-200 ${
          isStart || isGoal ? "items-center py-3.5" : "py-[15px]"
        } ${active ? style.shell : style.muted} ${
          selected ? "" : "hover:-translate-y-1"
        } ${active ? "opacity-100" : "opacity-45 saturate-50"}`}
        style={{
          // Goal cards paint from their own accent, so a destination is
          // unmistakably a destination and not just another tier.
          ...(isGoal && active
            ? {
                background: `linear-gradient(135deg, ${accent.soft} 0%, #ffffff 78%)`,
                borderColor: accent.ring,
              }
            : null),
          boxShadow: selected
            ? `0 0 0 4px ${accent.hex}2e, 0 18px 34px -16px ${accent.hex}80`
            : undefined,
        }}
      >
        {/* Track stripe. Three pixels of the lane's colour is all it takes to
            make a route traceable by eye across nine columns. */}
        {!isStart && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[5px]"
            style={{ background: active ? accent.hex : "#e2e8f0" }}
          />
        )}

        {/* Icon tile */}
        <span
          className={`flex shrink-0 items-center justify-center rounded-2xl p-2.5 ${
            isStart || isGoal ? "h-10 w-10" : "h-11 w-11"
          } ${isStart ? style.tile : ""}`}
          style={
            isStart
              ? undefined
              : {
                  background: active ? accent.ring : "#f1f5f9",
                  color: active ? accent.dark : "#94a3b8",
                }
          }
        >
          {nodeIcon(node.icon)}
        </span>

        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
          <span
            className={`block text-[19px] font-extrabold leading-[1.15] tracking-[-0.015em] ${
              isGoal ? "" : style.labelClass
            }`}
            style={{
              color: isGoal ? accent.dark : undefined,
              // Two lines maximum, wrapping on word boundaries.
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {node.label}
          </span>

          {/* A goal's blurb is the payoff line for the whole map, so a terminal
              spends its second line on that rather than on a scope tag. */}
          {isGoal ? (
            <span
              className="block text-[13.5px] font-medium leading-[1.3] text-slate-500"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {goal?.blurb.split(/[—.]/)[0]}
            </span>
          ) : (
            node.sublabel && (
              <span
                className={`block text-[13.5px] font-medium leading-[1.3] ${style.subClass}`}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {node.sublabel}
              </span>
            )
          )}

          {/* Exactly two facts, on one line that is guaranteed not to wrap:
              where your child stands on the sport's own scale, and what a year
              of it costs. A third fact made the row wrap and spill past the
              card's bottom edge — and the age window it would have carried is
              already implied by the left-to-right order, called out in the empty
              stretch of each track, and stated in full in the inspector.

              Funding is the exception, because it changes how the cost reads. It
              gets a mark rather than a line: enough to say "there is money
              available here", with the scheme itself in the inspector. */}
          {(node.anchorBand || node.costBand) && (
            <span className="mt-[3px] flex items-baseline gap-x-2 text-[12.5px] leading-none">
              {node.anchorBand && (
                <span
                  className="truncate rounded-md px-1.5 py-[3px] font-bold"
                  style={{ background: accent.soft, color: accent.dark }}
                >
                  {node.anchorBand}
                </span>
              )}
              {node.costBand && (
                <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap font-bold text-slate-600">
                  {node.fundingNote && (
                    <HandCoins className="h-[15px] w-[15px] shrink-0 text-emerald-600" />
                  )}
                  {node.costBand}
                </span>
              )}
            </span>
          )}
        </span>

        {/* Persona pins */}
        {isCurrent && (
          <span className="absolute -top-px right-0 flex items-center gap-1 rounded-bl-xl bg-amber-400 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950">
            <Pin className="h-3 w-3" />
            You are here
          </span>
        )}
        {isGoalTarget && !isCurrent && (
          <span
            className="absolute -top-px right-0 flex items-center gap-1 rounded-bl-xl px-2 py-1 text-[11px] font-black uppercase tracking-wide text-white"
            style={{ background: accent.hex }}
          >
            <Target className="h-3 w-3" />
            Goal
          </span>
        )}
      </button>
    </div>
  );
}

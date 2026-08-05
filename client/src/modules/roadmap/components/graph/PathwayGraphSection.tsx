"use client";

// ─── Pathway graph section ──────────────────────────────────────────────────
//
// Replaces the old archetype stepper as the face of the Journey tab. The four
// stepper variants each put a paragraph of explanation on screen before the
// parent saw any structure; this puts the structure first and moves every
// sentence behind a tap.
//
// `PathwayLevelDetail` used to render underneath, opened by whichever tier was
// selected. It no longer does. Five inner tabs nested inside the page's own tab
// strip put a second navigation system under the map and competed with it for
// the same attention — and its content is per-sport AND per-state, which makes it
// the natural spine of a resource page rather than an appendix to a diagram.
//
// The component and its data are untouched, waiting for `/resources/[sport]`.
// Two things it owned needed rehoming rather than parking: the Layer-2 persona
// note, which is personalised and so can never live on a cacheable resource page
// — it moved into the inspector below — and the Level Up Plan, which is a
// personalised action plan and is currently unreachable until the Plan surface
// lands.

import { MacroLevel } from "@/modules/sports/config/macroLevels";
import { Archetype } from "@/modules/sports/config/sportArchetypes";
import { AnimatePresence } from "framer-motion";
import { Gauge, Info, Route, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import {
  hasResourcePage,
  resourceHref,
  stageAnchor,
} from "@/modules/resources/config";

import { orderedRoute } from "../../graph/geometry";
import { resolveAmbitionGoal, sortGoals } from "../../graph/goals";
import {
  edgeById,
  getPathwayGraph,
  nodeById,
  nodeForRawLevel,
  reachableGoals,
} from "../../graph/registry";
import { GoalId, PathwayGraph } from "../../graph/types";
import { RoadmapPersona } from "../../utils/persona";
import { EdgeInspector } from "./EdgeInspector";
import { GoalRail } from "./GoalRail";
import { GraphCanvas } from "./GraphCanvas";
import { GraphLegend } from "./GraphLegend";
import { GuideCallout } from "./GuideCallout";
import { PathStepper } from "./PathStepper";

interface PathwayGraphSectionProps {
  sportName: string;
  /**
   * Read by neither the map nor the inspector today. It stays on the shape
   * because the per-stage resource link is state-scoped — the local academies
   * and schemes a family actually needs differ by state — and that link is the
   * next thing to land here.
   */
  state?: string;
  archetype: Archetype;
  macroLevels: MacroLevel[];
  persona: RoadmapPersona | null;
  /** Raw level (1–5) the child currently sits on, 0 when unknown. */
  currentRawLevel: number;
  /**
   * Layer-2 personalisation, keyed by raw level. Currently NOT rendered: its only
   * surface was the node panel that used to sit under the map, and a one-line
   * personalised note has no obvious home on a canvas of fixed-size cards. The
   * explorer still fetches it, so this needs either a home or removing upstream —
   * left wired rather than deleted so the decision is visible.
   */
  personalNotes?: Record<number, string> | null;
  personalNotesLoading?: boolean;
  /** Keeps the outer explorer's stage index in sync for the other tabs. */
  onStageChange?: (macroIndex: number) => void;
  /**
   * Opens the Opportunities tab. Also currently unused for the same reason — the
   * funding note it accompanied lived on the node panel. The resource page's
   * funding section covers the same ground with verified scheme data, so this may
   * simply not be needed any more.
   */
  onExploreFunding?: () => void;
}

/**
 * Outer shell: resolves the graph, then remounts the interactive body whenever
 * the sport changes. Remounting via `key` is what lets the body initialise its
 * selection from props in a `useState` initialiser instead of resetting it in an
 * effect — no cascading render, and a parent's selection survives unrelated
 * prop churn like their progress tracker updating.
 */
export function PathwayGraphSection(props: PathwayGraphSectionProps) {
  const graph = useMemo(
    () => getPathwayGraph(props.sportName, props.archetype, props.macroLevels),
    [props.sportName, props.archetype, props.macroLevels],
  );

  return (
    <PathwayGraphBody
      key={`${graph.sportName}|${graph.source}`}
      {...props}
      graph={graph}
    />
  );
}

function PathwayGraphBody({
  sportName,
  macroLevels,
  persona,
  currentRawLevel,
  onStageChange,
  graph,
}: PathwayGraphSectionProps & { graph: PathwayGraph }) {
  const goals = useMemo(() => sortGoals(reachableGoals(graph)), [graph]);
  const personaGoal = resolveAmbitionGoal(persona?.ambition, goals);
  const currentNode = nodeForRawLevel(graph, currentRawLevel || null);

  // Preselect the family's own ambition when we know it — landing on "all
  // paths" is right for a browser, but a family who told us they're aiming at
  // national level should see that route lit up already.
  const [activeGoal, setActiveGoal] = useState<GoalId | null>(() =>
    personaGoal && goals.includes(personaGoal) ? personaGoal : null,
  );
  // Open on wherever the child actually is, falling back to the start node.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => currentNode?.id ?? graph.startNodeId,
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [walkIndex, setWalkIndex] = useState(-1);

  const goalTargetNode = useMemo(() => {
    const target = activeGoal ?? personaGoal;
    return target ? graph.nodes.find((n) => n.goalId === target) : undefined;
  }, [graph, activeGoal, personaGoal]);

  const route = useMemo(
    () => (activeGoal ? orderedRoute(graph, activeGoal) : []),
    [graph, activeGoal],
  );

  const labelFor = (id: string) => nodeById(graph, id)?.label ?? id;

  const selectedNode = nodeById(graph, selectedNodeId);
  const selectedEdge = edgeById(graph, selectedEdgeId);

  /**
   * Notify the outer explorer which stage is showing. Done from the event
   * handlers rather than an effect — the parent's stage index is downstream of
   * a user action, not of our render.
   */
  const syncStage = (nodeId: string) => {
    if (!onStageChange) return;
    const node = nodeById(graph, nodeId);
    if (!node?.rawLevel) return;
    const idx = macroLevels.findIndex((m) =>
      m.rawLevelNumbers.includes(node.rawLevel as number),
    );
    if (idx >= 0) onStageChange(idx);
  };

  const handleSelectNode = (id: string) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(id);
    setWalkIndex(route.indexOf(id));
    syncStage(id);
  };

  const handleSelectEdge = (id: string) => {
    setSelectedEdgeId(id);
    const edge = edgeById(graph, id);
    if (edge) setFocusNodeId(edge.to);
  };

  const handleStep = (index: number) => {
    const id = route[index];
    if (!id) return;
    setWalkIndex(index);
    setSelectedEdgeId(null);
    setSelectedNodeId(id);
    setFocusNodeId(id);
    syncStage(id);
  };

  // The stage guide is keyed on the raw level too, which is what lets a rung link
  // to its own section rather than the top of the page.
  const hasGuide = hasResourcePage(sportName);
  const guideHref =
    hasGuide && selectedNode?.rawLevel
      ? resourceHref(sportName, stageAnchor(selectedNode.rawLevel))
      : null;

  return (
    <div className="space-y-5">
      {/* ── The map ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-md">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-power-orange via-orange-400 to-amber-300"
        />

        {/* Header: what this map is, and the number that settles arguments */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex items-center gap-2">
            <Route className="h-3.5 w-3.5 text-power-orange" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-power-orange">
              Every route, not just one
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {graph.anchorMetric && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                <Gauge className="h-3 w-3 text-slate-400" />
                Measured in {graph.anchorMetric.label}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                graph.source === "authored"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {graph.source === "authored" ? (
                <>
                  <Sparkles className="h-3 w-3" /> Researched map
                </>
              ) : (
                <>
                  <Info className="h-3 w-3" /> Generic structure
                </>
              )}
            </span>
          </div>
        </div>

        {graph.anchorMetric && (
          <p className="px-5 pb-1 pt-2 text-xs leading-relaxed text-slate-500 sm:px-6">
            {graph.anchorMetric.hint}
          </p>
        )}

        <div className="mt-3">
          <GoalRail
            goals={goals}
            selected={activeGoal}
            onSelect={(g) => {
              setActiveGoal(g);
              setWalkIndex(-1);
              setSelectedEdgeId(null);
            }}
            personaGoal={personaGoal}
            personaName={persona?.name}
          />
        </div>

        <GraphCanvas
          graph={graph}
          activeGoal={activeGoal}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onSelectNode={handleSelectNode}
          onSelectEdge={handleSelectEdge}
          currentNodeId={currentNode?.id ?? null}
          goalTargetNodeId={goalTargetNode?.id ?? null}
          focusNodeId={focusNodeId}
        />

        <GraphLegend derived={graph.source === "derived"} />
      </div>

      {/* ── Guided walk along the chosen route ── */}
      {activeGoal && route.length > 1 && (
        <PathStepper
          goalId={activeGoal}
          route={route}
          labelFor={labelFor}
          index={walkIndex}
          onStep={handleStep}
        />
      )}

      {/* ── Transition detail ──
             Only edges get a panel now. Selecting an edge is always a deliberate
             act and its payload is the argument the map exists to make — the two
             gates, and the overreach warning's arithmetic. The node panel that
             used to render here was removed: it repeated facts the card already
             shows, and for a node like the start point it had nothing to say at
             all. The written detail now lives one link away instead. */}
      <AnimatePresence mode="wait">
        {selectedEdge && (
          <EdgeInspector
            key={`edge-${selectedEdge.id}`}
            edge={selectedEdge}
            from={nodeById(graph, selectedEdge.from)}
            to={nodeById(graph, selectedEdge.to)}
            onClose={() => setSelectedEdgeId(null)}
            onSelectNode={handleSelectNode}
          />
        )}
      </AnimatePresence>

      {hasGuide && (
        <GuideCallout
          href={guideHref ?? resourceHref(sportName)}
          sportName={sportName}
          stageLabel={guideHref ? selectedNode?.label : undefined}
        />
      )}
    </div>
  );
}

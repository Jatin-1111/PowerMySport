import React, { useEffect, useState } from "react";
import { View, Text, Modal } from "react-native";
import { usePlannerStore } from "../store/plannerStore";
import { plannerApi } from "../services/planner";
import { longDay } from "../utils/format";
import { Body, Collapsible, SmallButton } from "./ui";

// ─── Events that ran about this time last year ──────────────────────────────────

export function ExpectedLater() {
  const expected = usePlannerStore((s) => s.overview?.expected) ?? [];
  if (expected.length === 0) return null;

  const months = [...new Set(expected.map((e) => e.month))];
  return (
    <Collapsible title="Not announced yet" count={expected.length}>
      <Body muted>
        These are not on the calendar. They ran at about this time last year, so they may come
        again. Nothing is confirmed: no dates, no entry, and an event can be moved or not held.
      </Body>
      {months.map((month) => {
        const group = expected.filter((e) => e.month === month);
        return (
          <View key={month} className="mt-4">
            <Text className="text-ink mb-2 text-sm font-semibold">
              Expected around {group[0].expectedMonth}
            </Text>
            {group.map((e) => (
              <View
                key={`${e.name}-${e.lastYearStart}`}
                className="rounded-tile border-hairline bg-canvas mb-2 border p-3"
              >
                <Text className="text-ink text-base font-semibold">{e.name}</Text>
                {[e.city, e.state].filter(Boolean).length > 0 ? (
                  <Text className="text-muted text-sm">
                    {[e.city, e.state].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
                {e.ladder ? <Text className="text-body text-sm">{e.ladder}</Text> : null}
                <Text className="text-muted mt-1 text-sm">
                  Last year it began {longDay(e.lastYearStart)}.
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </Collapsible>
  );
}

// ─── The four-step tour ─────────────────────────────────────────────────────────

const TOUR_STEPS = [
  {
    title: "Tell us what matters this season",
    body: "Choose a goal, add dates your child can't play, and set a budget if you have one. We use these to choose tournaments for you. You can skip this and change it any time.",
  },
  {
    title: "Pick tournaments",
    body: "Press Suggest my season for a short list, or look through everything open to your child. Add the ones you like to your plan.",
  },
  {
    title: "Follow your plan",
    body: "The Do this next box shows the next thing to do, such as a deadline to enter. We never enter for you. You finish each entry on the AITA website.",
  },
  {
    title: "Find a tournament",
    body: "Open Find events to look through every event your child can enter. Filter by state or level. You don't need it to make a plan.",
  },
];

/**
 * Opens by itself only when the server says the tour has not been seen. While that is unknown,
 * or the request fails, nothing opens: a tour that appears on every failed request is worse than none.
 */
export function PlannerTour({ replay, onClose }: { replay: boolean; onClose: () => void }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    plannerApi
      .tourSeen()
      .then((value) => {
        setSeen(value);
        if (!value) setOpen(true);
      })
      .catch(() => setSeen(null));
  }, []);

  useEffect(() => {
    if (replay) {
      setStep(0);
      setOpen(true);
    }
  }, [replay]);

  const finish = () => {
    setOpen(false);
    onClose();
    // The sheet closes first. A failed save just means it shows again next visit.
    if (seen !== true) {
      setSeen(true);
      void plannerApi.setTourSeen(true).catch(() => undefined);
    }
  };

  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={finish}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-panel bg-canvas p-6 pb-10">
          <Text className="text-muted mb-2 text-xs font-semibold">
            Step {step + 1} of {TOUR_STEPS.length}
          </Text>
          <Text className="text-ink mb-2 text-xl font-bold">{current.title}</Text>
          <Text className="text-body mb-6 text-base leading-relaxed">{current.body}</Text>
          <View className="flex-row flex-wrap gap-3">
            <SmallButton label="Skip tour" onPress={finish} />
            {step > 0 ? <SmallButton label="Back" onPress={() => setStep((s) => s - 1)} /> : null}
            <SmallButton
              label={last ? "Done" : "Next"}
              variant="solid"
              onPress={() => (last ? finish() : setStep((s) => s + 1))}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

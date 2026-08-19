import { describe, expect, it } from "vitest";

import type { PathwayIndexQuestion, QuestionsBySport } from "../services/fetchGuide";
import { interleave, rotateQuestions } from "../services/fetchGuide";

// ─── The rotating question band ──────────────────────────────────────────────
//
// The band shows nine questions out of a pool that grows every time an author
// writes an answer. These tests pin the two things that makes worth doing: the
// window must move over time, and it must eventually show everything.

const pool = (n: number): PathwayIndexQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    question: `Q${i}`,
    stageKey: `stage-${i}`,
    stageName: `Stage ${i}`,
    sportSlug: `sport-${i}`,
    sportName: `Sport ${i}`,
  }));

const TEN_MINUTES = 10 * 60 * 1000;
const texts = (items: PathwayIndexQuestion[]) => items.map((q) => q.question);

// ─── Drawing from every sport, not the loudest one ───────────────────────────
//
// The band read as six Tennis questions in a row, which is what taking a sport's
// whole list before starting the next one produces. Tennis was simply the only
// sport whose answers were written — but the ordering would have kept it that
// way even after the others were.

const sport = (
  slug: string,
  name: string,
  count: number,
): QuestionsBySport => ({
  sportSlug: slug,
  sportName: name,
  questions: Array.from({ length: count }, (_, i) => ({
    question: `${name} Q${i}`,
    stageKey: `stage-${i}`,
    stageName: `Stage ${i}`,
  })),
});

describe("interleave", () => {
  it("takes one question per sport before a second from any of them", () => {
    const pooled = interleave([
      sport("tennis", "Tennis", 3),
      sport("cricket", "Cricket", 3),
      sport("chess", "Chess", 3),
    ]);
    expect(texts(pooled).slice(0, 3)).toEqual([
      "Tennis Q0",
      "Cricket Q0",
      "Chess Q0",
    ]);
    expect(texts(pooled).slice(3, 6)).toEqual([
      "Tennis Q1",
      "Cricket Q1",
      "Chess Q1",
    ]);
  });

  it("fills the first nine from as many sports as exist", () => {
    // Ten sports with two answers each: the band should show ten different
    // sports' questions, not the first sport's two followed by the second's.
    const many = Array.from({ length: 10 }, (_, i) =>
      sport(`sport-${i}`, `Sport ${i}`, 2),
    );
    const band = rotateQuestions(interleave(many), 9, 0);
    expect(new Set(band.map((q) => q.sportSlug)).size).toBe(9);
  });

  it("visits sports in curated order, not the order the API returned", () => {
    const pooled = interleave([
      sport("chess", "Chess", 1),
      sport("tennis", "Tennis", 1),
      sport("cricket", "Cricket", 1),
    ]);
    // Registry order is tennis, cricket, chess.
    expect(texts(pooled)).toEqual(["Tennis Q0", "Cricket Q0", "Chess Q0"]);
  });

  it("keeps going when a sport runs out of answers", () => {
    // Today's shape: one sport deep, the rest empty or shallow.
    const pooled = interleave([
      sport("tennis", "Tennis", 4),
      sport("cricket", "Cricket", 1),
    ]);
    expect(texts(pooled)).toEqual([
      "Tennis Q0",
      "Cricket Q0",
      "Tennis Q1",
      "Tennis Q2",
      "Tennis Q3",
    ]);
  });

  it("survives a sport with nothing written yet", () => {
    const pooled = interleave([
      sport("tennis", "Tennis", 2),
      sport("cricket", "Cricket", 0),
    ]);
    expect(texts(pooled)).toEqual(["Tennis Q0", "Tennis Q1"]);
  });
});

describe("rotateQuestions", () => {
  it("returns the whole pool untouched when there is nothing to rotate", () => {
    // Today's case: one sport with eight answers written, nine slots to fill.
    expect(texts(rotateQuestions(pool(8), 9, 0))).toEqual(texts(pool(8)));
    expect(texts(rotateQuestions(pool(9), 9, 5 * TEN_MINUTES))).toEqual(
      texts(pool(9)),
    );
    expect(rotateQuestions([], 9, 0)).toEqual([]);
  });

  it("shows exactly `count` questions once the pool is bigger", () => {
    expect(rotateQuestions(pool(40), 9, 0)).toHaveLength(9);
    expect(rotateQuestions(pool(40), 9, 99 * TEN_MINUTES)).toHaveLength(9);
  });

  it("holds still inside a rotation window and moves on at the boundary", () => {
    const big = pool(40);
    const first = texts(rotateQuestions(big, 9, 0));

    // Same window — a reload must not reshuffle the page under the reader.
    expect(texts(rotateQuestions(big, 9, TEN_MINUTES - 1))).toEqual(first);

    // Next window — different questions.
    expect(texts(rotateQuestions(big, 9, TEN_MINUTES))).not.toEqual(first);
  });

  it("advances by a full page, so consecutive windows do not repeat", () => {
    const big = pool(40);
    const first = rotateQuestions(big, 9, 0);
    const second = rotateQuestions(big, 9, TEN_MINUTES);
    const overlap = texts(first).filter((q) => texts(second).includes(q));
    expect(overlap).toEqual([]);
  });

  it("eventually shows every question in the pool", () => {
    // The point of rotating at all: an answer somebody wrote should not be
    // invisible forever because it sorted tenth.
    const big = pool(40);
    const seen = new Set<string>();
    for (let window = 0; window < 40; window += 1) {
      texts(rotateQuestions(big, 9, window * TEN_MINUTES)).forEach((q) =>
        seen.add(q),
      );
    }
    expect(seen.size).toBe(40);
  });

  it("wraps instead of running short at the end of the pool", () => {
    // 40 is not a multiple of 9, so some window must straddle the end. It should
    // still hand back nine questions rather than the two that were left.
    for (let window = 0; window < 20; window += 1) {
      const page = rotateQuestions(pool(40), 9, window * TEN_MINUTES);
      expect(page).toHaveLength(9);
      expect(page.every(Boolean)).toBe(true);
    }
  });

  it("never repeats a question inside one window", () => {
    // A pool barely larger than the band is where a naive wrap shows the same
    // question twice on screen.
    const page = rotateQuestions(pool(10), 9, 7 * TEN_MINUTES);
    expect(new Set(texts(page)).size).toBe(9);
  });
});

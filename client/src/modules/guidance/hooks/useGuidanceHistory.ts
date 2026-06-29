"use client";

import { useState, useEffect, type RefObject } from "react";
import api from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import type { GuidanceSubmission } from "../types";

export function useGuidanceHistory({
  setSubmission,
  setShowResults,
  resultsRef,
  currentSubmissionId,
  onLoadPast,
}: {
  setSubmission: (s: GuidanceSubmission | null) => void;
  setShowResults: (v: boolean) => void;
  resultsRef: RefObject<HTMLDivElement>;
  currentSubmissionId?: string | null;
  onLoadPast?: (past: GuidanceSubmission) => void;
}) {
  const [history, setHistory] = useState<GuidanceSubmission[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ success: boolean; data: GuidanceSubmission[] }>("/guidance")
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data))
          setHistory(res.data.data);
      })
      .catch(() => {});
  }, []);

  const handleDeleteRoadmap = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/guidance/${id}`);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (currentSubmissionId === id) {
        setSubmission(null);
        setShowResults(false);
      }
      toast.success("Roadmap deleted");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unable to delete roadmap.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const loadPastSubmission = (past: GuidanceSubmission) => {
    setSubmission(past);
    onLoadPast?.(past);
    setShowResults(true);
    toast.success("Loaded past roadmap");
    setTimeout(
      () =>
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      350,
    );
  };

  return {
    history,
    setHistory,
    deletingId,
    handleDeleteRoadmap,
    loadPastSubmission,
  };
}

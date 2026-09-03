"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";

export function useReportModal() {
  const [reportModal, setReportModal] = useState<{
    targetType: "MESSAGE" | "GROUP";
    targetId: string;
  } | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleOpenReportModal = (targetType: "MESSAGE" | "GROUP", targetId: string) => {
    setReportModal({ targetType, targetId });
  };

  const handleSubmitReportWrapper = async (reason: string, details: string) => {
    if (!reportModal || !reason) return;
    try {
      setIsSubmittingReport(true);
      await communityService.reportContent({
        targetType: reportModal.targetType,
        targetId: reportModal.targetId,
        reason,
        details: details || undefined,
      });
      setReportModal(null);
      toast.success("Report submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return {
    reportModal,
    setReportModal,
    isSubmittingReport,
    handleOpenReportModal,
    handleSubmitReportWrapper,
  };
}

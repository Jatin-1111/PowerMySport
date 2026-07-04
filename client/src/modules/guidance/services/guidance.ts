import api from "@/lib/api/axios";

export const downloadGuidanceReportPdf = async (
  submissionId: string,
): Promise<void> => {
  const response = await api.get(`/guidance/${submissionId}/report/pdf`, {
    responseType: "blob",
  });
  const blob = response.data as Blob;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `guidance-report-${submissionId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

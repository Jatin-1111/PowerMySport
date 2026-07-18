import api, { API_BASE_URL } from "@/lib/api/axios";

// The message (child's age/gender/level/question) is built server-side and
// the browser only ever sees this opaque redirect URL — nothing identifying
// sits in a client-rendered href, browser history, or click-tracking.
export const getGuidanceWhatsAppUrl = (submissionId: string): string =>
  `${API_BASE_URL}/guidance/${submissionId}/whatsapp`;

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

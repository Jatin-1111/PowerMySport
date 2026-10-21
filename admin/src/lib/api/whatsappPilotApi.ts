import axiosInstance from "./axios";

export type WhatsAppPilotMode = "listed" | "everyone";

export interface WhatsAppPilotEntry {
  id: string;
  label: string;
  lastFour: string;
  createdAt: string;
}

export interface WhatsAppPilotState {
  mode: WhatsAppPilotMode;
  numbers: WhatsAppPilotEntry[];
  assistantOn: boolean;
  envListCount: number;
}

export interface AddNumbersResult {
  added: number;
  alreadyListed: number;
  invalid: string[];
}

export const whatsappPilotApi = {
  get: async () => {
    const res = await axiosInstance.get<{ success: boolean; data: WhatsAppPilotState }>(
      "/admin/whatsapp-pilot"
    );
    return res.data.data;
  },

  addNumbers: async (text: string) => {
    const res = await axiosInstance.post<{ success: boolean; data: AddNumbersResult }>(
      "/admin/whatsapp-pilot/numbers",
      { text }
    );
    return res.data.data;
  },

  removeNumber: async (id: string) => {
    await axiosInstance.delete(`/admin/whatsapp-pilot/numbers/${id}`);
  },

  setMode: async (mode: WhatsAppPilotMode) => {
    await axiosInstance.put("/admin/whatsapp-pilot/mode", { mode });
  },
};

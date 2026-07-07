import axiosInstance from "@/lib/api/axios";

export interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  reason: string;
  referenceId?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
  createdAt: string;
  updatedAt: string;
}

export const walletApi = {
  getWallet: async (): Promise<Wallet> => {
    const response = await axiosInstance.get("/wallet");
    return response.data.data;
  },

  topUpWallet: async (
    amount: number,
  ): Promise<{ redirectUrl: string; merchantOrderId: string }> => {
    const response = await axiosInstance.post("/wallet/topup", { amount });
    return response.data.data;
  },

  verifyTopUp: async (
    merchantOrderId: string,
  ): Promise<{ status: string; amount?: number; wallet: Wallet }> => {
    const response = await axiosInstance.post("/wallet/topup/verify", {
      merchantOrderId,
    });
    return response.data.data;
  },
};

import {
  Env,
  MetaInfo,
  PrefillUserLoginDetails,
  RefundRequest,
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
} from "@phonepe-pg/pg-sdk-node";

export interface PhonePeInitPaymentResult {
  merchantOrderId: string;
  redirectUrl: string;
  orderId?: string;
  state?: string;
}

export interface PhonePeOrderStatusResult {
  orderId?: string;
  state?: string;
  amount?: number;
  raw?: any;
}

export interface PhonePeCallbackResult {
  type: string;
  payload: any;
}

export interface PhonePeRefundResult {
  refundId?: string;
  state?: string;
  amount?: number;
  raw?: any;
}

const getPhonePeEnv = (): Env => {
  const env = (process.env.PHONEPE_ENV || "SANDBOX").toUpperCase();
  return env === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX;
};

const getPhonePeConfig = () => {
  const clientId = process.env.PHONEPE_CLIENT_ID || "";
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "";
  const clientVersion = Number(process.env.PHONEPE_CLIENT_VERSION || 0);

  if (!clientId || !clientSecret || !clientVersion) {
    throw new Error(
      "PhonePe credentials are not configured (PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION)",
    );
  }

  return { clientId, clientSecret, clientVersion, env: getPhonePeEnv() };
};

let cachedClient: StandardCheckoutClient | null = null;

const getPhonePeClient = (): StandardCheckoutClient => {
  if (cachedClient) return cachedClient;

  const { clientId, clientSecret, clientVersion, env } = getPhonePeConfig();
  cachedClient = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env,
  );
  return cachedClient;
};

const buildPayRequest = (payload: {
  merchantOrderId: string;
  amount: number;
  redirectUrl: string;
  userPhone?: string;
  metaInfo?: Record<string, string>;
}): any => {
  const builder =
    (StandardCheckoutPayRequest as any).builder?.() ||
    (StandardCheckoutPayRequest as any).build_request?.();

  if (!builder) {
    throw new Error("PhonePe SDK request builder not available");
  }

  builder
    .merchantOrderId(payload.merchantOrderId)
    .amount(payload.amount)
    .redirectUrl(payload.redirectUrl)
    .expireAfter(3600);

  if (payload.userPhone) {
    const prefillBuilder = (PrefillUserLoginDetails as any).builder?.();
    if (prefillBuilder) {
      const prefill = prefillBuilder.phoneNumber(payload.userPhone).build();
      builder.prefillUserLoginDetails(prefill);
    }
  }

  if (payload.metaInfo) {
    const metaBuilder = (MetaInfo as any).builder?.();
    if (metaBuilder) {
      Object.entries(payload.metaInfo).forEach(([key, value]) => {
        if (typeof metaBuilder[key] === "function") {
          metaBuilder[key](value);
        }
      });
      builder.metaInfo(metaBuilder.build());
    }
  }

  return builder.build();
};

export const initiatePhonePePayment = async (payload: {
  merchantOrderId: string;
  amount: number;
  redirectUrl: string;
  userPhone?: string;
  metaInfo?: Record<string, string>;
}): Promise<PhonePeInitPaymentResult> => {
  const client = getPhonePeClient();
  const request = buildPayRequest(payload);

  const response = await client.pay(request);
  const redirectUrl = response.redirectUrl;

  if (!redirectUrl) {
    throw new Error("PhonePe did not return a redirect URL");
  }

  return {
    merchantOrderId: payload.merchantOrderId,
    redirectUrl,
    orderId: response.orderId,
    state: response.state,
  };
};

export const getPhonePeOrderStatus = async (
  merchantOrderId: string,
): Promise<PhonePeOrderStatusResult> => {
  const client = getPhonePeClient();
  const response = await client.getOrderStatus(merchantOrderId);

  return {
    orderId: response.orderId,
    state: response.state,
    amount: response.amount,
    raw: response,
  };
};

export const validatePhonePeCallback = (
  authorizationHeader: string,
  bodyString: string,
): PhonePeCallbackResult => {
  const client = getPhonePeClient();
  const username = process.env.PHONEPE_CALLBACK_USERNAME || "";
  const password = process.env.PHONEPE_CALLBACK_PASSWORD || "";

  if (!username || !password) {
    throw new Error(
      "PhonePe callback credentials not configured (PHONEPE_CALLBACK_USERNAME, PHONEPE_CALLBACK_PASSWORD)",
    );
  }

  const response = client.validateCallback(
    username,
    password,
    authorizationHeader,
    bodyString,
  );

  return {
    type: String(response.type),
    payload: response.payload,
  };
};

const buildRefundRequest = (payload: {
  merchantRefundId: string;
  originalMerchantOrderId: string;
  amount: number;
}): any => {
  const builder =
    (RefundRequest as any).builder?.() ||
    (RefundRequest as any).build_request?.();

  if (!builder) {
    throw new Error("PhonePe SDK refund builder not available");
  }

  builder
    .merchantRefundId(payload.merchantRefundId)
    .originalMerchantOrderId(payload.originalMerchantOrderId)
    .amount(payload.amount);

  return builder.build();
};

export const initiatePhonePeRefund = async (payload: {
  merchantRefundId: string;
  originalMerchantOrderId: string;
  amount: number;
}): Promise<PhonePeRefundResult> => {
  const client = getPhonePeClient();
  const request = buildRefundRequest(payload);
  const response = await client.refund(request);

  return {
    refundId: response.refundId,
    state: response.state,
    amount: response.amount,
    raw: response,
  };
};

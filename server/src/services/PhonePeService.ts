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

export interface PhonePeRefundStatusResult {
  refundId?: string;
  merchantRefundId?: string;
  state?: string;
  amount?: number;
  paymentDetails?: any;
  raw?: any;
}

type PhonePeErrorMapping = {
  userMessage: string;
  statusCode: number;
  retryable?: boolean;
};

const PHONEPE_ERROR_MAP: Record<string, PhonePeErrorMapping> = {
  INVALID_MERCHANT_ID: {
    userMessage: "PhonePe merchant configuration is invalid.",
    statusCode: 500,
  },
  INVALID_MERCHANT_KEY: {
    userMessage: "PhonePe merchant credentials are invalid.",
    statusCode: 500,
  },
  INVALID_REDIRECT_URL: {
    userMessage: "Payment redirect URL is invalid.",
    statusCode: 400,
  },
  INVALID_AMOUNT: {
    userMessage: "Payment amount is invalid.",
    statusCode: 400,
  },
  PAYMENT_ALREADY_COMPLETED: {
    userMessage: "This payment is already completed.",
    statusCode: 409,
  },
  ORDER_NOT_FOUND: {
    userMessage: "Payment order was not found in PhonePe.",
    statusCode: 404,
  },
  REFUND_AMOUNT_EXCEEDS_ORIGINAL: {
    userMessage: "Refund amount exceeds original payment amount.",
    statusCode: 400,
  },
  REFUND_ALREADY_PROCESSED: {
    userMessage: "Refund has already been processed.",
    statusCode: 409,
  },
  SUBSCRIPTION_NOT_FOUND: {
    userMessage: "Requested PhonePe subscription was not found.",
    statusCode: 404,
  },
  INTERNAL_SERVER_ERROR: {
    userMessage: "PhonePe service is temporarily unavailable.",
    statusCode: 502,
    retryable: true,
  },
  NETWORK_ERROR: {
    userMessage: "Could not reach PhonePe. Please try again.",
    statusCode: 503,
    retryable: true,
  },
};

export class PhonePeGatewayError extends Error {
  public readonly code: string;

  public readonly statusCode: number;

  public readonly retryable: boolean;

  public readonly raw?: unknown;

  constructor(options: {
    code: string;
    message: string;
    statusCode: number;
    retryable?: boolean;
    raw?: unknown;
  }) {
    super(options.message);
    this.name = "PhonePeGatewayError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = Boolean(options.retryable);
    this.raw = options.raw;
  }
}

export const isPhonePeGatewayError = (
  error: unknown,
): error is PhonePeGatewayError => error instanceof PhonePeGatewayError;

const toPhonePeGatewayError = (
  operation: string,
  error: unknown,
): PhonePeGatewayError => {
  const typedError = error as {
    code?: unknown;
    message?: unknown;
    response?: { data?: { code?: unknown; message?: unknown } };
  };

  const responseCode = typedError.response?.data?.code;
  const errorCode = typedError.code;
  const code =
    (typeof responseCode === "string" && responseCode) ||
    (typeof errorCode === "string" && errorCode) ||
    "UNKNOWN_PHONEPE_ERROR";

  const mapping = PHONEPE_ERROR_MAP[code] || {
    userMessage: `PhonePe request failed while processing ${operation}.`,
    statusCode: 502,
    retryable: false,
  };

  const providerMessage =
    (typeof typedError.response?.data?.message === "string" &&
      typedError.response.data.message) ||
    (typeof typedError.message === "string" && typedError.message) ||
    "Unknown PhonePe error";

  return new PhonePeGatewayError({
    code,
    message: `${mapping.userMessage} (${providerMessage})`,
    statusCode: mapping.statusCode,
    retryable: Boolean(mapping.retryable),
    raw: error,
  });
};

const executePhonePeRequest = async <T>(
  operation: string,
  executor: () => Promise<T>,
): Promise<T> => {
  try {
    return await executor();
  } catch (error) {
    throw toPhonePeGatewayError(operation, error);
  }
};

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

  const response = await executePhonePeRequest("initiate payment", () =>
    client.pay(request),
  );
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
  const response = await executePhonePeRequest("fetch order status", () =>
    client.getOrderStatus(merchantOrderId),
  );

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

  let response: { type?: unknown; payload?: unknown };
  try {
    response = client.validateCallback(
      username,
      password,
      authorizationHeader,
      bodyString,
    ) as { type?: unknown; payload?: unknown };
  } catch (error) {
    throw toPhonePeGatewayError("validate callback", error);
  }

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
  const response = await executePhonePeRequest("initiate refund", () =>
    client.refund(request),
  );

  return {
    refundId: response.refundId,
    state: response.state,
    amount: response.amount,
    raw: response,
  };
};

export const getPhonePeRefundStatus = async (
  merchantRefundId: string,
): Promise<PhonePeRefundStatusResult> => {
  const client = getPhonePeClient();
  const response = (await executePhonePeRequest("fetch refund status", () =>
    (client as any).getRefundStatus(merchantRefundId),
  )) as {
    refundId?: string;
    merchantRefundId?: string;
    state?: string;
    amount?: number;
    paymentDetails?: unknown;
  };

  const result: PhonePeRefundStatusResult = {
    raw: response,
  };

  if (typeof response.refundId === "string") {
    result.refundId = response.refundId;
  }
  if (typeof response.merchantRefundId === "string") {
    result.merchantRefundId = response.merchantRefundId;
  }
  if (typeof response.state === "string") {
    result.state = response.state;
  }
  if (typeof response.amount === "number") {
    result.amount = response.amount;
  }
  if (response.paymentDetails !== undefined) {
    result.paymentDetails = response.paymentDetails;
  }

  return result;
};

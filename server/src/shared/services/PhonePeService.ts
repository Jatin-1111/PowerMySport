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
  // --- Merchant config errors ---
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

  // --- Order / payment state ---
  PAYMENT_ALREADY_COMPLETED: {
    userMessage: "This payment is already completed.",
    statusCode: 409,
  },
  ORDER_NOT_FOUND: {
    userMessage: "Payment order was not found in PhonePe.",
    statusCode: 404,
  },
  SUBSCRIPTION_NOT_FOUND: {
    userMessage: "Requested PhonePe subscription was not found.",
    statusCode: 404,
  },

  // --- Refund errors ---
  REFUND_AMOUNT_EXCEEDS_ORIGINAL: {
    userMessage: "Refund amount exceeds original payment amount.",
    statusCode: 400,
  },
  REFUND_ALREADY_PROCESSED: {
    userMessage: "Refund has already been processed.",
    statusCode: 409,
  },
  BF_034: {
    userMessage: "PhonePe does not have sufficient balance to process this refund. Please contact support.",
    statusCode: 502,
  },
  REFUND_FOR_TXN_OLDER_THAN_LIMIT: {
    userMessage: "Refund cannot be initiated — the transaction is older than PhonePe's 90-day refund window.",
    statusCode: 400,
  },

  // --- Customer payment failures (not retryable) ---
  Z9: {
    userMessage: "Payment failed — customer has insufficient funds.",
    statusCode: 402,
  },
  ZM: {
    userMessage: "Payment failed — incorrect UPI PIN entered.",
    statusCode: 400,
  },
  B1: {
    userMessage: "Payment failed — account number does not match bank records.",
    statusCode: 400,
  },
  CARD_EXPIRED: {
    userMessage: "Payment failed — the customer's card has expired.",
    statusCode: 400,
  },
  OTP_EXPIRED: {
    userMessage: "Payment failed — the OTP expired before it was entered.",
    statusCode: 400,
  },
  K1: {
    userMessage: "Payment declined by the bank for security reasons.",
    statusCode: 402,
  },
  XH: {
    userMessage: "Payment failed — the bank account does not exist or is not registered.",
    statusCode: 400,
  },
  U80: {
    userMessage: "Payment failed — the customer's bank account is frozen.",
    statusCode: 402,
  },

  // --- Transaction limit errors ---
  Z6: { userMessage: "Payment failed — daily transaction limit exceeded.", statusCode: 402 },
  Z7: { userMessage: "Payment failed — per-transaction limit exceeded.", statusCode: 402 },
  Z8: { userMessage: "Payment failed — transaction limit exceeded.", statusCode: 402 },
  TXN_LIMIT_BREACHED: { userMessage: "Payment failed — transaction limit exceeded.", statusCode: 402 },
  WITHDRAWAL_LIMIT_EXCEEDED: { userMessage: "Payment failed — bank withdrawal limit exceeded.", statusCode: 402 },

  // --- Merchant security blocks ---
  INTERNAL_SECURITY_BLOCK_1: {
    userMessage: "Payment blocked — payment URL mismatch with merchant onboarding.",
    statusCode: 403,
  },
  INTERNAL_SECURITY_BLOCK_2: {
    userMessage: "Payment blocked — IP address mismatch.",
    statusCode: 403,
  },
  INTERNAL_SECURITY_BLOCK_6: {
    userMessage: "Payment blocked — Video KYC verification incomplete.",
    statusCode: 403,
  },

  // --- Transient bank / gateway errors (retryable) ---
  UT: { userMessage: "Payment failed — bank is temporarily unavailable.", statusCode: 503, retryable: true },
  U28: { userMessage: "Payment failed — bank is temporarily unavailable.", statusCode: 503, retryable: true },
  U03: { userMessage: "Payment failed — bank is temporarily unavailable.", statusCode: 503, retryable: true },
  XB: { userMessage: "Payment failed — bank is temporarily unavailable.", statusCode: 503, retryable: true },
  YE: { userMessage: "Payment failed — bank is temporarily unavailable.", statusCode: 503, retryable: true },
  REQUEST_TIME_OUT: {
    userMessage: "PhonePe request timed out. Please try again.",
    statusCode: 504,
    retryable: true,
  },
  CONNECTION_TIMEOUT: {
    userMessage: "Could not connect to PhonePe. Please try again.",
    statusCode: 503,
    retryable: true,
  },
  GENERIC_ERROR: {
    userMessage: "PhonePe encountered a temporary error. Please try again.",
    statusCode: 502,
    retryable: true,
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

const isPhonePeAuthError = (error: unknown): boolean => {
  const err = error as any;
  const msg: string = (err?.message ?? "").toLowerCase();
  return (
    err?.httpStatusCode === 401 ||
    msg.includes("authorization failed") ||
    msg.includes("please check the authorization token")
  );
};

const resetPhonePeSDKClient = (): void => {
  // Wipe the SDK-level singleton so the next getInstance() creates a fresh client.
  (StandardCheckoutClient as any)._client = undefined;

  // TokenService.oAuthResponse is a static field shared across ALL TokenService instances.
  // Nulling it forces the new client's TokenService to fetch a fresh OAuth token instead
  // of reusing the stale cached one (which would still pass isCachedTokenValid() and
  // cause the auth retry to fail with the same bad token).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TokenService } = require("@phonepe-pg/pg-sdk-node/dist/common/tokenhandler/TokenService");
    TokenService.oAuthResponse = null;
  } catch {
    // Internal module path changed in an SDK update — non-fatal; token will refresh naturally
  }

  cachedClient = null;
  cachedConfigKey = null;
  clientCreatedAt = 0;
};

const executePhonePeRequest = async <T>(
  operation: string,
  executor: () => Promise<T>,
): Promise<T> => {
  try {
    return await executor();
  } catch (error) {
    if (isPhonePeAuthError(error)) {
      // Stale OAuth token — reset the SDK singleton and retry once with a fresh client.
      resetPhonePeSDKClient();
      try {
        return await executor();
      } catch (retryError) {
        throw toPhonePeGatewayError(operation, retryError);
      }
    }
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
let cachedConfigKey: string | null = null;
let clientCreatedAt: number = 0;
// Re-create the SDK client every 2 hours so its internal OAuth token never goes stale.
const CLIENT_TTL_MS = 2 * 60 * 60 * 1000;

const getPhonePeClient = (): StandardCheckoutClient => {
  const { clientId, clientSecret, clientVersion, env } = getPhonePeConfig();
  const configKey = `${clientId}:${clientVersion}:${env}`;
  const now = Date.now();

  if (
    cachedClient &&
    (cachedConfigKey !== configKey || now - clientCreatedAt > CLIENT_TTL_MS)
  ) {
    cachedClient = null;
    cachedConfigKey = null;
  }

  if (!cachedClient) {
    cachedClient = StandardCheckoutClient.getInstance(
      clientId,
      clientSecret,
      clientVersion,
      env,
    );
    cachedConfigKey = configKey;
    clientCreatedAt = now;
  }

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
    .expireAfter(600); // 10 minutes QR code validity (reduced from 1 hour)

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
  const request = buildPayRequest(payload);

  const response = await executePhonePeRequest("initiate payment", () =>
    getPhonePeClient().pay(request),
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
  const response = await executePhonePeRequest("fetch order status", () =>
    getPhonePeClient().getOrderStatus(merchantOrderId),
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
    .amount(Math.round(payload.amount * 100));

  return builder.build();
};

export const initiatePhonePeRefund = async (payload: {
  merchantRefundId: string;
  originalMerchantOrderId: string;
  amount: number;
}): Promise<PhonePeRefundResult> => {
  const request = buildRefundRequest(payload);
  const response = await executePhonePeRequest("initiate refund", () =>
    getPhonePeClient().refund(request),
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
  const response = (await executePhonePeRequest("fetch refund status", () =>
    (getPhonePeClient() as any).getRefundStatus(merchantRefundId),
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

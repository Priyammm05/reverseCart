const DEFAULT_BASE_URL = "https://sandbox.api.prava.space";

export type PravaSession = {
  session_id: string;
  session_token: string;
  iframe_url: string;
  order_id: string;
  expires_at: string;
};

export type PravaLineItem = {
  txn_ref_id: string;
  merchant_name: string | null;
  total_amount: string;
  // Prava's dashboard currently labels credential-ready attempts as
  // `Creds_Generated`; tolerate provider status additions without losing the
  // strongly typed states documented by the API.
  status: "pending" | "awaiting_result" | "creds_generated" | "completed" | "failed" | string;
  token: string | null;
  dynamic_cvv: string | null;
  expiry_month: string | null;
  expiry_year: string | null;
};

export type PravaPaymentResult = {
  session_id: string;
  order_id: string | null;
  status: "pending" | "awaiting_result" | "creds_generated" | "completed" | "failed" | string;
  transactions: Array<{ txn_id: string; status: string; line_items: PravaLineItem[] }>;
};

export class PravaApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
  }
}

function config() {
  const apiKey = process.env.PRAVA_SECRET_KEY;
  if (!apiKey) throw new PravaApiError("Prava is not configured.", 503, "PRAVA_NOT_CONFIGURED");
  return { apiKey, baseUrl: process.env.PRAVA_API_BASE_URL || DEFAULT_BASE_URL };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = (await response.json()) as T & { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new PravaApiError(data.error?.message || "Prava request failed.", response.status, data.error?.code);
  }
  return data;
}

export async function createPravaSession(input: {
  amountMinor: number;
  merchant: string;
  itemDescription?: string;
  externalOrderRef: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl?.startsWith("https://")) {
    throw new PravaApiError("NEXT_PUBLIC_APP_URL must be a public HTTPS URL for Prava callbacks.", 503, "CALLBACK_NOT_CONFIGURED");
  }
  const merchantUrl = process.env.REVERSECART_MERCHANT_URL;
  if (!merchantUrl?.startsWith("https://")) {
    throw new PravaApiError("REVERSECART_MERCHANT_URL must be an HTTPS merchant URL.", 503, "MERCHANT_NOT_CONFIGURED");
  }

  return request<PravaSession>("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: process.env.REVERSECART_DEMO_USER_ID || "reversecart_demo_buyer",
      user_email: process.env.REVERSECART_DEMO_USER_EMAIL || "buyer@example.com",
      total_amount: (input.amountMinor / 100).toFixed(2),
      currency: "INR",
      purchase_context: [{
        merchant_details: {
          name: input.merchant,
          url: merchantUrl,
          country_code_iso2: "IN",
          category_code: "7011",
          category: "Hotels and lodging",
        },
        product_details: [{
          description: input.itemDescription || "Hotel reservation",
          unit_price: (input.amountMinor / 100).toFixed(2),
          quantity: 1,
          product_id: "luma-one-night",
        }],
      }],
      effective_until_minutes: 15,
      integration_type: "full_checkout",
      callback_url: `${appUrl}/payment/return`,
      external_order_ref: input.externalOrderRef,
      description: "ReverseCart winning hotel offer",
    }),
  });
}

export function getPravaPaymentResult(sessionId: string) {
  return request<PravaPaymentResult>(`/v1/sessions/${encodeURIComponent(sessionId)}/payment-result`);
}

export function reportPravaStatus(input: {
  sessionId: string;
  transactionReference: string;
  approved: boolean;
  authorizationCode?: string;
  responseCode?: string;
  amountPaid?: string;
}) {
  return request<{ status: "confirmed"; txn_ref_id: string; txn_status: "APPROVED" | "DECLINED"; visa_confirmation: string }>(
    `/v1/sessions/${encodeURIComponent(input.sessionId)}/report-status`,
    {
      method: "POST",
      body: JSON.stringify({
        txn_ref_id: input.transactionReference,
        txn_status: input.approved ? "APPROVED" : "DECLINED",
        txn_type: "PURCHASE",
        authorization_code: input.authorizationCode,
        response_code: input.responseCode,
        amount_paid: input.amountPaid,
        product_statuses: [{ product_id: "luma-one-night", status: input.approved ? "COMPLETED" : "FAILED", amount_paid: input.amountPaid }],
      }),
    },
  );
}

export async function executeMerchantCheckout(lineItem: PravaLineItem) {
  const checkoutUrl = process.env.REVERSECART_MERCHANT_CHECKOUT_URL;
  if (!checkoutUrl) return { status: "configuration_required" as const };
  if (!lineItem.token || !lineItem.dynamic_cvv || !lineItem.expiry_month || !lineItem.expiry_year) {
    return { status: "credentials_not_ready" as const };
  }

  // Sensitive scoped credentials are forwarded directly and never stored or logged.
  const response = await fetch(checkoutUrl, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REVERSECART_MERCHANT_CHECKOUT_KEY || ""}` },
    body: JSON.stringify({
      amount: lineItem.total_amount,
      currency: "INR",
      card: { number: lineItem.token, cvv: lineItem.dynamic_cvv, expMonth: lineItem.expiry_month, expYear: lineItem.expiry_year },
      description: "ReverseCart hotel reservation",
    }),
  });
  const result = (await response.json()) as { approved?: boolean; authorizationCode?: string; responseCode?: string; transactionId?: string };
  return { status: result.approved ? "approved" as const : "declined" as const, ...result };
}

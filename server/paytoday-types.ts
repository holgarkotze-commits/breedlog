// Private server types. Never serialize PaymentOrder/state to an HTTP response.
export type AnnualOffer = Readonly<{
  product: "breedlog_premium_annual";
  provider: "paytoday";
  amountMinor: number;
  currency: string;
  version: string;
  merchant: string;
  environment: "sandbox" | "production";
  contractVersion: string;
}>;

export type PaymentOrder = {
  id: string;
  workspace: string;
  offer: AnnualOffer;
  createdAt: string;
  expiresAt: string;
  state: {
    status: "creating" | "pending" | "paid" | "rejected" | "expired" | "revoked";
    intentCipher?: string;
    paymentHash?: string;
    periodStart?: string;
    periodEnd?: string;
  };
};

export interface PaymentTransaction {
  getOrder(id: string): Promise<PaymentOrder | undefined>;
  insertOrder(order: PaymentOrder): Promise<void>;
  updateOrderState(id: string, state: PaymentOrder["state"]): Promise<void>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

export type PaymentTransact = <T>(
  workspace: string, run: (tx: PaymentTransaction) => Promise<T>,
) => Promise<T>;

export class PaymentUnavailable extends Error {
  readonly status = 503;
  constructor() { super("Annual payments are unavailable pending verified provider and merchant approval."); }
}

export class PaymentRejected extends Error {
  readonly status = 409;
  constructor() { super("Payment could not be verified for this workspace and order."); }
}

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
    bindingVersion?: "transaction-v1";
    finalizedAt?: string;
    periodStart?: string;
    periodEnd?: string;
    // Set only with verified proof a failed/cancelled intent is no longer payable.
    // Rejected/expired/creating alone may still represent an unknown outcome.
    checkoutResolved?: true;
  };
};

export interface PaymentTransaction {
  bindProviderTransaction(hash: string, binding: ProviderTransactionBinding): Promise<void>;
  getOrder(id: string): Promise<PaymentOrder | undefined>;
  insertOrder(order: PaymentOrder): Promise<void>;
  updateOrderState(id: string, state: PaymentOrder["state"]): Promise<void>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

// Shared provider-wide uniqueness boundary: never include product, workspace or
// intent token in the reference hash. No raw financial reference is persisted.
export type ProviderTransactionBinding = {
  provider: "paytoday";
  orderId: string;
  product: string;
  workspace: string;
  finalizedAt: string;
};

export type PaymentTransact = <T>(
  workspace: string, run: (tx: PaymentTransaction) => Promise<T>,
) => Promise<T>;

export class PaymentUnavailable extends Error {
  readonly status = 503;
  constructor() { super("Annual payments are not available yet. You can keep using the Free plan."); }
}

export class PaymentRejected extends Error {
  readonly status = 409;
  constructor() { super("Payment could not be verified for this workspace and order."); }
}

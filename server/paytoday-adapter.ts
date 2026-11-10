import { PaymentRejected, PaymentUnavailable } from "./paytoday-types";
import type { AnnualOffer } from "./paytoday-types";

// Reused from Digital-Landing-Page/app.py, blob
// 497b6919764a875afec4f62ecfebd270d0eeaf37. These are OBSERVED transport
// shapes, not evidence of JWT signing, merchant identity, currency or settlement.
export const PAYTODAY_HOSTS = {
  production: "https://admin.today.com.na",
  sandbox: "https://admin.today-ww.net",
} as const;

type Purpose = "configuration" | "create" | "lookup";
type Json = Record<string, any>;

export interface VerifiedPayTodayContract {
  evidenceRef: string;
  version: string;
  // Must verify signature, algorithm, issuer/audience, expiry and environment
  // using independently provider-confirmed rules BEFORE returning any claims.
  verifyJwt(token: string, purpose: Purpose, host: string): Promise<Json>;
  // Extract from verified claims only, under a provider-confirmed mapping.
  // No inferred/default currency or merchant, and no FMD credential fallback.
  context(claims: Json): { merchant: string; currency: string } | undefined;
  // FMD's integer amount convention is NOT independently verified. Mapping
  // and exact minor-unit conversion must be established in the approved contract.
  amountToProvider(minor: number): string | number;
  amountFromProvider(amount: unknown): number | undefined;
  allowedPaymentOrigins: readonly string[];
}

export type Contact = { firstName: string; lastName: string; email: string; phone: string };
export interface PayTodayProvider {
  create(invoice: string, offer: AnnualOffer, contact: Contact, returnUrl: string): Promise<{ url: string; token: string }>;
  lookup(token: string): Promise<{ status: string; invoice: string; amountMinor?: number; merchant?: string; currency?: string; paymentToken?: string }>;
}

export class PayTodayAdapter implements PayTodayProvider {
  constructor(
    private environment: keyof typeof PAYTODAY_HOSTS,
    private credentials: { handle: string; key: string },
    private contract: VerifiedPayTodayContract,
    private network: typeof fetch = fetch,
  ) {
    if (!contract.evidenceRef || !contract.version || !credentials.handle || !credentials.key) throw new PaymentUnavailable();
  }

  private async request(path: string, purpose: Purpose, body?: Json, bearer?: string): Promise<Json> {
    try {
      const response = await this.network(PAYTODAY_HOSTS[this.environment] + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new PaymentRejected();
      const envelope = await response.json();
      if (typeof envelope.token !== "string" || envelope.token.length > 32768) throw new PaymentRejected();
      return await this.contract.verifyJwt(envelope.token, purpose, PAYTODAY_HOSTS[this.environment]);
    } catch {
      // Never expose fetch URLs, provider response bodies, JWTs or credentials.
      throw new PaymentRejected();
    }
  }

  private async authorize(): Promise<string> {
    const claims = await this.request("/web/configuration/intent/", "configuration",
      { v: "12.12.2024", handle: this.credentials.handle, key: this.credentials.key });
    const access = claims.data?.authorization?.access_token;
    if (claims.data?.status !== "success" || typeof access !== "string" || !access) throw new PaymentRejected();
    return access;
  }

  async create(invoice: string, offer: AnnualOffer, contact: Contact, returnUrl: string) {
    if (offer.environment !== this.environment || offer.merchant !== this.credentials.handle ||
        offer.contractVersion !== this.contract.version || !invoice.startsWith("BREEDLOG-")) throw new PaymentRejected();
    const bearer = await this.authorize();
    const claims = await this.request("/web/create/payment/intent/", "create", {
      handle: this.credentials.handle, amount: this.contract.amountToProvider(offer.amountMinor),
      invoice_number: invoice, user_first_name: contact.firstName, user_last_name: contact.lastName,
      user_email: contact.email, user_phone_number: contact.phone, return_url: returnUrl,
    }, bearer);
    const url = claims.data?.payment_url;
    const token = claims.data?.payment_intent_token;
    if (typeof url !== "string" || typeof token !== "string" || !token || token.length > 4096) throw new PaymentRejected();
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new PaymentRejected(); }
    // Query strings could contain provider credentials; until their contract is
    // verified we return only approved, credential-free hosted payment URLs.
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash ||
        !this.contract.allowedPaymentOrigins.includes(parsed.origin) || url.includes(token) || url.includes(bearer)) throw new PaymentRejected();
    return { url, token };
  }

  async lookup(token: string) {
    const bearer = await this.authorize();
    const claims = await this.request(`/web/payment/lookup/${encodeURIComponent(token)}/`, "lookup", undefined, bearer);
    const intent = claims.intent ?? claims.data?.intent;
    if (!intent || typeof intent !== "object") throw new PaymentRejected();
    const context = this.contract.context(claims);
    return {
      status: intent.transaction_status,
      invoice: intent.invoice_number,
      amountMinor: this.contract.amountFromProvider(intent.amount),
      merchant: context?.merchant, currency: context?.currency,
      paymentToken: intent.payment_token,
    };
  }
}

// Deliberately no unsigned JWT decoder, no guessed merchant/currency fields,
// no PAYTODAY_PRIVATE_KEY signing assumption, and no installed live contract.
export function installedPayTodayContract(): VerifiedPayTodayContract | undefined {
  return undefined;
}

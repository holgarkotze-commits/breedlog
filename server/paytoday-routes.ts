import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { getUserId } from "./device-auth";
import type { AnnualPayToday } from "./paytoday-annual";
import { PaymentRejected, PaymentUnavailable } from "./paytoday-types";

const orderSchema = z.string().regex(/^BREEDLOG-[A-F0-9]{32}$/);
const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().min(3).max(40),
}).strict();

export function requireAnnualService(service?: AnnualPayToday): AnnualPayToday {
  if (!service) throw new PaymentUnavailable();
  return service;
}

export async function createAnnualCheckout(service: AnnualPayToday | undefined, workspace: string, body: unknown) {
  const active = requireAnnualService(service); // fail closed before parsing/storing PII
  const input = z.object({
    provider: z.literal("paytoday"), productCode: z.literal("premium_annual"),
    contact: contactSchema,
  }).strict().parse(body);
  return active.create(workspace, input.contact);
}

export function registerPayTodayReturns(app: Express, auth: RequestHandler, service?: AnnualPayToday) {
  const handle: RequestHandler = async (req, res) => {
    try {
      const active = requireAnnualService(service);
      const workspace = getUserId(req);
      if (!workspace) throw new PaymentRejected();
      const id = orderSchema.parse(req.method === "GET" ? req.query.order : req.body?.order);
      // Ignore ALL browser status/amount/token hints. Only the stored intent is
      // looked up server-side. Responses never contain tokens, claims or PII.
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.json(await active.reconcile(workspace, id));
    } catch (err) {
      const status = err instanceof PaymentUnavailable ? 503 : 409;
      res.status(status).json({ code: status === 503 ? "PAYMENTS_UNAVAILABLE" : "PAYMENT_NOT_VERIFIED",
        message: status === 503 ? new PaymentUnavailable().message : new PaymentRejected().message });
    }
  };
  app.get("/api/billing/paytoday/return", auth, handle);
  app.post("/api/billing/paytoday/reconcile", auth, handle);
}

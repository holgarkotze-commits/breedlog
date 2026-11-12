import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BILLING_CURRENCIES, type localizedPricing } from "@shared/commercial";
import { Button } from "@/components/ui/button";

type Pricing = ReturnType<typeof localizedPricing>;
export function PlanPricing({ graceUntil, status }: { graceUntil?: string; status?: string }) {
  const [currency, setCurrency] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const locale = navigator.language;
  const { data, isError } = useQuery<{ pricing: Pricing }>({
    queryKey: ["/api/billing/catalog", locale, currency, billingCountry],
    queryFn: async () => {
      const params = new URLSearchParams({ locale });
      if (currency) params.set("currency", currency);
      if (billingCountry) params.set("billingCountry", billingCountry);
      return (await apiRequest("GET", `/api/billing/catalog?${params}`)).json();
    },
  });
  const price = data?.pricing;
  const money = (minor: number) => new Intl.NumberFormat(locale, { style: "currency", currency: price!.currency }).format(minor / 100);
  return <section className="space-y-3 text-sm" aria-label="Free and Premium pricing">
    <h5 className="font-semibold">One Premium plan · monthly or annual</h5>
    <div className="flex flex-wrap gap-3">
      <label>Billing country <select aria-label="Billing country" className="ml-2 rounded border bg-background p-2" value={billingCountry} onChange={e => setBillingCountry(e.target.value)}>
        <option value="">Use my locale / region</option><option value="NA">Namibia</option><option value="ZA">South Africa</option>
        <option value="US">United States</option><option value="GB">United Kingdom</option><option value="DE">Euro area</option>
      </select></label>
      <label>Display currency <select aria-label="Display currency" className="ml-2 rounded border bg-background p-2" value={currency} onChange={e => setCurrency(e.target.value)}>
        <option value="">Automatic</option>{BILLING_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select></label>
    </div>
    {price?.priceApproved && price.monthlyMinor !== null && price.annualMinor !== null ? <div className="space-y-2" data-testid="approved-premium-prices">
      <p>Free: {money(0)}. Premium: <strong>{money(price.monthlyMinor)}/month</strong> or <strong>{money(price.annualMinor)}/year</strong>.</p>
      <p>Annual saves {money(price.savingsMinor!)} ({price.annualSavingsPercent}%) against twelve monthly payments.</p>
      <p>Final checkout currency: <strong>{price.currency}</strong>. Unlimited active animals; up to 3 devices. AI, exports and backup quotas still apply.</p>
    </div> : <p>{isError ? "Pricing could not be loaded. Checkout is unavailable." : price ? `${price.currency} prices are awaiting approval. No chargeable quote or automatic FX conversion is available.` : "Loading prices…"}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled>Monthly payment unavailable</Button><Button disabled variant="outline">Annual payment unavailable</Button></div>
    <p className="text-muted-foreground">Checkout is not enabled. Monthly payments require an explicit customer-initiated invoice; automatic debits are not available.</p>
    {graceUntil && <p role="status" className="rounded border border-border p-3">{status === "grace_period" ? "Renewal payment is due. Premium remains active until" : "The payment grace period ended at"} <time dateTime={graceUntil}>{new Date(graceUntil).toISOString()} (UTC)</time>. {status === "grace_period" ? "Use the existing payment invoice to retry once checkout is available." : "Your preserved records return on verified payment."}</p>}
    <p className="text-muted-foreground">Unpaid monthly renewal has 72 hours of Premium grace from its scheduled due time. At expiry, Free shows the first 30 originally registered animals. All other records remain preserved and return on verified payment. Cancellation ends at the paid term; annual payments do not auto-renew.</p>
  </section>;
}

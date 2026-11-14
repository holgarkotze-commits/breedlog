import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { effectivePaidAccess } from "@shared/commercial";

type NoticeEntitlement = {
  planId: "free" | "premium"; status: string; paidUntil?: string;
  billingPeriod?: string; cancelAtPeriodEnd?: boolean; graceUntil?: string;
};
export function PaymentGraceNotice({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data } = useQuery<{ entitlement: NoticeEntitlement }>({
    queryKey: ["/api/entitlements/me"], enabled: isAuthenticated, staleTime: 15_000, refetchInterval: 30_000,
    queryFn: async () => (await apiRequest("GET", "/api/entitlements/me")).json(),
  });
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!data?.entitlement.paidUntil) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data?.entitlement.paidUntil]);
  if (!isAuthenticated || !data) return null;
  // Display timing only: all reads/writes still authorize against server UTC.
  const state = effectivePaidAccess(data.entitlement, new Date(clock));
  if (!state.graceUntil) return null;
  const active = state.planId === "premium" && state.status === "grace_period";
  return <aside role="status" className="mb-4 space-y-1 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" aria-label="Payment renewal notice">
    <p className="font-semibold">{active ? "Renewal payment is due — Premium remains active during grace." : "Your payment grace period ended. Your farm is now on Free."}</p>
    <p>{active ? "Grace ends" : "Grace ended"}: <time dateTime={state.graceUntil}>{new Date(state.graceUntil).toISOString()} (UTC)</time>.</p>
    <p>All records are preserved. {active ? "After the deadline, Free shows only the first 30 originally registered animals." : "Free shows only the first 30 originally registered animals."} Verified payment restores access.</p>
    <Link href="/settings" className="font-semibold underline">Review payment status and the existing invoice</Link>
  </aside>;
}

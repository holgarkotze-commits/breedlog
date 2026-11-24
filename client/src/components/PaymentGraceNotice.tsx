import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { paidTermTime } from "@shared/commercial";
import { fetchExportEntitlement } from "@/lib/export-access";

type NoticeEntitlement = {
  planId: "free" | "premium"; status: string; graceUntil?: string;
};
export function PaymentGraceNotice({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data } = useQuery<{ entitlement: NoticeEntitlement }>({
    queryKey: ["/api/entitlements/me"], enabled: isAuthenticated, staleTime: 15_000, refetchInterval: 30_000,
    queryFn: fetchExportEntitlement,
  });
  if (!isAuthenticated || !data) return null;
  // Only a server projection may authorize status or the deadline. The browser
  // must not invent grace (or Free) from its own clock or an expired paidUntil.
  const state = data.entitlement;
  if (!state.graceUntil || !Number.isFinite(paidTermTime(state.graceUntil))) return null;
  if (!((state.planId === "premium" && state.status === "grace_period") ||
      (state.planId === "free" && state.status === "expired"))) return null;
  const active = state.planId === "premium" && state.status === "grace_period";
  return <aside role="status" className="mb-4 space-y-1 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm" aria-label="Payment renewal notice">
    <p className="font-semibold">{active ? "Verified monthly renewal failed — Premium remains active during authorized grace." : "Your payment grace period ended. Your farm is now on Free."}</p>
    <p>{active ? "Grace ends" : "Grace ended"}: <time dateTime={state.graceUntil}>{new Date(state.graceUntil).toISOString()} (UTC)</time>.</p>
    <p>All records are preserved. {active ? "After the deadline, Free shows the oldest 30 active animals and inactive history." : "Free shows the oldest 30 active animals and inactive history."} Verified payment restores access.</p>
    <Link href="/settings" className="font-semibold underline">Review payment status and the existing invoice</Link>
  </aside>;
}

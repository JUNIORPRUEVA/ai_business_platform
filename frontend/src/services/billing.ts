export type BillingPlan = {
  id: string;
  name: string;
  price: string;
  maxUsers: number;
  maxBots: number;
  maxChannels: number;
};

export type BillingSubscription = {
  id: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  paypalSubscriptionId: string | null;
  startDate: string;
  renewDate: string;
};

export type BillingSummary = {
  plan: BillingPlan;
  subscription: BillingSubscription;
};

import { jsonFetch } from "@/services/app-error";

export function getBillingSummary(): Promise<BillingSummary> {
  return jsonFetch<BillingSummary>("/api/billing/me");
}

export function createSubscription(): Promise<{ approvalUrl: string; paypalSubscriptionId: string }> {
  return jsonFetch("/api/billing/create-subscription", { method: "POST" });
}

export function cancelSubscription(): Promise<{ cancelled: true }> {
  return jsonFetch("/api/billing/cancel-subscription", { method: "POST" });
}

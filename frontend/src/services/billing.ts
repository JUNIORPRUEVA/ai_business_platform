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

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "Request failed";
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message ?? parsed?.error ?? message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function getBillingSummary(): Promise<BillingSummary> {
  return jsonFetch<BillingSummary>("/api/billing/me");
}

export function createSubscription(): Promise<{ approvalUrl: string; paypalSubscriptionId: string }> {
  return jsonFetch("/api/billing/create-subscription", { method: "POST" });
}

export function cancelSubscription(): Promise<{ cancelled: true }> {
  return jsonFetch("/api/billing/cancel-subscription", { method: "POST" });
}

export type Plan = "starter" | "pro";

export const FEATURE_KEYS = [
  "commissions",
  "financial_reports",
  "online_booking",
  "whatsapp_reminders",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureSet = Record<FeatureKey, boolean>;

export const WHATSAPP_MONTHLY_QUOTA_PRO = 100;

const PLAN_DEFAULTS: Record<Plan, FeatureSet> = {
  starter: { commissions: false, financial_reports: false, online_booking: false, whatsapp_reminders: false },
  pro: { commissions: true, financial_reports: true, online_booking: true, whatsapp_reminders: true },
};

/** Plan defaults, overridden by explicit boolean flags stored on the tenant. Unknown keys are ignored. */
export function resolveFeatures(plan: Plan, overrides: Record<string, unknown> = {}): FeatureSet {
  const result = { ...PLAN_DEFAULTS[plan] };
  for (const key of FEATURE_KEYS) {
    const override = overrides[key];
    if (typeof override === "boolean") result[key] = override;
  }
  return result;
}

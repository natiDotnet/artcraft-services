import { useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  GemIcon,
  MailIcon,
  StarIcon,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Button } from "@storyteller/ui-button";
import { SubscriptionPlanDetails } from "@storyteller/subscription";
import { PROMO_PCT, planPricing } from "./promo-discounts";
import "./website-pricing-table.css";

type BillingCadence = "yearly" | "monthly";

const PLAN_META: Record<
  string,
  {
    tagline: string;
    badge?: string;
    isPopular?: boolean;
    isBestValue?: boolean;
  }
> = {
  artcraft_basic: {
    tagline: "For individuals & getting started",
  },
  artcraft_pro: {
    tagline: "For creators & heavy workflows",
    badge: "Most Popular",
    isPopular: true,
  },
  artcraft_max: {
    tagline: "For studios & power users",
    badge: "Best Value",
    isBestValue: true,
  },
};

const CONTACT_EMAIL = "hello@storyteller.ai";
const ENTERPRISE_FEATURES = [
  "Bespoke credit allocation",
  "Secure dedicated models",
  "Support SLAs & priority queue",
  "Custom API integrations",
  "Commercial license & ownership",
];
const TRUST_POINTS = [
  "Cancel anytime",
  "Telebirr, CBE Birr & cards via Chapa",
  "Credits refunded if a generation fails",
  "Commercial ownership on all outputs",
];

interface WebsitePricingTableProps {
  plans: SubscriptionPlanDetails[];
  cadence: BillingCadence;
  onCadenceChange: (cadence: BillingCadence) => void;
  showSeedanceFeatures: boolean;
  showEnterprise: boolean;
  activePlanSlug: string | null;
  displayName?: string;
  loading: boolean;
  processingPlan: string | null;
  managing: boolean;
  onChoose: (slug: string) => void;
  onManage: () => void;
}

export function WebsitePricingTable({
  plans,
  cadence,
  onCadenceChange: setCadence,
  showSeedanceFeatures,
  showEnterprise,
  activePlanSlug,
  displayName,
  loading,
  processingPlan,
  managing,
  onChoose,
  onManage,
}: WebsitePricingTableProps) {
  const hasActivePlan = !!activePlanSlug && activePlanSlug !== "free";

  return (
    <div className="w-full">
      {/* Billing Switcher Header */}
      <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/5 p-1.5 border border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setCadence("yearly")}
            className={twMerge(
              "px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              cadence === "yearly"
                ? "bg-primary text-white shadow-sm"
                : "text-black/60 dark:text-white/60 hover:text-base-fg dark:hover:text-white",
            )}
          >
            Yearly <span className="ml-1 opacity-90 font-normal">· Save 20%</span>
          </button>
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            className={twMerge(
              "px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all",
              cadence === "monthly"
                ? "bg-white text-black shadow-sm dark:bg-white/20 dark:text-white"
                : "text-black/60 dark:text-white/60 hover:text-base-fg dark:hover:text-white",
            )}
          >
            Monthly
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-black/60 dark:text-white/60 font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
            {PROMO_PCT}% OFF
          </span>
          <span>
            {cadence === "yearly"
              ? "2 months free included with annual billing"
              : "Switch to annual billing to save 20%"}
          </span>
          {displayName && (
            <span className="hidden sm:inline opacity-60">
              · Signed in as {displayName}
            </span>
          )}
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-stretch">
          {plans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              cadence={cadence}
              showSeedanceFeatures={showSeedanceFeatures}
              isCurrent={plan.slug === activePlanSlug}
              hasActivePlan={hasActivePlan}
              disabled={loading || processingPlan !== null}
              processing={processingPlan === plan.slug}
              onChoose={() => onChoose(plan.slug)}
            />
          ))}

          {showEnterprise && <EnterpriseCard />}
        </div>

        {/* Trust Badges & Portal */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-black/10 dark:border-white/10">
          <ul className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-black/60 dark:text-white/60">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {hasActivePlan && (
            <button
              type="button"
              onClick={onManage}
              disabled={managing}
              className="text-xs font-semibold text-primary hover:underline underline-offset-4 disabled:opacity-50"
            >
              {managing ? "Opening portal…" : "Manage subscription →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  cadence,
  showSeedanceFeatures,
  isCurrent,
  hasActivePlan,
  disabled,
  processing,
  onChoose,
}: {
  plan: SubscriptionPlanDetails;
  cadence: BillingCadence;
  showSeedanceFeatures: boolean;
  isCurrent: boolean;
  hasActivePlan: boolean;
  disabled: boolean;
  processing: boolean;
  onChoose: () => void;
}) {
  const { current, basePrice } = planPricing(plan, cadence === "yearly");
  const yearlySavings =
    (plan.originalMonthlyPrice ?? plan.monthlyPrice) * 12 - plan.yearlyPrice;
  const meta = PLAN_META[plan.slug] || { tagline: "AI creative suite" };
  const isPopular = meta.isPopular;
  const isBestValue = meta.isBestValue;

  const features = plan.features.filter(
    (f) => !f.seedanceOnly || showSeedanceFeatures,
  );

  const ctaLabel = isCurrent
    ? "Current plan"
    : hasActivePlan
      ? `Switch to ${plan.name}`
      : `Get ${plan.name}`;

  return (
    <div
      className={twMerge(
        "relative flex flex-col justify-between rounded-2xl p-7 transition-all duration-200",
        "bg-white dark:bg-[#121317] border shadow-sm",
        isPopular
          ? "border-2 border-primary shadow-xl shadow-primary/10 ring-4 ring-primary/10 dark:bg-[#14161f]"
          : "border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 hover:shadow-md",
      )}
    >
      {/* Popular Badge Floating on Top */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-md">
          <StarIcon className="h-3 w-3 fill-white" />
          Most Popular
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-2xl font-bold tracking-tight text-base-fg dark:text-white">
            {plan.name}
          </h3>
          {isBestValue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <GemIcon className="h-3 w-3" />
              Best Value
            </span>
          )}
          {isCurrent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="h-3 w-3" />
              Active
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-black/60 dark:text-white/60 min-h-[2.5rem]">
          {meta.tagline}
        </p>

        {/* Pricing */}
        <div className="mt-5 pb-5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold tracking-tight text-base-fg dark:text-white">
              {current.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-black/50 dark:text-white/50">
              ETB / mo
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-xs">
            {cadence === "yearly" ? (
              <>
                <span className="line-through text-black/40 dark:text-white/40">
                  {basePrice.toLocaleString()} ETB
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Save {yearlySavings.toLocaleString()} ETB/yr
                </span>
              </>
            ) : (
              <span className="text-black/50 dark:text-white/50">
                Billed monthly · Cancel anytime
              </span>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <Button
          type="button"
          onClick={onChoose}
          disabled={disabled || isCurrent}
          loading={processing}
          className={twMerge(
            "mt-6 w-full h-11 rounded-xl text-sm font-semibold tracking-wide transition-all shadow-sm",
            isPopular
              ? "bg-primary hover:bg-primary/90 text-white border-transparent"
              : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-base-fg dark:text-white border border-black/10 dark:border-white/15",
            isCurrent && "opacity-60 cursor-default",
          )}
        >
          {ctaLabel}
          {!isCurrent && <ArrowRightIcon className="h-4 w-4 ml-1" />}
        </Button>

        {/* Feature List */}
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-3.5">
            What's included
          </p>
          <ul className="space-y-3">
            {features.map((feature, idx) => (
              <li
                key={feature.text}
                className="flex items-start gap-2.5 text-sm"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckIcon className="h-3 w-3 stroke-[2.5]" />
                </span>
                <span
                  className={twMerge(
                    idx === 0
                      ? "font-semibold text-base-fg dark:text-white"
                      : "text-black/70 dark:text-white/70",
                  )}
                >
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EnterpriseCard() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative flex flex-col justify-between rounded-2xl p-7 transition-all duration-200 bg-white dark:bg-[#121317] border border-black/10 dark:border-white/10 shadow-sm hover:border-black/25 dark:hover:border-white/25 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-2xl font-bold tracking-tight text-base-fg dark:text-white">
            Enterprise
          </h3>
          <span className="inline-flex rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            For Teams
          </span>
        </div>

        <p className="mt-1 text-sm text-black/60 dark:text-white/60 min-h-[2.5rem]">
          Bespoke volume, security & dedicated infrastructure
        </p>

        {/* Pricing */}
        <div className="mt-5 pb-5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-extrabold tracking-tight text-base-fg dark:text-white">
              Custom
            </span>
          </div>
          <div className="mt-1.5 text-xs text-black/50 dark:text-white/50">
            Tailored pricing & payment terms
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex gap-2">
          <Button
            as="link"
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex-1 h-11 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-base-fg dark:text-white border border-black/10 dark:border-white/15 text-sm font-semibold tracking-wide transition-all shadow-sm justify-center"
          >
            <MailIcon className="h-4 w-4 mr-1.5" />
            Contact us
          </Button>
          <Button
            type="button"
            onClick={copy}
            aria-label={copied ? "Email copied" : "Copy email address"}
            className="h-11 w-11 p-0 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-base-fg dark:text-white border border-black/10 dark:border-white/15 transition-all shadow-sm flex items-center justify-center shrink-0"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-emerald-500" />
            ) : (
              <CopyIcon className="h-4 w-4 text-black/60 dark:text-white/60" />
            )}
          </Button>
        </div>

        {/* Feature List */}
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-3.5">
            Everything in Max, plus
          </p>
          <ul className="space-y-3">
            {ENTERPRISE_FEATURES.map((text, idx) => (
              <li key={text} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <CheckIcon className="h-3 w-3 stroke-[2.5]" />
                </span>
                <span
                  className={twMerge(
                    idx === 0
                      ? "font-semibold text-base-fg dark:text-white"
                      : "text-black/70 dark:text-white/70",
                  )}
                >
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { Modal } from "@storyteller/ui-modal";
import { ArrowRightIcon, CoinsIcon, LoaderCircleIcon } from "lucide-react";
import { BillingApi } from "@storyteller/api";
import { toast } from "./toast/toast";

export interface EtbCreditPack {
  id: string;
  credits: number;
  priceEtb: number;
  bonus?: number;
  badge?: string;
}

// 1 ETB = 1 Credit. Larger packs include bonus credits. Mirrors the backend
// ETB pack config in
// crates/service/plugins/billing_artcraft/src/configs/credits_packs/.
export const ETB_CREDIT_PACKS: EtbCreditPack[] = [
  { id: "etb_100", credits: 100, priceEtb: 100 },
  { id: "etb_300", credits: 320, priceEtb: 300, bonus: 20 },
  { id: "etb_500", credits: 560, priceEtb: 500, bonus: 60, badge: "Popular" },
  {
    id: "etb_1000",
    credits: 1200,
    priceEtb: 1000,
    bonus: 200,
    badge: "Best Value",
  },
];

export function calculateCreditsForEtb(amountEtb: number): {
  credits: number;
  bonus: number;
  bonusPct: number;
} {
  const safe = Math.max(0, Math.floor(amountEtb));
  let bonus = 0;
  let bonusPct = 0;
  if (safe >= 1000) {
    bonus = Math.floor(safe / 5);
    bonusPct = 20;
  } else if (safe >= 500) {
    bonus = Math.floor((safe * 3) / 25);
    bonusPct = 12;
  } else if (safe >= 300) {
    bonus = Math.floor(safe / 15);
    bonusPct = 7;
  }
  return {
    credits: safe + bonus,
    bonus,
    bonusPct,
  };
}

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
}

export function CreditsModal({
  isOpen,
  onClose,
  initialAmount,
}: CreditsModalProps) {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [customAmountInput, setCustomAmountInput] = useState<string>(
    initialAmount && initialAmount >= 50 ? String(initialAmount) : "500",
  );

  useEffect(() => {
    if (isOpen && initialAmount && initialAmount >= 50) {
      setCustomAmountInput(String(initialAmount));
    }
  }, [isOpen, initialAmount]);

  const parsed = parseInt(customAmountInput.replace(/[^0-9]/g, ""), 10);
  const customAmount = Number.isFinite(parsed) ? parsed : 0;
  const isValidCustom = customAmount >= 50;
  const customCalc = calculateCreditsForEtb(customAmount);

  const handlePurchase = async (pack: EtbCreditPack) => {
    setPurchasingId(pack.id);
    try {
      const api = new BillingApi();
      const response = await api.ChapaCheckout({ creditsPackId: pack.id });

      if (response.success && response.data?.chapaCheckoutUrl) {
        window.location.href = response.data.chapaCheckoutUrl;
      } else {
        toast.error(response.errorMessage ?? "Failed to start checkout");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-2xl max-h-[100vh] overflow-y-auto overflow-x-hidden border border-white/15 bg-ui-modal p-0"
      allowBackgroundInteraction={false}
      showClose={true}
      closeOnOutsideClick={true}
      resizable={false}
      childPadding={false}
      backdropClassName="bg-black/80"
    >
      <div className="relative overflow-hidden">
        <div className="relative px-8 pt-10 pb-8 sm:px-10 sm:pt-11 sm:pb-9">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:leading-[1.1]">
            Buy <span className="text-primary">credits</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/55">
            1 ETB = 1 Credit • Telebirr, CBE Birr &amp; Cards supported.
          </p>

          {/* Custom Amount Entry Card */}
          <div className="mt-7 rounded-2xl border border-white/20 bg-white/[0.04] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label
                  htmlFor="modal-custom-amount"
                  className="block text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Custom Amount
                </label>
                <p className="text-xs text-white/40">
                  Enter any ETB amount (minimum 50 ETB)
                </p>
              </div>

              {/* Dynamic credits preview */}
              {isValidCustom && (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-white">
                    {customCalc.credits.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/50">credits</span>
                  {customCalc.bonus > 0 && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      +{customCalc.bonus.toLocaleString()} bonus (+{customCalc.bonusPct}%)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  id="modal-custom-amount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customAmountInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, "");
                    setCustomAmountInput(cleaned);
                  }}
                  placeholder="500"
                  className="w-full rounded-xl bg-white/[0.06] border border-white/20 px-3.5 py-2.5 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary tabular-nums pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-white/50 pointer-events-none">
                  ETB
                </span>
              </div>

              <button
                type="button"
                disabled={!isValidCustom || purchasingId !== null}
                onClick={() =>
                  handlePurchase({
                    id: `etb_${customAmount}`,
                    credits: customCalc.credits,
                    priceEtb: customAmount,
                    bonus: customCalc.bonus,
                  })
                }
                className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
              >
                {purchasingId === `etb_${customAmount}` ? (
                  <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CoinsIcon className="h-4 w-4 text-amber-300" />
                    <span>
                      Pay {isValidCustom ? `${customAmount.toLocaleString()} ETB` : "custom"}
                    </span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Presets Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[11px] text-white/40 mr-1">Presets:</span>
              {[100, 300, 500, 1000, 2500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomAmountInput(String(preset))}
                  className={twMerge(
                    "px-2.5 py-1 text-xs font-medium rounded-lg border transition-all",
                    customAmount === preset
                      ? "bg-white/20 border-white/40 text-white"
                      : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  {preset.toLocaleString()} ETB
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-white/40 font-semibold">
              Or choose a featured pack
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ETB_CREDIT_PACKS.map((pack) => {
              const isLoading = purchasingId === pack.id;
              const isPopular = !!pack.badge;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handlePurchase(pack)}
                  disabled={purchasingId !== null}
                  className={twMerge(
                    "group relative flex flex-col gap-6 border p-6 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                    isPopular
                      ? "border-white/60 bg-white/[0.06] hover:border-white"
                      : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]",
                  )}
                >
                  {pack.badge && (
                    <span className="absolute -top-2.5 right-3 bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-black">
                      {pack.badge}
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-white/10">
                      <CoinsIcon className="text-white text-lg" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-4xl font-bold leading-none tracking-tight text-white">
                        {pack.credits.toLocaleString()}
                      </div>
                      <div className="mt-0 text-sm text-white/40">credits</div>
                    </div>
                  </div>

                  {pack.bonus ? (
                    <span className="-mt-4 text-xs font-medium text-primary">
                      +{pack.bonus.toLocaleString()} bonus credits included
                    </span>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-semibold text-white/80">
                      {pack.priceEtb.toLocaleString()} ETB
                    </span>
                    <span className="flex items-center gap-1.5 text-base font-semibold text-white">
                      {isLoading ? (
                        <LoaderCircleIcon className="animate-spin" />
                      ) : (
                        <>
                          Buy
                          <ArrowRightIcon className="text-xs transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-white/35">
            One-time purchase. Credit packs never expire.
          </p>
        </div>
      </div>
    </Modal>
  );
}

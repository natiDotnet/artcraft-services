import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { UsersApi } from "@storyteller/api";
import {
  getLandingUrl,
  getReferralCode,
  getReferralUsername,
  getReferrer,
} from "@storyteller/common";
import { LoaderCircleIcon, PhoneIcon, XIcon } from "lucide-react";
import { useState } from "react";

interface GoogleLoginButtonProps {
  onSuccess: (isNewUser: boolean) => void;
  onError: (error: string) => void;
  mode?: "login" | "signup";
  phoneNumber?: string;
  className?: string;
}

/** Normalize phone digits typed after +251 (or full local number) to 10-digit local format */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("251") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  if (digits.startsWith("9") && digits.length === 9) {
    return "0" + digits;
  }
  if (digits.startsWith("7") && digits.length === 9) {
    return "0" + digits;
  }
  if ((digits.startsWith("09") || digits.startsWith("07")) && digits.length === 10) {
    return digits;
  }
  return digits;
}

export function GoogleLoginButton({
  onSuccess,
  onError,
  mode = "login",
  phoneNumber,
  className = "",
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [phoneSuffix, setPhoneSuffix] = useState("");
  const [phoneModalError, setPhoneModalError] = useState<string | null>(null);
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);

  const performGoogleSso = async (
    credential: string,
    phoneToUse?: string,
  ): Promise<boolean> => {
    const api = new UsersApi();
    const result = await api.GoogleSSO({
      credential,
      phoneNumber: phoneToUse,
      maybeReferralUrl: getReferrer(),
      maybeLandingUrl: getLandingUrl(),
      maybeReferralUsername: getReferralUsername(),
      maybeReferralCode: getReferralCode(),
    });

    if (result.success) {
      setShowPhoneModal(false);
      setPendingCredential(null);
      window.dispatchEvent(new Event("auth-change"));
      onSuccess(result.data?.usernameNotYetCustomized ?? false);
      return true;
    }

    if (result.data?.phoneNumberRequired || result.errorMessage === "phone_number_required") {
      setPendingCredential(credential);
      setShowPhoneModal(true);
      setPhoneModalError(null);
      return false;
    }

    const err = result.errorMessage || "Authentication failed";
    if (showPhoneModal) {
      setPhoneModalError(err);
    } else {
      onError(err);
    }
    return false;
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    if (!credentialResponse.credential) {
      onError("No credential received from Google");
      return;
    }

    setIsLoading(true);
    try {
      const normalizedPropPhone = phoneNumber?.trim()
        ? normalizePhone(phoneNumber)
        : undefined;

      // If a valid phone was already filled in the parent form (e.g. signup page),
      // pass it directly to avoid extra modal step
      const validPropPhone =
        normalizedPropPhone &&
        normalizedPropPhone.length === 10 &&
        (normalizedPropPhone.startsWith("09") || normalizedPropPhone.startsWith("07"))
          ? normalizedPropPhone
          : undefined;

      await performGoogleSso(credentialResponse.credential, validPropPhone);
    } catch (err: any) {
      onError(err?.message || "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneModalSubmit = async () => {
    setPhoneModalError(null);
    if (!pendingCredential) {
      setPhoneModalError("Session expired. Please click Continue with Google again.");
      return;
    }

    const normalized = normalizePhone(phoneSuffix);
    if (
      normalized.length !== 10 ||
      (!normalized.startsWith("09") && !normalized.startsWith("07"))
    ) {
      setPhoneModalError("Please enter a valid 9-digit Ethiopian phone number (e.g. 911223344)");
      return;
    }

    setIsSubmittingPhone(true);
    try {
      await performGoogleSso(pendingCredential, normalized);
    } catch (err: any) {
      setPhoneModalError(err?.message || "Failed to link phone number");
    } finally {
      setIsSubmittingPhone(false);
    }
  };

  return (
    <>
      <div
        className={`group relative w-full h-10 transition-transform duration-150 active:scale-95 ${className}`}
      >
        {/* Custom visual button - shown behind */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center gap-3 rounded-lg border border-black/15 dark:border-transparent bg-white text-black font-medium shadow-sm group-hover:bg-black/5 dark:group-hover:bg-white/90 transition-colors">
          {isLoading ? (
            <LoaderCircleIcon className="animate-spin text-lg text-black/60" />
          ) : (
            <>
              <GoogleIcon />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
                Continue with Google
              </span>
            </>
          )}
        </div>

        {/* Google's actual button - invisible overlay that receives clicks */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden cursor-pointer flex items-center justify-center rounded-lg"
          style={{ opacity: 0.01, zIndex: 10, transform: "scaleY(1.2)" }}
        >
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => onError("Google login failed")}
            size="large"
            width={400}
            text="continue_with"
          />
        </div>
      </div>

      {/* Phone Number Modal - prompted when phone number is required */}
      {showPhoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-900">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowPhoneModal(false);
                setPendingCredential(null);
                setPhoneModalError(null);
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>

            {/* Icon & Title */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                <PhoneIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Phone Number Required
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Please enter your phone number to complete signing in with Google
                </p>
              </div>
            </div>

            {phoneModalError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 text-xs">
                {phoneModalError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePhoneModalSubmit();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="google-phone-suffix-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex h-11 w-full overflow-hidden rounded-lg border border-black/15 bg-black/[0.03] transition-colors focus-within:border-primary dark:border-white/15 dark:bg-white/5 dark:focus-within:border-primary">
                  <span className="flex shrink-0 select-none items-center border-r border-black/15 px-3.5 text-sm font-semibold text-black/60 dark:border-white/15 dark:text-white/60">
                    +251
                  </span>
                  <input
                    id="google-phone-suffix-input"
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    maxLength={9}
                    value={phoneSuffix}
                    onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, ""))}
                    placeholder="9XXXXXXXX"
                    className="h-full flex-1 bg-transparent px-3 text-sm font-normal text-neutral-900 outline-none placeholder:text-black/35 dark:text-white dark:placeholder:text-white/25"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  Enter 9 digits after +251 (e.g. 911223344 or 711223344)
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPhoneModal(false);
                    setPendingCredential(null);
                  }}
                  className="flex-1 rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-black/5 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPhone || phoneSuffix.replace(/\D/g, "").length < 9}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isSubmittingPhone ? (
                    <>
                      <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Complete Sign In</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

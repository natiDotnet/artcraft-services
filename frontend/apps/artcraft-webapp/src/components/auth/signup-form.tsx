import { AUTH_LABEL_CLASSES, AUTH_INPUT_CLASSES, AUTH_PASSWORD_INPUT_CLASSES } from "./auth-form-styles";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { DynamicIcon } from "@storyteller/icons";
import { Button } from "@storyteller/ui-button";
import { Input } from "@storyteller/ui-input";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UsersApi } from "@storyteller/api";
import {
  getLandingUrl,
  getReferralCode,
  getReferralUsername,
  getReferrer,
} from "@storyteller/common";
import { refreshSession } from "../../lib/session";
import { hasActiveSubscription } from "../../lib/billing";
import { GoogleLoginButton } from "./GoogleLoginButton";

interface SignupFormProps {
  onSuccess: (isNewUser?: boolean) => void;
  signupSource: string;
  className?: string;
  autoFocus?: boolean;
  /** Let the enclosing flow resume after Google, without a billing redirect. */
  continueAfterGoogleLogin?: boolean;
}

export const SignupForm = ({
  onSuccess,
  signupSource,
  className = "",
  autoFocus = false,
  continueAfterGoogleLogin = false,
}: SignupFormProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Normalize phone suffix (digits typed after the +251 prefix) to local Ethiopian format. */
  const normalizePhone = (suffix: string): string => {
    // Strip any non-digit characters the user may have typed
    const digits = suffix.replace(/\D/g, "");
    // Suffix after +251: 9XXXXXXXX (9 digits) -> local 09XXXXXXXX
    if (digits.startsWith("9") && digits.length === 9) {
      return "0" + digits;
    }
    // Already local-prefixed (user typed 09...)
    if (digits.startsWith("09") && digits.length === 10) {
      return digits;
    }
    // Fallback: return as-is stripped
    return digits;
  };

  const handleSignup = async () => {
    setError(null);

    if (!email || !phone || !password) {
      setError("All fields are required");
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 10) {
      setError("Please enter a valid 9-digit phone number after +251");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    const api = new UsersApi();

    // Use the normalized phone number as the unique username for lookup-by-phone login.
    // Max 16 chars — local Ethiopian format is 10 digits, well within limit.
    const generatedUsername = normalizedPhone;

    const response = await api.Signup({
      username: generatedUsername,
      email,
      password,
      passwordConfirmation: password,
      signupSource,
      maybeReferralUrl: getReferrer(),
      maybeLandingUrl: getLandingUrl(),
      maybeReferralUsername: getReferralUsername(),
      maybeReferralCode: getReferralCode(),
    });

    setIsLoading(false);

    if (response.success) {
      window.dispatchEvent(new Event("auth-change"));
      onSuccess();
    } else {
      setError(response.errorMessage || "Failed to create account");
    }
  };

  const handleGoogleSuccess = async () => {
    if (continueAfterGoogleLogin) {
      onSuccess();
      return;
    }
    // Refresh the session and check the subscription in parallel; users without
    // an active subscription are pushed to pricing, subscribers go home.
    const [, subscribed] = await Promise.all([
      refreshSession(true),
      hasActiveSubscription(),
    ]);
    navigate(subscribed ? "/" : "/pricing");
  };

  const handleGoogleError = (message: string) => {
    setError(message);
  };

  return (
    <div className={className}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSignup();
        }}
      >
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}
        <div
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className={AUTH_LABEL_CLASSES}>
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus={autoFocus}
              inputClassName={AUTH_INPUT_CLASSES}
            />
          </div>

          <div className="space-y-2">
            <label className={AUTH_LABEL_CLASSES} htmlFor="phone-suffix-input">
              Phone Number <span className="text-red-500">*</span>
            </label>
            {/* Prefix-masked phone input: displays fixed +251 badge fused to the left */}
            <div
              className="flex h-10 w-full overflow-hidden rounded-lg border border-black/15 bg-black/[0.03] transition-colors focus-within:border-primary dark:border-white/15 dark:bg-white/5 dark:focus-within:border-white/40"
            >
              <span className="flex shrink-0 select-none items-center border-r border-black/15 px-3 text-sm font-medium text-black/50 dark:border-white/15 dark:text-white/50">
                +251
              </span>
              <input
                id="phone-suffix-input"
                type="tel"
                inputMode="numeric"
                maxLength={9}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9XXXXXXXX"
                className="h-full flex-1 bg-transparent px-3 text-sm font-normal text-base-fg outline-none placeholder:text-black/35 dark:text-white dark:placeholder:text-white/25"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className={AUTH_LABEL_CLASSES}>
                Password
              </label>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                inputClassName={AUTH_PASSWORD_INPUT_CLASSES}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-md text-black/40 hover:text-black/80 hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <DynamicIcon icon={showPassword ? EyeOffIcon : EyeIcon} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              className="w-full justify-center h-10 rounded-lg border border-black/20 hover:border-black/40 dark:border-transparent shadow-sm"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </div>
        </div>
      </form>

      <div>
        <div className="my-6 flex items-center gap-4 before:h-px before:flex-1 before:bg-black/15 after:h-px after:flex-1 after:bg-black/15 dark:before:bg-white/15 dark:after:bg-white/15">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
            or
          </span>
        </div>

        <div>
          <GoogleLoginButton
            mode="signup"
            phoneNumber={phone}
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
          />
        </div>
      </div>
    </div>
  );
};

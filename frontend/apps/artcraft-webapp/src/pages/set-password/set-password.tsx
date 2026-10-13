import { AUTH_LABEL_CLASSES, AUTH_PASSWORD_INPUT_CLASSES, AUTH_FORM_PADDING } from "../../components/auth/auth-form-styles";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { DynamicIcon } from "@storyteller/icons";
import { Button } from "@storyteller/ui-button";
import { Input } from "@storyteller/ui-input";
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { UsersApi } from "@storyteller/api";
import { useSession, refreshSession } from "../../lib/session";
import { AuthHeader } from "../../components/auth/auth-layout";
import { AuthPageFrame } from "../../components/auth/auth-page-frame";
import Seo from "../../components/seo";
import { toast } from "../../components/toast/toast";

const SetPassword = () => {
  const navigate = useNavigate();
  const { loggedIn, authChecked, passwordNotSet } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only meant for a signed-in user who has no password yet (the Google SSO
  // sign-up case). Wait for the session check, then send everyone else home —
  // this covers direct navigation and stops an existing user (who already has
  // a password) from being misrouted here.
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ui-background">
        <LoaderCircleIcon className="animate-spin text-4xl text-white/80" />
      </div>
    );
  }
  if (!loggedIn || !passwordNotSet) {
    return <Navigate to="/" replace />;
  }

  const handleSetPassword = async () => {
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    const api = new UsersApi();
    const response = await api.ChangePassword({
      password,
      passwordConfirmation: confirmPassword,
    });

    setIsLoading(false);

    if (response.success) {
      toast.success("Password has been set");
      await refreshSession(true);
      navigate("/welcome");
    } else {
      setError(response.errorMessage || "Failed to set password");
    }
  };

  return (
    <AuthPageFrame>
      <Seo
        title="Set Password - ArtCraft"
        description="Set a password for your ArtCraft account."
      />

      <main className={AUTH_FORM_PADDING}>
        <div className="w-full">
          <AuthHeader title={<>Set your <span className="font-serif-italic">password.</span></>} subtitle="Create a password to sign in on the web and desktop." />

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSetPassword();
            }}
          >
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className={AUTH_LABEL_CLASSES}>
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoFocus
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

            <div className="space-y-2">
              <label className={AUTH_LABEL_CLASSES}>
                Confirm password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  inputClassName={AUTH_PASSWORD_INPUT_CLASSES}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-md text-black/40 hover:text-black/80 hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  <DynamicIcon
                    icon={showConfirmPassword ? EyeOffIcon : EyeIcon}
                    className="h-4 w-4"
                  />
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
                  "Set password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </AuthPageFrame>
  );
};

export default SetPassword;

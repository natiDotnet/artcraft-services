import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BillingApi } from "@storyteller/api";
import { toast } from "../components/toast/toast";
import { invalidateSession, refreshSession, useSession } from "./session";

/**
 * Chapa (ETB) checkout return handling.
 *
 * Chapa redirects the user back to the configured
 * CHAPA_ARTCRAFT_CHECKOUT_RETURN_URL with `?tx_ref=...&status=...` appended.
 * The redirect itself does not fulfill anything: the backend verifies the
 * payment server-to-server when the frontend calls
 * POST /v1/chapa_artcraft/verify_transaction (fulfillment is idempotent on
 * the tx_ref). Mounted once at the app root so any in-app return path works.
 */
export function useChapaReturnVerify(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const { authChecked, loggedIn } = useSession();
  const inFlightRef = useRef<string | null>(null);

  const txRef = searchParams.get("tx_ref");

  useEffect(() => {
    if (!txRef) return;
    // Verification only fulfills for the authenticated user matching the
    // tx_ref, so wait for the session boot fetch. If logged out, leave the
    // params in place — a post-login return can still verify.
    if (!authChecked) return;
    if (!loggedIn) return;
    // StrictMode double-invokes effects; also guards dep-churn re-runs.
    if (inFlightRef.current === txRef) return;
    inFlightRef.current = txRef;

    new BillingApi()
      .ChapaVerifyTransaction({ txRef })
      .then((response) => {
        if (response.success && response.data?.chapaSuccess) {
          toast.success("Payment confirmed — thanks for supporting ArtCraft!");
          // Pull fresh credits/subscription state into the UI.
          invalidateSession();
          refreshSession(true);
        } else if (response.success) {
          // HTTP OK, but the payment did not settle / fulfill.
          const status = response.data?.chapaStatus ?? "unknown";
          if (status === "pending") {
            toast.error(
              "Payment is still processing. Your purchase will activate once it settles — try refreshing in a minute.",
            );
          } else {
            toast.error(
              "We could not confirm your payment. If you were charged, please contact support.",
            );
          }
        } else {
          toast.error(
            response.errorMessage ??
              "Could not verify the payment. Please refresh or contact support.",
          );
        }
      })
      .finally(() => {
        // Strip Chapa's query params so refresh/back does not re-trigger.
        const next = new URLSearchParams(searchParams);
        next.delete("tx_ref");
        next.delete("status");
        setSearchParams(next, { replace: true });
      });
  }, [txRef, authChecked, loggedIn, searchParams, setSearchParams]);
}

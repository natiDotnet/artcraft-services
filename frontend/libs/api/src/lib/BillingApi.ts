import { ApiManager, ApiResponse } from "./ApiManager.js";
import { Subscription } from "./models/Billing.js";
import { LoyaltyProgram } from "./enums/Billing.js";

export class BillingApi extends ApiManager {
  public async ListActiveSubscriptions(): Promise<
    ApiResponse<{
      active_subscriptions: Subscription[];
      maybe_loyalty_program?: LoyaltyProgram;
    }>
  > {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/billing/active_subscriptions`;
    return await this.get<{
      success: boolean;
      active_subscriptions?: Subscription[];
      maybe_loyalty_program?: LoyaltyProgram;
      error_message?: string;
    }>({ endpoint: endpoint })
      .then((response) => ({
        success: response.success,
        data: {
          active_subscriptions: response.active_subscriptions || [],
          maybe_loyalty_program: response.maybe_loyalty_program,
        },
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  public async UserSignupSubscriptionCheckout({
    plan,
    cadence,
    maybeReferralUrl,
    maybeLandingUrl,
    maybeReferralUsername,
    maybeReferralCode,
  }: {
    plan: string;
    cadence: "yearly" | "monthly";
    maybeReferralUrl?: string;
    maybeLandingUrl?: string;
    maybeReferralUsername?: string;
    maybeReferralCode?: string;
  }): Promise<ApiResponse<{ stripeCheckoutRedirectUrl: string }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/stripe_artcraft/user_signup_subscription_checkout`;

    return await this.post<
      {
        plan: string;
        cadence: string;
        maybe_referral_url?: string;
        maybe_landing_url?: string;
        maybe_referral_username?: string;
        maybe_referral_code?: string;
      },
      {
        success: boolean;
        stripe_checkout_redirect_url?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        plan,
        cadence,
        ...(maybeReferralUrl && { maybe_referral_url: maybeReferralUrl }),
        ...(maybeLandingUrl && { maybe_landing_url: maybeLandingUrl }),
        ...(maybeReferralUsername && {
          maybe_referral_username: maybeReferralUsername,
        }),
        ...(maybeReferralCode && { maybe_referral_code: maybeReferralCode }),
      },
    })
      .then((response) => ({
        success: response.success,
        data: response.stripe_checkout_redirect_url
          ? { stripeCheckoutRedirectUrl: response.stripe_checkout_redirect_url }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  public async SubscriptionCheckout({
    plan,
    cadence,
  }: {
    plan: string;
    cadence: "yearly" | "monthly";
  }): Promise<ApiResponse<{ stripeCheckoutRedirectUrl: string }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/stripe_artcraft/checkout/subscription`;

    return await this.post<
      { plan: string; cadence: string },
      {
        success: boolean;
        stripe_checkout_redirect_url?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        plan,
        cadence,
      },
    })
      .then((response) => ({
        success: response.success,
        data: response.stripe_checkout_redirect_url
          ? { stripeCheckoutRedirectUrl: response.stripe_checkout_redirect_url }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  public async SwitchPlan({
    plan,
    cadence,
  }: {
    plan: string;
    cadence: "yearly" | "monthly";
  }): Promise<ApiResponse<{ stripePortalUrl: string }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/stripe_artcraft/portal/switch_plan`;

    return await this.post<
      { plan: string; cadence: string },
      {
        success: boolean;
        stripe_portal_url?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        plan,
        cadence,
      },
    })
      .then((response) => ({
        success: response.success,
        data: response.stripe_portal_url
          ? { stripePortalUrl: response.stripe_portal_url }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  public async CreditsPackCheckout({
    creditsPack,
  }: {
    creditsPack: string;
  }): Promise<ApiResponse<{ stripeCheckoutRedirectUrl: string }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/stripe_artcraft/checkout/credits_pack`;

    return await this.post<
      { credits_pack: string },
      {
        success: boolean;
        stripe_checkout_redirect_url?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        credits_pack: creditsPack,
      },
    })
      .then((response) => ({
        success: response.success,
        data: response.stripe_checkout_redirect_url
          ? { stripeCheckoutRedirectUrl: response.stripe_checkout_redirect_url }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  public async GetPortalUrl(): Promise<
    ApiResponse<{ stripePortalUrl: string }>
  > {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/stripe_artcraft/portal/manage_plan`;

    return await this.post<
      Record<string, never>,
      {
        success: boolean;
        stripe_portal_url?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {},
    })
      .then((response) => ({
        success: response.success,
        data: response.stripe_portal_url
          ? { stripePortalUrl: response.stripe_portal_url }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }

  /**
   * Create a Chapa (ETB) checkout for either an ETB credits pack or an ETB
   * subscription period. Exactly one of `creditsPackId` / `plan` must be
   * supplied; `period` is required with `plan`. Requires a logged-in user.
   * Redirect the browser to `chapaCheckoutUrl` on success and call
   * ChapaVerifyTransaction after the user returns.
   */
  public async ChapaCheckout({
    creditsPackId,
    plan,
    period,
  }: {
    creditsPackId?: string;
    plan?: string;
    period?: "monthly" | "yearly";
  }): Promise<ApiResponse<{ chapaCheckoutUrl: string; txRef: string }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/chapa_artcraft/checkout`;

    return await this.post<
      {
        credits_pack_id?: string;
        plan?: string;
        period?: string;
      },
      {
        success: boolean;
        chapa_checkout_url?: string;
        tx_ref?: string;
        error_message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        ...(creditsPackId && { credits_pack_id: creditsPackId }),
        ...(plan && { plan: plan, period: period }),
      },
    })
      .then((response) => ({
        success: response.success,
        data: response.chapa_checkout_url
          ? {
              chapaCheckoutUrl: response.chapa_checkout_url,
              txRef: response.tx_ref ?? "",
            }
          : undefined,
        errorMessage: response.error_message,
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }
  /**
   * Ask the backend to verify a Chapa (ETB) payment server-to-server and
   * fulfill it (credits top-up or subscription period). Call this after Chapa
   * redirects the user back to the site with `?tx_ref=...&status=...` on the
   * return URL. Safe to call repeatedly: fulfillment is idempotent on the
   * `tx_ref`. Requires a logged-in user matching the `tx_ref`.
   */
  public async ChapaVerifyTransaction({
    txRef,
  }: {
    txRef: string;
  }): Promise<
    ApiResponse<{
      chapaSuccess: boolean;
      chapaStatus: string;
      message?: string;
    }>
  > {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/chapa_artcraft/verify_transaction`;

    return await this.post<
      { tx_ref: string },
      {
        success: boolean;
        chapa_status: string;
        message?: string;
      }
    >({
      endpoint: endpoint,
      body: {
        tx_ref: txRef,
      },
    })
      .then((response) => ({
        success: true,
        data: {
          chapaSuccess: response.success,
          chapaStatus: response.chapa_status,
          message: response.message,
        },
      }))
      .catch((err) => {
        return {
          success: false,
          errorMessage: err.message,
        };
      });
  }
}

import { ApiManager, ApiResponse, buildSessionHeaders } from "./ApiManager.js";
import { FetchProxy as fetch } from "@storyteller/tauri-utils";

export interface DeveloperApiKeyInfo {
  token: string;
  truncated_api_key: string;
  name: string;
  maybe_description: string | null;
  total_spend: number;
  owner_user_token: string;
  ip_address_creation: string;
  ip_address_update: string;
  created_at: string;
  updated_at: string;
  maybe_deleted_at: string | null;
}

export interface ListDeveloperApiKeysData {
  api_keys: DeveloperApiKeyInfo[];
  user_total_litellm_spend: number;
  remaining_credits: number;
  max_budget: number;
}

export interface SyncDeveloperSpendData {
  user_total_litellm_spend: number;
  deducted_credits: number;
  remaining_credits: number;
  max_budget: number;
}

export interface CreatedDeveloperApiKey {
  api_key_token: string;
  api_key: string;
}

interface ErrorBody {
  success: boolean;
  error_code?: number;
  error_code_str?: string;
  message?: string;
}

export class DeveloperApiKeysApi extends ApiManager {
  public ListApiKeys({
    limit,
    offset,
  }: {
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<ListDeveloperApiKeysData>> {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    if (offset !== undefined) query.set("offset", String(offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const endpoint = `${this.getApiSchemeAndHost()}/v1/developer_api_keys/list${suffix}`;

    return this.jsonFetch<{
      success: boolean;
      data?: ListDeveloperApiKeysData;
    } & ErrorBody>(endpoint, { method: "GET" })
      .then((response) => {
        if (!response.success) {
          return {
            success: false,
            errorMessage: response.message ?? this.statusFallback(response),
          };
        }
        return {
          success: true,
          data: response.data ?? {
            api_keys: [],
            user_total_litellm_spend: 0,
            remaining_credits: 0,
            max_budget: 0,
          },
        };
      })
      .catch((err: Error) => ({ success: false, errorMessage: err.message }));
  }

  public SyncSpend(): Promise<ApiResponse<SyncDeveloperSpendData>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/developer_api_keys/sync_spend`;
    return this.jsonFetch<{
      success: boolean;
      user_total_litellm_spend?: number;
      deducted_credits?: number;
      remaining_credits?: number;
      max_budget?: number;
    } & ErrorBody>(endpoint, { method: "POST" })
      .then((response) => {
        if (!response.success) {
          return {
            success: false,
            errorMessage: response.message ?? this.statusFallback(response),
          };
        }
        return {
          success: true,
          data: {
            user_total_litellm_spend: response.user_total_litellm_spend ?? 0,
            deducted_credits: response.deducted_credits ?? 0,
            remaining_credits: response.remaining_credits ?? 0,
            max_budget: response.max_budget ?? 0,
          },
        };
      })
      .catch((err: Error) => ({ success: false, errorMessage: err.message }));
  }

  public CreateApiKey({
    name,
    maybeDescription,
  }: {
    name: string;
    maybeDescription?: string;
  }): Promise<ApiResponse<CreatedDeveloperApiKey>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/developer_api_keys/create`;
    return this.jsonFetch<{
      success: boolean;
      data?: CreatedDeveloperApiKey;
    } & ErrorBody>(endpoint, {
      method: "POST",
      body: {
        name,
        maybe_description: maybeDescription ?? null,
      },
    })
      .then((response) => {
        if (!response.success || !response.data) {
          return {
            success: false,
            errorMessage: response.message ?? this.statusFallback(response),
          };
        }
        return { success: true, data: response.data };
      })
      .catch((err: Error) => ({ success: false, errorMessage: err.message }));
  }

  public DeleteApiKey({
    token,
  }: {
    token: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/developer_api_keys/delete`;
    return this.jsonFetch<{ success: boolean } & ErrorBody>(endpoint, {
      method: "POST",
      body: { token },
    })
      .then((response) => {
        if (!response.success) {
          return {
            success: false,
            errorMessage: response.message ?? this.statusFallback(response),
          };
        }
        return { success: true, data: { success: true } };
      })
      .catch((err: Error) => ({ success: false, errorMessage: err.message }));
  }

  private async jsonFetch<T>(
    endpoint: string,
    { method, body }: { method: string; body?: unknown },
  ): Promise<T> {
    const response = await fetch(endpoint, {
      method,
      headers: buildSessionHeaders({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text || `Request failed with status ${response.status}`);
    }
  }

  private statusFallback(response: ErrorBody): string {
    if (response.error_code_str) return response.error_code_str;
    if (response.error_code) return `Request failed (${response.error_code})`;
    return "Request failed";
  }
}

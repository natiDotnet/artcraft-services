import { ApiManager, ApiResponse, buildSessionHeaders } from "./ApiManager.js";
import { FetchProxy as fetch } from "@storyteller/tauri-utils";

export interface ChatMessageDto {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCallDto[];
}

export interface ToolCallDto {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatModelDto {
  id: string;
  name: string;
  provider: string;
  cost_credits: number;
  badge?: string;
  description: string;
}

export interface ListChatModelsResponseDto {
  default_model: string;
  models: ChatModelDto[];
}

export interface ChatCompletionsRequestDto {
  model?: string;
  messages: ChatMessageDto[];
  temperature?: number;
}

export class ChatApi extends ApiManager {
  /**
   * Fetch available chat models supported by the OpenRouter backend.
   */
  public async ListModels(): Promise<ApiResponse<ListChatModelsResponseDto>> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/chat/models`;
    return this.get<ListChatModelsResponseDto>({ endpoint })
      .then((res) => ({
        success: true,
        data: res,
      }))
      .catch((err) => ({
        success: false,
        errorMessage: err.message,
      }));
  }

  /**
   * Stream a chat completion with Server-Sent Events (SSE).
   */
  public async StreamCompletion(
    request: ChatCompletionsRequestDto,
    callbacks: {
      onDelta: (text: string) => void;
      onToolCall?: (toolCall: { name: string; arguments: string }) => void;
      onComplete: () => void;
      onError: (err: Error) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const endpoint = `${this.getApiSchemeAndHost()}/v1/chat/completions`;
    const headers = buildSessionHeaders({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error("INSUFFICIENT_CREDITS: Please top up your ETB wallet to continue chatting.");
        }
        if (response.status === 401) {
          throw new Error("UNAUTHORIZED: Please log in to start a chat.");
        }
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") {
              callbacks.onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const choice = parsed.choices?.[0];
              if (choice?.delta?.content) {
                callbacks.onDelta(choice.delta.content);
              }
              if (choice?.delta?.tool_calls && callbacks.onToolCall) {
                for (const tc of choice.delta.tool_calls) {
                  if (tc.function?.name) {
                    callbacks.onToolCall({
                      name: tc.function.name,
                      arguments: tc.function.arguments || "",
                    });
                  }
                }
              }
            } catch {
              // Ignore partial or non-JSON SSE frames
            }
          }
        }
      }

      callbacks.onComplete();
    } catch (err: any) {
      if (err.name === "AbortError") {
        callbacks.onComplete();
      } else {
        callbacks.onError(err);
      }
    }
  }
}

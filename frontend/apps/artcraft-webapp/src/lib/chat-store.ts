import { create } from "zustand";
import { ChatApi, ChatMessageDto } from "@storyteller/api";

export interface ToolCallExecution {
  name: "generate_image" | "generate_video";
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  jobToken?: string;
  status: "idle" | "queued" | "completed" | "failed";
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolCall?: ToolCallExecution;
}

interface ChatState {
  messages: ChatMessageItem[];
  activeModel: string;
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;

  setActiveModel: (model: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  setToolJobToken: (messageId: string, jobToken: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Welcome to **ArtCraft Studio**! I can brainstorm ideas, write prompts, and generate images or videos directly in this conversation. What would you like to create?",
      timestamp: Date.now(),
    },
  ],
  activeModel: "deepseek/deepseek-chat",
  isStreaming: false,
  error: null,
  abortController: null,

  setActiveModel: (model) => set({ activeModel: model }),

  clearMessages: () =>
    set({
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content:
            "Started a new session. Ask me anything or describe an image/video you want to generate!",
          timestamp: Date.now(),
        },
      ],
      error: null,
    }),

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isStreaming: false, abortController: null });
    }
  },

  setToolJobToken: (messageId, jobToken) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.toolCall
          ? {
              ...m,
              toolCall: { ...m.toolCall, jobToken, status: "queued" },
            }
          : m,
      ),
    }));
  },

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now() + 1}`;

    const userMessage: ChatMessageItem = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessageItem = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now() + 1,
      streaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null,
    }));

    const controller = new AbortController();
    set({ abortController: controller });

    const api = new ChatApi();
    const chatHistory: ChatMessageDto[] = get().messages
      .filter((m) => m.id !== assistantMsgId)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      await api.StreamCompletion(
        {
          model: get().activeModel,
          messages: chatHistory,
        },
        {
          onDelta: (delta: string) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            }));
          },
          onToolCall: (tc: { name: string; arguments: string }) => {
            try {
              const args = JSON.parse(tc.arguments || "{}");
              if (tc.name === "generate_image") {
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCall: {
                            name: "generate_image",
                            prompt: args.prompt || "",
                            aspectRatio: args.aspect_ratio || "1:1",
                            status: "idle",
                          },
                        }
                      : m,
                  ),
                }));
              } else if (tc.name === "generate_video") {
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCall: {
                            name: "generate_video",
                            prompt: args.prompt || "",
                            durationSeconds: args.duration_seconds || 5,
                            status: "idle",
                          },
                        }
                      : m,
                  ),
                }));
              }
            } catch {
              // Partial JSON during tool call streaming
            }
          },
          onComplete: () => {
            set((state) => ({
              isStreaming: false,
              abortController: null,
              messages: state.messages.map((m) =>
                m.id === assistantMsgId ? { ...m, streaming: false } : m,
              ),
            }));
            // Update wallet balance chip in TopBar
            window.dispatchEvent(new Event("credits-change"));
          },
          onError: (err: Error) => {
            set((state) => ({
              isStreaming: false,
              abortController: null,
              error: err.message,
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      streaming: false,
                      content:
                        m.content ||
                        `⚠️ Could not complete request: ${err.message}`,
                    }
                  : m,
              ),
            }));
          },
        },
        controller.signal,
      );
    } catch (err: any) {
      set({
        isStreaming: false,
        abortController: null,
        error: err.message,
      });
    }
  },
}));

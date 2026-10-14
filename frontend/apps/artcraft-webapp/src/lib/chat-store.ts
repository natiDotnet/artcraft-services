import { create } from "zustand";
import { ChatApi, ChatMessageDto, ChatModelDto } from "@storyteller/api";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  streaming?: boolean;
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessageItem[];
  model: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string;
  activeModel: string;
  availableModels: ChatModelDto[];
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;

  // Session management
  createNewSession: () => string;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  getActiveMessages: () => ChatMessageItem[];

  // Chat actions
  loadModels: () => Promise<void>;
  setActiveModel: (model: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearActiveSessionMessages: () => void;
}

export const DEFAULT_CHAT_MODELS: ChatModelDto[] = [
  // --- DeepSeek Family ---
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    family: "DeepSeek",
    cost_credits: 1,
    price_per_1m_tokens_etb: 25.0,
    input_price_per_1m_etb: 18.0,
    output_price_per_1m_etb: 35.0,
    badge: "Popular",
    description: "Ultra-fast, state-of-the-art coding and dialogue (25 ETB / 1M tokens)",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    family: "DeepSeek",
    cost_credits: 1,
    price_per_1m_tokens_etb: 170.0,
    input_price_per_1m_etb: 70.0,
    output_price_per_1m_etb: 275.0,
    badge: "Reasoning",
    description: "Advanced chain-of-thought analysis and problem solving (170 ETB / 1M tokens)",
  },

  // --- GPT (OpenAI) Family ---
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    family: "GPT",
    cost_credits: 1,
    price_per_1m_tokens_etb: 780.0,
    input_price_per_1m_etb: 310.0,
    output_price_per_1m_etb: 1250.0,
    badge: "Omni",
    description: "Flagship intelligence for reasoning, analysis, and dialogue (780 ETB / 1M tokens)",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    family: "GPT",
    cost_credits: 1,
    price_per_1m_tokens_etb: 38.0,
    input_price_per_1m_etb: 19.0,
    output_price_per_1m_etb: 75.0,
    badge: "Fast & Cheap",
    description: "Affordable and fast for everyday queries and tasks (38 ETB / 1M tokens)",
  },
  {
    id: "openai/o3-mini",
    name: "o3-mini",
    provider: "OpenAI",
    family: "GPT",
    cost_credits: 1,
    price_per_1m_tokens_etb: 220.0,
    input_price_per_1m_etb: 140.0,
    output_price_per_1m_etb: 550.0,
    badge: "Reasoning",
    description: "High-intelligence STEM, coding, and math reasoning (220 ETB / 1M tokens)",
  },
  {
    id: "openai/o1",
    name: "o1",
    provider: "OpenAI",
    family: "GPT",
    cost_credits: 1,
    price_per_1m_tokens_etb: 2900.0,
    input_price_per_1m_etb: 1875.0,
    output_price_per_1m_etb: 7500.0,
    badge: "Deep Reasoning",
    description: "OpenAI's most capable model for complex thinking and architecture (2,900 ETB / 1M tokens)",
  },

  // --- Claude (Anthropic) Family ---
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    family: "Claude",
    cost_credits: 1,
    price_per_1m_tokens_etb: 1100.0,
    input_price_per_1m_etb: 375.0,
    output_price_per_1m_etb: 1875.0,
    badge: "Best Quality",
    description: "Benchmark-leading nuance, writing, and composition (1,100 ETB / 1M tokens)",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    family: "Claude",
    cost_credits: 1,
    price_per_1m_tokens_etb: 180.0,
    input_price_per_1m_etb: 100.0,
    output_price_per_1m_etb: 625.0,
    badge: "Fast",
    description: "High speed, low latency with exceptional intelligence (180 ETB / 1M tokens)",
  },
  {
    id: "anthropic/claude-3-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    family: "Claude",
    cost_credits: 1,
    price_per_1m_tokens_etb: 2800.0,
    input_price_per_1m_etb: 1875.0,
    output_price_per_1m_etb: 9375.0,
    badge: "Complex Tasks",
    description: "Deep research, detailed writing, and complex comprehension (2,800 ETB / 1M tokens)",
  },

  // --- GLM (THUDM / Zhipu AI) Family ---
  {
    id: "thudm/glm-4-9b-chat",
    name: "GLM-4 9B",
    provider: "Zhipu AI",
    family: "GLM",
    cost_credits: 1,
    price_per_1m_tokens_etb: 20.0,
    input_price_per_1m_etb: 12.0,
    output_price_per_1m_etb: 25.0,
    badge: "Fast & Open",
    description: "Bilingual conversation with high speed and economical cost (20 ETB / 1M tokens)",
  },
  {
    id: "zhipu/glm-4",
    name: "GLM-4",
    provider: "Zhipu AI",
    family: "GLM",
    cost_credits: 1,
    price_per_1m_tokens_etb: 120.0,
    input_price_per_1m_etb: 75.0,
    output_price_per_1m_etb: 165.0,
    badge: "Flagship",
    description: "Zhipu flagship model for advanced reasoning and multi-turn dialogue (120 ETB / 1M tokens)",
  },

  // --- Llama (Meta) Family ---
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    family: "Llama",
    cost_credits: 1,
    price_per_1m_tokens_etb: 48.0,
    input_price_per_1m_etb: 45.0,
    output_price_per_1m_etb: 50.0,
    badge: "Open Weights",
    description: "High-performance open-source conversational intelligence (48 ETB / 1M tokens)",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    family: "Llama",
    cost_credits: 1,
    price_per_1m_tokens_etb: 15.0,
    input_price_per_1m_etb: 10.0,
    output_price_per_1m_etb: 20.0,
    badge: "Lightweight",
    description: "Ultra-fast lightweight open-source conversational model (15 ETB / 1M tokens)",
  },

  // --- Gemini (Google) Family ---
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    family: "Gemini",
    cost_credits: 1,
    price_per_1m_tokens_etb: 35.0,
    input_price_per_1m_etb: 20.0,
    output_price_per_1m_etb: 50.0,
    badge: "Next-Gen",
    description: "Next-generation model built for high speed and multimodal reasoning (35 ETB / 1M tokens)",
  },
  {
    id: "google/gemini-pro-1.5",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    family: "Gemini",
    cost_credits: 1,
    price_per_1m_tokens_etb: 450.0,
    input_price_per_1m_etb: 160.0,
    output_price_per_1m_etb: 625.0,
    badge: "Long Context",
    description: "High reasoning power with up to 2 million token context window (450 ETB / 1M tokens)",
  },
];

const STORAGE_KEY = "artcraft_chat_sessions_v4";

function loadInitialSessions(): { sessions: ChatSession[]; activeId: string } {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { sessions: parsed, activeId: parsed[0].id };
      }
    }
  } catch {
    // ignore
  }

  const initialId = `session-${Date.now()}`;
  const initialSession: ChatSession = {
    id: initialId,
    title: "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    model: "deepseek/deepseek-chat",
  };
  return { sessions: [initialSession], activeId: initialId };
}

function persistSessions(sessions: ChatSession[]) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch {
    // ignore
  }
}

const { sessions: initSessions, activeId: initActiveId } = loadInitialSessions();

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: initSessions,
  activeSessionId: initActiveId,
  activeModel: "deepseek/deepseek-chat",
  availableModels: DEFAULT_CHAT_MODELS,
  isStreaming: false,
  error: null,
  abortController: null,

  getActiveMessages: () => {
    const { sessions, activeSessionId } = get();
    const cur = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    return Array.isArray(cur?.messages) ? cur.messages : [];
  },

  createNewSession: () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: get().activeModel,
    };
    const updated = [newSession, ...get().sessions];
    set({
      sessions: updated,
      activeSessionId: newId,
      error: null,
    });
    persistSessions(updated);
    return newId;
  },

  switchSession: (sessionId: string) => {
    const found = get().sessions.find((s) => s.id === sessionId);
    if (found) {
      set({
        activeSessionId: sessionId,
        activeModel: found.model || get().activeModel,
        error: null,
      });
    }
  },

  deleteSession: (sessionId: string) => {
    const filtered = get().sessions.filter((s) => s.id !== sessionId);
    let nextActive = get().activeSessionId;
    if (nextActive === sessionId) {
      if (filtered.length > 0) {
        nextActive = filtered[0].id;
      } else {
        const freshId = `session-${Date.now()}`;
        const freshSession: ChatSession = {
          id: freshId,
          title: "New Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          model: get().activeModel,
        };
        filtered.push(freshSession);
        nextActive = freshId;
      }
    }
    set({ sessions: filtered, activeSessionId: nextActive });
    persistSessions(filtered);
  },

  renameSession: (sessionId: string, title: string) => {
    const updated = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
    );
    set({ sessions: updated });
    persistSessions(updated);
  },

  clearActiveSessionMessages: () => {
    const { activeSessionId, sessions } = get();
    const updated = sessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, messages: [], title: "New Chat", updatedAt: Date.now() }
        : s
    );
    set({ sessions: updated, error: null });
    persistSessions(updated);
  },

  loadModels: async () => {
    try {
      const api = new ChatApi();
      const res = await api.ListModels();
      if (res.success && res.data?.models && res.data.models.length > 0) {
        set({
          availableModels: res.data.models,
          activeModel: res.data.default_model || get().activeModel,
        });
      }
    } catch {
      // Use fallback defaults
    }
  },

  setActiveModel: (model) => {
    const { activeSessionId, sessions } = get();
    const updated = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, model } : s
    );
    set({ activeModel: model, sessions: updated });
    persistSessions(updated);
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isStreaming: false, abortController: null });
    }
  },

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    const { activeSessionId, sessions, activeModel } = get();
    const curSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    if (!curSession) return;

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
      model: activeModel,
    };

    // Auto-generate title on first message
    const isFirst = !curSession.messages || curSession.messages.length === 0;
    const sessionTitle = isFirst
      ? trimmed.length > 30
        ? `${trimmed.slice(0, 30)}...`
        : trimmed
      : curSession.title;

    const updatedSessions = sessions.map((s) =>
      s.id === curSession.id
        ? {
            ...s,
            title: sessionTitle,
            updatedAt: Date.now(),
            messages: [...(s.messages || []), userMessage, assistantMessage],
          }
        : s
    );

    set({
      sessions: updatedSessions,
      isStreaming: true,
      error: null,
    });
    persistSessions(updatedSessions);

    const controller = new AbortController();
    set({ abortController: controller });

    const api = new ChatApi();
    const chatHistory: ChatMessageDto[] = [
      ...(curSession.messages || []),
      userMessage,
    ].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const updateAssistantMsg = (patch: Partial<ChatMessageItem>) => {
      const fresh = get().sessions.map((s) =>
        s.id === curSession.id
          ? {
              ...s,
              messages: (s.messages || []).map((m) =>
                m.id === assistantMsgId ? { ...m, ...patch } : m
              ),
            }
          : s
      );
      set({ sessions: fresh });
      persistSessions(fresh);
    };

    try {
      await api.StreamCompletion(
        {
          model: activeModel,
          messages: chatHistory,
        },
        {
          onDelta: (delta: string) => {
            const currentMessages = get().getActiveMessages();
            const asst = currentMessages.find((m) => m.id === assistantMsgId);
            const currentContent = asst ? asst.content : "";
            updateAssistantMsg({ content: currentContent + delta });
          },
          onComplete: () => {
            set({ isStreaming: false, abortController: null });
            updateAssistantMsg({ streaming: false });
            window.dispatchEvent(new Event("credits-change"));
          },
          onError: (err: Error) => {
            set({
              isStreaming: false,
              abortController: null,
              error: err.message,
            });

            const isCreditsErr =
              (err as any)?.status === 402 ||
              err.message.toLowerCase().includes("not enough credits") ||
              err.message.includes("INSUFFICIENT_CREDITS") ||
              err.message.includes("Payment Required") ||
              err.message.includes("402");

            if (isCreditsErr) {
              window.dispatchEvent(new CustomEvent("artcraft:insufficient-credits"));
            }

            const currentMessages = get().getActiveMessages();
            const asst = currentMessages.find((m) => m.id === assistantMsgId);
            updateAssistantMsg({
              streaming: false,
              content:
                asst?.content ||
                (isCreditsErr
                  ? "Not enough credits."
                  : `⚠️ ${err.message}`),
            });
          },
        },
        controller.signal
      );
    } catch (err: any) {
      set({
        isStreaming: false,
        abortController: null,
        error: err.message,
      });
      const isCreditsErr =
        err?.status === 402 ||
        (err?.message &&
          (err.message.toLowerCase().includes("not enough credits") ||
            err.message.includes("402")));
      if (isCreditsErr) {
        window.dispatchEvent(new CustomEvent("artcraft:insufficient-credits"));
      }
    }
  },
}));

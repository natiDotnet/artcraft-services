import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SparklesIcon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
  MessageSquareIcon,
  ChevronDownIcon,
  SquareIcon,
  LoaderCircleIcon,
} from "lucide-react";
import {
  CreateMediaPageShell,
  useAuthCheck,
  usePromptHeight,
} from "../../components/generation-gallery";
import { useSignupCta, SignupCtaModal } from "../../components/signup-cta-modal";
import { PromptBox } from "../../components/prompt-box/PromptBox";
import type { RefImage } from "../../components/prompt-box/types";
import { PopoverMenu, type PopoverItem } from "@storyteller/ui-popover";
import { Button } from "@storyteller/ui-button";
import { Tooltip } from "@storyteller/ui-tooltip";
import {
  useChatStore,
  ChatMessageItem,
  DEFAULT_CHAT_MODELS,
} from "../../lib/chat-store";
import { toast } from "../../components/toast/toast";

const EMPTY_REFS: RefImage[] = [];
const NOOP_REFS = () => {};

const STARTER_PROMPTS = [
  {
    icon: "💡",
    title: "Story Premise",
    prompt:
      "Help me brainstorm an original sci-fi story premise set in a high-tech Addis Ababa in 2088 with magnetic light-rails and traditional culture.",
  },
  {
    icon: "✍️",
    title: "Cinematic Scene",
    prompt:
      "Write a compelling dramatic scene between two master coffee brewers discussing secret roasting traditions passed down through generations.",
  },
  {
    icon: "🧠",
    title: "Explain Concept",
    prompt:
      "Explain how modern AI language models and chain-of-thought reasoning work using an intuitive, real-world analogy.",
  },
  {
    icon: "🏛️",
    title: "Architectural History",
    prompt:
      "Tell me about the engineering marvel and architectural history of the monolithic rock-hewn churches of Lalibela.",
  },
];

function renderFormattedMarkdown(text: string) {
  const safeText = typeof text === "string" ? text : "";
  const lines = safeText.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        const fullCode = codeBuffer.join("\n");
        const langDisplay = codeLang || "Code Snippet";
        elements.push(
          <div
            key={`code-${index}`}
            className="my-3 overflow-hidden rounded-xl border border-ui-panel-border bg-[#0a0a0f] text-xs shadow-md"
          >
            <div className="flex items-center justify-between bg-white/[0.04] px-4 py-2 border-b border-ui-panel-border text-[11px] font-mono text-white/50">
              <span className="font-semibold text-primary">{langDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fullCode);
                  toast.success("Code copied to clipboard");
                }}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <CopyIcon className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="p-4 font-mono text-emerald-300/90 overflow-x-auto leading-relaxed text-[12px]">
              {fullCode}
            </pre>
          </div>
        );
        codeBuffer = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.trim().replace(/^```/, "").trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (!line.trim()) {
      elements.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }

    const parseInline = (str: string) => {
      const tokens = str.split(/(\*\*.*?\*\*|`.*?`)/g);
      return tokens.map((token, tIdx) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return (
            <strong key={tIdx} className="font-semibold text-white">
              {token.slice(2, -2)}
            </strong>
          );
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return (
            <code
              key={tIdx}
              className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-primary font-medium"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        return token;
      });
    };

    if (line.startsWith("# ")) {
      elements.push(
        <h2
          key={index}
          className="text-lg font-bold text-white mt-4 mb-2 tracking-tight"
        >
          {parseInline(line.slice(2))}
        </h2>
      );
      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={index}
          className="text-base font-semibold text-white mt-3 mb-1.5 tracking-tight"
        >
          {parseInline(line.slice(3))}
        </h3>
      );
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={index} className="text-sm font-semibold text-white mt-2 mb-1">
          {parseInline(line.slice(4))}
        </h4>
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li
          key={index}
          className="ml-4 list-disc text-sm text-white/85 leading-relaxed"
        >
          {parseInline(line.slice(2))}
        </li>
      );
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s(.*)/);
      if (match) {
        elements.push(
          <li
            key={index}
            className="ml-4 list-decimal text-sm text-white/85 leading-relaxed"
          >
            {parseInline(match[2])}
          </li>
        );
        return;
      }
    }

    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={index}
          className="my-2 border-l-2 border-primary/60 pl-3 italic text-white/70 text-sm"
        >
          {parseInline(line.slice(2))}
        </blockquote>
      );
      return;
    }

    elements.push(
      <p key={index} className="text-sm leading-relaxed text-white/85">
        {parseInline(line)}
      </p>
    );
  });

  return elements;
}

export default function StudioChat() {
  const { authChecked } = useAuthCheck();
  const { loggedIn, openSignupCta } = useSignupCta();
  const { promptBoxRef, promptHeight } = usePromptHeight();

  const [inputPrompt, setInputPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat store state & actions
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeModel = useChatStore((s) => s.activeModel);
  const availableModels = useChatStore((s) => s.availableModels);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const loadModels = useChatStore((s) => s.loadModels);
  const setActiveModel = useChatStore((s) => s.setActiveModel);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const createNewSession = useChatStore((s) => s.createNewSession);
  const switchSession = useChatStore((s) => s.switchSession);
  const clearActiveSessionMessages = useChatStore(
    (s) => s.clearActiveSessionMessages
  );
  const getActiveMessages = useChatStore((s) => s.getActiveMessages);

  // Load backend models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const messages: ChatMessageItem[] = getActiveMessages();

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const modelsList =
    availableModels && availableModels.length > 0
      ? availableModels
      : DEFAULT_CHAT_MODELS;

  const activeModelInfo =
    modelsList.find((m) => m.id === activeModel) || modelsList[0];

  // Scroll to bottom on new messages or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeSessionId]);

  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isStreaming, messages[messages.length - 1]?.content]);

  // Model Popover items formatted for PopoverMenu
  const modelPopoverItems = useMemo((): PopoverItem[] => {
    return modelsList.map((model) => {
      const isSelected = model.id === activeModel;
      const price = model.price_per_1m_tokens_etb || 25;
      return {
        label: model.name,
        selected: isSelected,
        action: model.id,
        description: `${price} ETB / 1M tokens (${
          model.input_price_per_1m_etb || 18
        } in / ${model.output_price_per_1m_etb || 35} out) • ${
          model.description
        }`,
        icon: <SparklesIcon className="h-4 w-4 text-primary" />,
        badges: model.badge ? [{ label: model.badge }] : undefined,
        trailing: (
          <span className="font-mono text-xs font-semibold text-amber-300">
            {price} ETB
          </span>
        ),
      };
    });
  }, [modelsList, activeModel]);

  // Session Popover items
  const sessionPopoverItems = useMemo((): PopoverItem[] => {
    return (sessions || []).map((session) => {
      const isSelected = session.id === activeSessionId;
      const count = session.messages?.length || 0;
      return {
        label: session.title || "Untitled Conversation",
        selected: isSelected,
        action: session.id,
        description: `${count} message${count === 1 ? "" : "s"} • ${new Date(
          session.updatedAt
        ).toLocaleDateString()}`,
        icon: <MessageSquareIcon className="h-4 w-4 text-white/60" />,
      };
    });
  }, [sessions, activeSessionId]);

  const handleSend = async () => {
    if (!inputPrompt.trim() || isStreaming) return;
    if (!loggedIn) {
      openSignupCta();
      return;
    }
    const promptToSend = inputPrompt;
    setInputPrompt("");
    try {
      await sendMessage(promptToSend);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send message";
      toast.error(message);
    }
  };

  const handleModelChange = (item: PopoverItem) => {
    if (item.action) {
      setActiveModel(item.action);
    }
  };

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return activeModelInfo.name;
    const found = modelsList.find((m) => m.id === modelId);
    return found ? found.name : modelId;
  };

  const getModelPrice = (modelId?: string) => {
    if (!modelId) return activeModelInfo.price_per_1m_tokens_etb || 25;
    const found = modelsList.find((m) => m.id === modelId);
    return found?.price_per_1m_tokens_etb || 25;
  };

  return (
    <CreateMediaPageShell
      title="AI Studio Chat - ArtCraft"
      description="Conversational intelligence powered by state-of-the-art LLMs. Pure chat, billed transparently per million tokens in ETB."
      authChecked={authChecked}
      hasContent={messages.length > 0}
      emptyStateTitle="AI Studio Chat"
      emptyStateSubtitle="Conversational intelligence powered by premier LLMs. Pure chat, billed transparently per million tokens in ETB."
      emptyStateCta={
        loggedIn ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mt-6">
            {STARTER_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputPrompt(item.prompt)}
                className="group flex flex-col items-start p-3.5 rounded-xl border border-ui-panel-border bg-ui-panel/40 hover:bg-ui-panel hover:border-ui-border-strong transition-all text-left"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs font-semibold text-white group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                </div>
                <p className="text-xs text-white/50 group-hover:text-white/70 line-clamp-2 leading-relaxed">
                  {item.prompt}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={openSignupCta}
            icon={SparklesIcon}
            className="h-12 px-6 mt-6"
          >
            Sign up to chat
          </Button>
        )
      }
      bottomOffset={promptHeight + 24}
      modelItems={modelPopoverItems}
      onModelChange={handleModelChange}
      gridContent={
        <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 py-6 space-y-6">
          {messages.map((message) => {
            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl border border-ui-panel-border bg-ui-panel px-4 py-3 text-sm text-white shadow-sm">
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                    <div className="mt-1 flex items-center justify-end text-[10px] text-white/40">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            const isThisStreaming = isStreaming && message.streaming;
            const modelPrice = getModelPrice(message.model);

            return (
              <div
                key={message.id}
                className="rounded-2xl border border-ui-panel-border bg-ui-panel/40 p-4 sm:p-5 transition-all shadow-sm"
              >
                {/* Header: Model pill & Rate badge & Copy button */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-ui-panel-border/60">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
                      <SparklesIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-white tracking-tight">
                      {getModelDisplayName(message.model)}
                    </span>
                    <span className="rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                      {modelPrice} ETB / 1M
                    </span>
                    {isThisStreaming && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary animate-pulse">
                        <LoaderCircleIcon className="h-3 w-3 animate-spin" />
                        streaming...
                      </span>
                    )}
                  </div>

                  <Tooltip content="Copy message" position="top">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        toast.success("Message copied");
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>

                {/* Message body */}
                <div className="text-sm leading-relaxed text-white/90">
                  {message.content ? (
                    renderFormattedMarkdown(message.content)
                  ) : isThisStreaming ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-white/40 font-mono">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
                      Thinking...
                    </div>
                  ) : (
                    <span className="text-white/40 italic">Empty response</span>
                  )}
                  {isThisStreaming && (
                    <span className="inline-block h-4 w-1.5 bg-primary ml-1 align-middle rounded-sm animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      }
      promptBox={
        <div
          ref={promptBoxRef}
          className="animate-fade-in-up fixed bottom-2 sm:bottom-3 right-0 z-30 mx-auto max-w-4xl px-2 sm:px-4 transition-[left] duration-200 ease-linear"
          style={{
            animationDelay: "150ms",
            left: "var(--ac-sidebar-offset, 0px)",
          }}
        >
          <PromptBox
            prompt={inputPrompt}
            onPromptChange={setInputPrompt}
            onSubmit={handleSend}
            isSubmitting={isStreaming}
            placeholder="Ask anything, brainstorm ideas, write code..."
            supportsImagePrompts={false}
            referenceImages={EMPTY_REFS}
            onReferenceImagesChange={NOOP_REFS}
            maxPromptLength={10000}
            credits={null}
            modelSelector={
              <Tooltip
                content="Chat Model"
                position="top"
                className="z-50"
                closeOnClick
              >
                <PopoverMenu
                  items={modelPopoverItems}
                  onSelect={handleModelChange}
                  mode="toggle"
                  panelTitle="Select Chat Model"
                  panelClassName="w-[340px]"
                  richList
                  triggerIcon={
                    <SparklesIcon className="h-4 w-4 text-primary" />
                  }
                  renderTrigger={(selected) => (
                    <>
                      <SparklesIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate max-w-[120px] font-medium text-xs text-base-fg">
                        {selected?.label || activeModelInfo.name}
                      </span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 shrink-0">
                        {activeModelInfo.price_per_1m_tokens_etb || 25} ETB / 1M
                      </span>
                      <ChevronDownIcon className="h-3 w-3 text-base-fg/50 shrink-0 ml-0.5" />
                    </>
                  )}
                />
              </Tooltip>
            }
            leftToolbar={
              <div className="flex items-center gap-1.5">
                {/* Conversation session switcher */}
                <Tooltip content="Conversations" position="top" closeOnClick>
                  <PopoverMenu
                    items={sessionPopoverItems}
                    onSelect={(item) =>
                      item.action && switchSession(item.action)
                    }
                    mode="default"
                    panelTitle="Conversations"
                    panelClassName="w-[280px]"
                    position="top"
                    align="start"
                    renderTrigger={() => (
                      <>
                        <MessageSquareIcon className="h-4 w-4 text-base-fg/70 shrink-0" />
                        <span className="truncate max-w-[110px] hidden sm:inline text-xs font-medium text-base-fg">
                          {activeSession?.title || "Conversations"}
                        </span>
                        <ChevronDownIcon className="h-3 w-3 text-base-fg/50 shrink-0" />
                      </>
                    )}
                  />
                </Tooltip>

                {/* New Conversation Button */}
                <Tooltip content="New Conversation" position="top">
                  <button
                    type="button"
                    onClick={() => {
                      createNewSession();
                      toast.success("New conversation started");
                    }}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[3px] border border-ui-controls-border bg-ui-controls text-base-fg/80 transition-colors hover:bg-ui-controls-hover hover:text-base-fg"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </Tooltip>

                {/* Clear messages */}
                {messages.length > 0 && (
                  <Tooltip content="Clear messages" position="top">
                    <button
                      type="button"
                      onClick={clearActiveSessionMessages}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[3px] border border-ui-controls-border bg-ui-controls text-base-fg/60 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </div>
            }
            rightToolbar={
              isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 text-xs font-medium text-red-300 hover:bg-red-500/25 transition-colors"
                >
                  <SquareIcon className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : null
            }
          />
          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-white/40 font-mono">
            <span>1 ETB = 1 Credit</span>
            <span>•</span>
            <span>Pricing per million tokens</span>
            <span>•</span>
            <span>Telebirr & Chapa</span>
          </div>
        </div>
      }
      modals={<SignupCtaModal />}
    />
  );
}

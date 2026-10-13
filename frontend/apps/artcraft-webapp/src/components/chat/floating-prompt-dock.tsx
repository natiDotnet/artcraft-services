import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUpIcon,
  SparklesIcon,
  SquareIcon,
  ChevronDownIcon,
  CoinsIcon,
  ImageIcon,
  VideoIcon,
  PlusIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { useChatStore } from "../../lib/chat-store";
import { toast } from "../toast/toast";

type DockMode = "chat" | "image" | "video";

interface FloatingPromptDockProps {
  onTopUpClick?: () => void;
  className?: string;
}

export const FloatingPromptDock: React.FC<FloatingPromptDockProps> = ({
  onTopUpClick,
  className = "",
}) => {
  const {
    activeModel,
    availableModels,
    isStreaming,
    sendMessage,
    generateDirectMedia,
    stopStreaming,
    clearMessages,
    setActiveModel,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [mode, setMode] = useState<DockMode>("chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const activeModelInfo = availableModels.find((m) => m.id === activeModel) || {
    id: activeModel,
    name: "DeepSeek V3",
    provider: "DeepSeek",
    badge: "Popular",
    cost_credits: 1,
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (mode === "chat") {
      await sendMessage(text);
    } else if (mode === "image") {
      await generateDirectMedia("image", text, { aspectRatio: "1:1" });
    } else if (mode === "video") {
      await generateDirectMedia("video", text, { aspectRatio: "16:9", duration: 5 });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full max-w-3xl mx-auto ${className}`}>
      <div className="relative rounded-2xl border border-white/[0.12] bg-[#111116]/90 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 transition-all">
        {/* Top Controls: Mode selectors & Model picker */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
          {/* Modes */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                mode === "chat"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <SparklesIcon className="h-3.5 w-3.5 text-primary" />
              <span>Chat (1 ETB)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("image")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                mode === "image"
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
              <span>Image (10 ETB)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("video")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                mode === "video"
                  ? "bg-blue-600/30 text-blue-200 border border-blue-500/40 shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <VideoIcon className="h-3.5 w-3.5 text-blue-400" />
              <span>Video (20 ETB)</span>
            </button>
          </div>

          {/* Right Controls: Model Picker & New Chat */}
          <div className="flex items-center gap-1.5">
            {/* Model Dropdown */}
            <Menu as="div" className="relative">
              <MenuButton className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors focus:outline-none">
                <span className="max-w-[120px] truncate">{activeModelInfo.name}</span>
                {activeModelInfo.badge && (
                  <span className="hidden sm:inline-block rounded bg-primary/20 px-1 py-0.2 text-[9px] font-mono text-primary uppercase">
                    {activeModelInfo.badge}
                  </span>
                )}
                <ChevronDownIcon className="h-3 w-3 text-white/40" />
              </MenuButton>

              <Transition
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <MenuItems className="absolute right-0 bottom-full mb-2 w-72 origin-bottom-right rounded-xl border border-white/15 bg-[#14141a] p-1.5 shadow-2xl focus:outline-none z-50">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40 border-b border-white/[0.08] mb-1">
                    Select OpenRouter LLM
                  </div>
                  {availableModels.map((model) => (
                    <MenuItem key={model.id}>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={() => setActiveModel(model.id)}
                          className={`flex w-full items-start justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                            active || activeModel === model.id
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/[0.06]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold">{model.name}</span>
                              {model.badge && (
                                <span className="rounded bg-primary/20 px-1 text-[9px] font-mono text-primary">
                                  {model.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-white/50 leading-tight mt-0.5 line-clamp-1">
                              {model.description}
                            </p>
                          </div>
                          <span className="ml-2 text-[10px] font-mono text-amber-300/80 shrink-0">
                            1 ETB
                          </span>
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Transition>
            </Menu>

            {/* Clear/New Chat button */}
            <button
              type="button"
              onClick={clearMessages}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Start a new chat session"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Input Textarea Area */}
        <div className="mt-2.5 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "chat"
                ? "Ask anything, brainstorm scene ideas, or compose a prompt..."
                : mode === "image"
                  ? "Describe the image to generate in vivid detail..."
                  : "Describe the video clip with camera motion and cinematic details..."
            }
            className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none min-h-[38px] max-h-[180px] leading-relaxed"
          />

          {/* Send / Stop Button */}
          <div className="shrink-0 pb-0.5">
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/80 hover:bg-red-500 text-white shadow-lg transition-all"
                title="Stop generation"
              >
                <SquareIcon className="h-4 w-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  input.trim()
                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:scale-105 hover:from-purple-400 hover:to-indigo-500"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
                title="Send prompt (Enter)"
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom micro-info */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/40 px-1">
          <span className="hidden sm:inline">
            Press <kbd className="rounded border border-white/20 bg-white/5 px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send, <kbd className="rounded border border-white/20 bg-white/5 px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for newline
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="flex items-center gap-1 text-white/50">
              <CoinsIcon className="h-3 w-3 text-amber-400" />
              1 ETB = 1 Credit
            </span>
            {onTopUpClick && (
              <button
                type="button"
                onClick={onTopUpClick}
                className="text-primary hover:text-primary-300 font-medium transition-colors"
              >
                Top up
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

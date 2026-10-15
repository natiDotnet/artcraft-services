import React, { useState } from "react";
import {
  DownloadIcon,
  SparklesIcon,
  VideoIcon,
  ImageIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  CoinsIcon,
} from "lucide-react";
import { ToolCallExecution, useChatStore } from "../../lib/chat-store";
import { toast } from "../toast/toast";

interface MediaResultCardProps {
  messageId: string;
  toolCall: ToolCallExecution;
}

export const MediaResultCard: React.FC<MediaResultCardProps> = ({
  messageId,
  toolCall,
}) => {
  const { executeToolCall, generateDirectMedia } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [, setIsVideoLoading] = useState(true);

  const isImage = toolCall.name === "generate_image";
  const costEtb = isImage ? 10 : 20;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(toolCall.prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `artcraft-${isImage ? "image" : "video"}-${Date.now()}.${isImage ? "webp" : "mp4"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download started");
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleAnimateImage = () => {
    generateDirectMedia(
      "video",
      `Cinematic motion of ${toolCall.prompt}, smooth dynamic camera movement`,
      { aspectRatio: "16:9", duration: 5 },
    );
  };

  return (
    <div className="mt-3.5 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#16161c] to-[#0e0e12] p-4 shadow-xl backdrop-blur-md">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
            {isImage ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <VideoIcon className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                {isImage ? "ArtCraft Image Gen" : "ArtCraft Video Gen"}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                <CoinsIcon className="h-2.5 w-2.5" />
                {costEtb} ETB
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              {toolCall.aspectRatio || (isImage ? "1:1" : "16:9")} • {toolCall.status}
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyPrompt}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Copy Prompt"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Copy prompt</span>
        </button>
      </div>

      {/* Prompt preview */}
      <div className="my-3 rounded-lg bg-black/40 px-3 py-2 border border-white/[0.06]">
        <p className="text-xs text-white/80 line-clamp-2 italic">
          &ldquo;{toolCall.prompt}&rdquo;
        </p>
      </div>

      {/* Body States */}
      {toolCall.status === "idle" && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-4 border border-white/[0.06]">
          <div className="text-left">
            <h4 className="text-sm font-medium text-white">Ready to generate</h4>
            <p className="text-xs text-white/60">
              Deducts {costEtb} ETB from your balance on initiation.
            </p>
          </div>
          <button
            onClick={() => executeToolCall(messageId)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all hover:scale-[1.02]"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            Generate Now ({costEtb} ETB)
          </button>
        </div>
      )}

      {toolCall.status === "queued" && (
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.06] p-6 text-center">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary border border-primary/40 animate-pulse">
            <SparklesIcon className="h-6 w-6 animate-spin duration-1000" />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-white">
            Creating your {isImage ? "artwork" : "video"}...
          </h4>
          <p className="mt-1 text-xs text-white/60">
            Rendering on cloud GPU clusters. Deducting {costEtb} ETB.
          </p>
          <div className="mt-4 h-1.5 w-full max-w-xs mx-auto overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 animate-[pulse_1.5s_infinite] bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" />
          </div>
        </div>
      )}

      {toolCall.status === "completed" && toolCall.resultUrls && toolCall.resultUrls.length > 0 && (
        <div className="space-y-3">
          {isImage ? (
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/60">
              <img
                src={toolCall.resultUrls[0]}
                alt={toolCall.prompt}
                className="w-full max-h-[480px] object-contain transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-90 transition-opacity flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckIcon className="h-3 w-3" /> Ready • 10 ETB
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDownload(toolCall.resultUrls![0])}
                    className="flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 text-xs text-white backdrop-blur-md transition-colors"
                  >
                    <DownloadIcon className="h-3 w-3" />
                    Download
                  </button>
                  <button
                    onClick={handleAnimateImage}
                    className="flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-medium text-white shadow-md transition-colors"
                    title="Generate a 5-second video from this image"
                  >
                    <VideoIcon className="h-3 w-3" />
                    Animate (20 ETB)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60">
              <video
                src={toolCall.resultUrls[0]}
                controls
                loop
                autoPlay
                muted
                playsInline
                className="w-full max-h-[460px] object-contain"
                onLoadedData={() => setIsVideoLoading(false)}
              />
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckIcon className="h-3 w-3" /> Render Complete • 20 ETB
                </span>
                <button
                  onClick={() => handleDownload(toolCall.resultUrls![0])}
                  className="flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-xs text-white transition-colors"
                >
                  <DownloadIcon className="h-3 w-3" />
                  Download Clip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {toolCall.status === "failed" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-4 text-left">
          <h4 className="text-xs font-semibold text-red-300">Generation Unsuccessful</h4>
          <p className="mt-1 text-xs text-red-200/70">
            {toolCall.error || "An error occurred during GPU processing."}
          </p>
          <button
            onClick={() => executeToolCall(messageId)}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors"
          >
            <RefreshCwIcon className="h-3 w-3" />
            Retry Generation
          </button>
        </div>
      )}
    </div>
  );
};

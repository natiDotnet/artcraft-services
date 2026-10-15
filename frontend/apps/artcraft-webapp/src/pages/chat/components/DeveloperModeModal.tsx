import React, { useEffect, useState } from "react";
import { Modal } from "@storyteller/ui-modal";
import { Button } from "@storyteller/ui-button";
import { Input } from "@storyteller/ui-input";
import {
  CheckIcon,
  CopyIcon,
  KeyIcon,
  LoaderCircleIcon,
  PlusIcon,
  TerminalIcon,
  TrashIcon,
  Code2Icon,
  BookOpenIcon,
  XIcon,
} from "lucide-react";
import {
  DeveloperApiKeysApi,
  type DeveloperApiKeyInfo,
  type CreatedDeveloperApiKey,
  type UserInfo,
} from "@storyteller/api";
import { toast } from "../../../components/toast/toast";

interface DeveloperModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
}

type TabType = "quickstart" | "cursor" | "continue" | "python" | "curl" | "models";

const SUPPORTED_MODELS = [
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", family: "DeepSeek", price: "25 ETB" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", family: "DeepSeek", price: "40 ETB" },
  { id: "openai/gpt-4o", name: "GPT-4o", family: "GPT", price: "150 ETB" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", family: "GPT", price: "30 ETB" },
  { id: "openai/o3-mini", name: "o3-mini", family: "GPT", price: "75 ETB" },
  { id: "openai/o1", name: "o1 High Reasoning", family: "GPT", price: "350 ETB" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", family: "Claude", price: "200 ETB" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", family: "Claude", price: "45 ETB" },
  { id: "thudm/glm-4-9b-chat", name: "GLM-4 9B Chat", family: "GLM", price: "20 ETB" },
  { id: "zhipu/glm-4", name: "GLM-4 Enterprise", family: "GLM", price: "60 ETB" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", family: "Llama", price: "35 ETB" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", family: "Gemini", price: "25 ETB" },
  { id: "deepseek/deepseek-v4-flash-0731", name: "DeepSeek V4 Flash", family: "DeepSeek", price: "69 ETB" },
  { id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash", family: "GLM", price: "110 ETB" },
  { id: "minimax/minimax-m2.7", name: "MiniMax M2.7", family: "MiniMax", price: "123 ETB" },
  { id: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron 3.5 Super VL", family: "NVIDIA", price: "Free" },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", family: "NVIDIA", price: "Free" },
  { id: "nvidia/nemotron-3.5-content-safety:free", name: "Nemotron 3.5 Content Safety", family: "NVIDIA", price: "Free" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra 550B", family: "NVIDIA", price: "Free" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron 3 Nano Omni 30B", family: "NVIDIA", price: "Free" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B", family: "NVIDIA", price: "Free" },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B-A4B IT", family: "Gemini", price: "Free" },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B IT", family: "Gemini", price: "Free" },
  { id: "inception/mercury-decide:free", name: "Mercury Decide", family: "Inception", price: "Free" },
  { id: "respan/span-01-lite:free", name: "Span-01 Lite", family: "Respan", price: "Free" },
  { id: "liquid/lfm-2.5-embedding-350m:free", name: "LFM 2.5 Embedding 350M", family: "Liquid", price: "Free" },
  { id: "liquid/lfm-2.5-2.6b:free", name: "LFM 2.5 2.6B", family: "Liquid", price: "Free" },
  { id: "dots-studio/dots-3-note-preview:free", name: "Dots-3 Note Preview", family: "Dots Studio", price: "Free" },
  { id: "thinkingmachines/inkling-small:free", name: "Inkling Small", family: "Thinking Machines", price: "Free" },
  { id: "thinkingmachines/inkling:free", name: "Inkling", family: "Thinking Machines", price: "Free" },
  { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1", family: "Poolside", price: "Free" },
  { id: "cohere/north-mini-code:free", name: "North Mini Code", family: "Cohere", price: "Free" },
];

export function DeveloperModeModal({
  isOpen,
  onClose,
  user,
}: DeveloperModeModalProps) {
  const [api] = useState(() => new DeveloperApiKeysApi());
  const [activeTab, setActiveTab] = useState<TabType>("quickstart");
  const [keys, setKeys] = useState<DeveloperApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Key creation state
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedDeveloperApiKey | null>(null);

  // Delete key state
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/v1`
    : "http://localhost:12345/v1";

  // Active key or placeholder
  const activeKeyPlaceholder = createdKey
    ? createdKey.api_key
    : keys.length > 0
    ? `${keys[0].truncated_api_key}...`
    : "YOUR_ARTCRAFT_API_KEY";

  useEffect(() => {
    if (isOpen && user) {
      loadKeys();
    }
  }, [isOpen, user]);

  const loadKeys = async () => {
    setLoading(true);
    const response = await api.ListApiKeys({ limit: 50 });
    setLoading(false);
    if (response.success && response.data) {
      const live = response.data.api_keys.filter((k) => k.maybe_deleted_at === null);
      setKeys(live);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }
    setCreatingLoading(true);
    const response = await api.CreateApiKey({ name: newKeyName.trim() });
    setCreatingLoading(false);
    if (response.success && response.data) {
      setCreatedKey(response.data);
      setNewKeyName("");
      setIsCreatingKey(false);
      toast.success("API Key generated successfully!");
      loadKeys();
    } else {
      toast.error(response.errorMessage ?? "Failed to create API key");
    }
  };

  const handleDeleteKey = async (token: string) => {
    setDeletingToken(token);
    const response = await api.DeleteApiKey({ token });
    setDeletingToken(null);
    if (response.success) {
      toast.success("API Key deleted");
      setKeys((prev) => prev.filter((k) => k.token !== token));
      if (createdKey?.api_key_token === token) {
        setCreatedKey(null);
      }
    } else {
      toast.error(response.errorMessage ?? "Failed to delete API key");
    }
  };

  const continueConfigSnippet = `{
  "models": [
    {
      "title": "ArtCraft DeepSeek V3",
      "provider": "openai",
      "model": "deepseek/deepseek-chat",
      "apiKey": "${activeKeyPlaceholder}",
      "apiBase": "${baseUrl}"
    },
    {
      "title": "ArtCraft DeepSeek R1",
      "provider": "openai",
      "model": "deepseek/deepseek-r1",
      "apiKey": "${activeKeyPlaceholder}",
      "apiBase": "${baseUrl}"
    },
    {
      "title": "ArtCraft Claude 3.5 Sonnet",
      "provider": "openai",
      "model": "anthropic/claude-3.5-sonnet",
      "apiKey": "${activeKeyPlaceholder}",
      "apiBase": "${baseUrl}"
    }
  ]
}`;

  const pythonSnippet = `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${activeKeyPlaceholder}",
)

stream = client.chat.completions.create(
    model="deepseek/deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Explain binary search with an example."}
    ],
    stream=True,
)

for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
`;

  const curlSnippet = `curl -X POST ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeKeyPlaceholder}" \\
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [
      {"role": "user", "content": "Hello ArtCraft AI!"}
    ],
    "stream": true
  }'`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showClose={false}
      className="max-w-4xl w-full p-0 overflow-hidden bg-ui-background border border-ui-panel-border rounded-2xl shadow-2xl"
    >
      <div className="flex flex-col h-[85vh] max-h-[750px]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-ui-panel-border/80 px-6 py-4 bg-ui-panel/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Code2Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Developer Mode & API
                </h2>
                <span className="rounded bg-primary/20 border border-primary/40 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
                  OpenAI Compatible
                </span>
              </div>
              <p className="text-xs text-white/60">
                Use ArtCraft models inside Cursor, Continue.dev, Python SDK, or your own agents.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-ui-controls hover:text-white transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Base URL Box */}
          <div className="rounded-xl border border-ui-panel-border bg-ui-panel/40 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-white/80">
              <span className="flex items-center gap-1.5">
                <TerminalIcon className="h-4 w-4 text-primary" />
                API Base URL
              </span>
              <span className="text-[11px] text-white/40 font-mono">
                OpenAI Standard Endpoint
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={baseUrl}
                className="flex-1 bg-ui-controls/80 border border-ui-controls-border rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 select-all outline-none"
              />
              <Button
                variant="secondary"
                className="h-8 px-3 shrink-0"
                onClick={() => copyToClipboard(baseUrl, "baseUrl")}
              >
                {copiedField === "baseUrl" ? (
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5 mr-1" />
                )}
                {copiedField === "baseUrl" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* API Keys Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyIcon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-white">Your API Keys</h3>
              </div>
              {!isCreatingKey && (
                <Button
                  variant="primary"
                    className="h-8 text-xs"
                  onClick={() => setIsCreatingKey(true)}
                >
                  <PlusIcon className="h-3.5 w-3.5 mr-1" />
                  Generate New Key
                </Button>
              )}
            </div>

            {/* Created Key Alert (Secret shown once) */}
            {createdKey && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckIcon className="h-4 w-4" />
                    New API Key Generated — Copy it now!
                  </span>
                  <span className="text-[10px] text-emerald-300/80">
                    Will never be shown again
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdKey.api_key}
                    className="flex-1 bg-ui-controls border border-emerald-500/40 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 select-all outline-none"
                  />
                  <Button
                    variant="primary"
                        className="h-8 px-3 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => copyToClipboard(createdKey.api_key, "secretKey")}
                  >
                    {copiedField === "secretKey" ? (
                      <CheckIcon className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <CopyIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copiedField === "secretKey" ? "Copied" : "Copy Secret"}
                  </Button>
                </div>
              </div>
            )}

            {/* Create Key Form */}
            {isCreatingKey && (
              <form
                onSubmit={handleCreateKey}
                className="rounded-xl border border-ui-panel-border bg-ui-panel/60 p-4 space-y-3 animate-fade-in"
              >
                <h4 className="text-xs font-semibold text-white">New API Key Name</h4>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Cursor IDE, Continue, Python App"
                    autoFocus
                    className="flex-1 text-xs"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                        className="h-9 px-4 shrink-0 text-xs"
                    disabled={creatingLoading || !newKeyName.trim()}
                  >
                    {creatingLoading ? (
                      <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    Create Key
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                        className="h-9 px-3 shrink-0 text-xs"
                    onClick={() => setIsCreatingKey(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Keys List */}
            {loading ? (
              <div className="flex items-center justify-center py-6 text-white/50 text-xs gap-2">
                <LoaderCircleIcon className="h-4 w-4 animate-spin text-primary" />
                Loading API keys...
              </div>
            ) : keys.length === 0 && !createdKey ? (
              <div className="rounded-xl border border-dashed border-ui-panel-border p-6 text-center text-xs text-white/50 space-y-2">
                <KeyIcon className="h-6 w-6 mx-auto text-white/30" />
                <p>No API keys created yet. Generate one above to connect your external tools.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {keys.map((k) => (
                  <div
                    key={k.token}
                    className="flex items-center justify-between p-3 rounded-lg border border-ui-panel-border bg-ui-panel/30 hover:bg-ui-panel/60 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white truncate">{k.name}</p>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          {k.total_spend > 0 ? `${k.total_spend.toFixed(2)} ETB` : "0.00 ETB"}
                        </span>
                      </div>
                      <code className="text-[11px] font-mono text-white/50">
                        {k.truncated_api_key}…
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(k.token)}
                      disabled={deletingToken === k.token}
                      className="flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-red-500/15 hover:text-red-400 transition-colors shrink-0"
                    >
                      {deletingToken === k.token ? (
                        <LoaderCircleIcon className="h-3 w-3 animate-spin" />
                      ) : (
                        <TrashIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Integration Tabs */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <BookOpenIcon className="h-4 w-4 text-primary" />
              Integration Guides & Configs
            </h3>

            {/* Tab Buttons */}
            <div className="flex flex-wrap gap-1.5 border-b border-ui-panel-border/80 pb-2">
              {[
                { id: "quickstart", label: "Overview" },
                { id: "cursor", label: "Cursor IDE" },
                { id: "continue", label: "Continue.dev" },
                { id: "python", label: "Python SDK" },
                { id: "curl", label: "cURL" },
                { id: "models", label: "Model Catalog" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-ui-controls"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === "quickstart" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 p-4 space-y-3 text-xs leading-relaxed text-white/80">
                <p>
                  ArtCraft exposes a fully OpenAI-compliant API powered by our high-performance native OpenRouter AI gateway. Any client, SDK, or tool that supports OpenAI can be redirected to ArtCraft by setting two variables:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg border border-ui-panel-border bg-ui-controls/40">
                    <span className="font-semibold text-white block mb-1">Base URL</span>
                    <code className="text-emerald-400 font-mono text-[11px] select-all break-all">{baseUrl}</code>
                  </div>
                  <div className="p-3 rounded-lg border border-ui-panel-border bg-ui-controls/40">
                    <span className="font-semibold text-white block mb-1">Authorization</span>
                    <code className="text-amber-300 font-mono text-[11px] select-all">Bearer &lt;your_artcraft_api_key&gt;</code>
                  </div>
                </div>
                <p className="text-white/60 pt-1">
                  Every request automatically authenticates against your ArtCraft balance, deducting credits per turn in real-time. If your balance drops to 0, simply top up with Telebirr or Chapa.
                </p>
              </div>
            )}

            {activeTab === "cursor" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 p-4 space-y-3 text-xs text-white/80">
                <p className="font-medium text-white">How to connect Cursor IDE to ArtCraft:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-white/70">
                  <li>Open <strong>Cursor Settings</strong> (gear icon) &rarr; <strong>Models</strong>.</li>
                  <li>Enable <strong>OpenAI API Key</strong> and paste your ArtCraft API Key.</li>
                  <li>Click <strong>Override OpenAI Base URL</strong> and enter <code className="text-emerald-400 font-mono">{baseUrl}</code>.</li>
                  <li>Under <strong>Model Names</strong>, add any model slug from ArtCraft, e.g. <code className="text-amber-300 font-mono">deepseek/deepseek-chat</code> or <code className="text-amber-300 font-mono">anthropic/claude-3.5-sonnet</code>.</li>
                  <li>Cursor will now run against ArtCraft with your shared ETB credit pool!</li>
                </ol>
              </div>
            )}

            {activeTab === "continue" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-medium">Add to your Continue <code>~/.continue/config.json</code>:</span>
                  <Button
                    variant="secondary"
                        className="h-7 text-xs"
                    onClick={() => copyToClipboard(continueConfigSnippet, "continue")}
                  >
                    {copiedField === "continue" ? <CheckIcon className="h-3 w-3 mr-1" /> : <CopyIcon className="h-3 w-3 mr-1" />}
                    Copy JSON
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-black/60 border border-ui-panel-border font-mono text-[11px] text-emerald-400 overflow-x-auto">
                  {continueConfigSnippet}
                </pre>
              </div>
            )}

            {activeTab === "python" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-medium">Standard OpenAI Python SDK example:</span>
                  <Button
                    variant="secondary"
                        className="h-7 text-xs"
                    onClick={() => copyToClipboard(pythonSnippet, "python")}
                  >
                    {copiedField === "python" ? <CheckIcon className="h-3 w-3 mr-1" /> : <CopyIcon className="h-3 w-3 mr-1" />}
                    Copy Python
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-black/60 border border-ui-panel-border font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  {pythonSnippet}
                </pre>
              </div>
            )}

            {activeTab === "curl" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-medium">Test from Terminal with cURL:</span>
                  <Button
                    variant="secondary"
                        className="h-7 text-xs"
                    onClick={() => copyToClipboard(curlSnippet, "curl")}
                  >
                    {copiedField === "curl" ? <CheckIcon className="h-3 w-3 mr-1" /> : <CopyIcon className="h-3 w-3 mr-1" />}
                    Copy cURL
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-black/60 border border-ui-panel-border font-mono text-[11px] text-amber-300 overflow-x-auto">
                  {curlSnippet}
                </pre>
              </div>
            )}

            {activeTab === "models" && (
              <div className="rounded-xl border border-ui-panel-border bg-ui-panel/30 overflow-hidden text-xs">
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-ui-panel/60 border-b border-ui-panel-border text-[11px] text-white/50 uppercase font-mono">
                      <tr>
                        <th className="px-4 py-2">Model Slug</th>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Family</th>
                        <th className="px-4 py-2 text-right">Price / 1M Tokens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ui-panel-border/40 font-mono text-[11px]">
                      {SUPPORTED_MODELS.map((m) => (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-2 text-emerald-400 font-semibold select-all">{m.id}</td>
                          <td className="px-4 py-2 text-white">{m.name}</td>
                          <td className="px-4 py-2 text-white/60">{m.family}</td>
                          <td className="px-4 py-2 text-right text-amber-300 font-semibold">{m.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ui-panel-border/80 px-6 py-3.5 bg-ui-panel/40 flex items-center justify-between text-xs">
          <span className="text-white/40">
            Powered by ArtCraft Native AI Gateway
          </span>
          <Button variant="secondary" onClick={onClose} className="h-8 px-4 text-xs">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

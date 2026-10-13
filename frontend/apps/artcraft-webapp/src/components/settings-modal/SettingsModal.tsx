import { useEffect, useState } from "react";
import { Modal } from "@storyteller/ui-modal";
import {
  CreditCardIcon,
  KeyIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { DynamicIcon } from "@storyteller/icons";
import { Switch } from "@storyteller/ui-switch";
import { KeybindsSettings, useKeybindsStore } from "@storyteller/keybinds";
import { useModelPickerStyleStore } from "@storyteller/ui-popover";
import { twMerge } from "tailwind-merge";
import { useEnterToGenerateStore } from "../../lib/enter-to-generate-store";
import { useLightboxSoundStore } from "../../lib/lightbox-sound-store";
import { useThemeStore } from "../../lib/theme-store";
import { useSession } from "../../lib/session";
import { AccountSection } from "./AccountSection";
import { ApiKeySection } from "./ApiKeySection";
import { BillingSection } from "./BillingSection";

type Tab = "general" | "keybinds" | "account" | "billing" | "apiKeys";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "keybinds", label: "Keybinds", icon: KeyboardIcon },
  { id: "account", label: "Account", icon: UserIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "apiKeys", label: "API Keys", icon: KeyIcon },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>("general");

  useEffect(() => {
    if (isOpen) setTab("general");
  }, [isOpen]);

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl"
      childPadding={false}
    >
      <div className="h-[100dvh] sm:h-[600px]">
        <div className="flex h-full flex-col sm:grid sm:grid-cols-12 sm:gap-3">
          <div className="relative shrink-0 border-b border-ui-panel-border p-4 sm:col-span-4 sm:border-b-0 sm:p-3 sm:pt-2 sm:after:absolute sm:after:right-0 sm:after:top-0 sm:after:h-full sm:after:w-px sm:after:bg-ui-panel-border">
            <div className="hidden items-center gap-2.5 py-0.5 sm:flex">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-base-fg/60">
                Settings
              </h2>
            </div>
            <hr className="my-2 hidden w-full border-ui-panel-border sm:block" />
            <div className="flex gap-2 overflow-x-auto pe-10 sm:block sm:space-y-1 sm:overflow-visible sm:pe-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={twMerge(
                    "h-9 shrink-0 px-3 text-left transition-colors sm:w-full sm:px-2 rounded-[3px]",
                    tab === t.id
                      ? "bg-ui-controls text-base-fg font-medium"
                      : "text-base-fg/70 hover:bg-ui-controls/60 hover:text-base-fg",
                  )}
                >
                  <div className="flex items-center gap-2.5 whitespace-nowrap text-sm">
                    <DynamicIcon icon={t.icon} />
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto sm:col-span-8 sm:h-full pl-0.5">
            <div className="w-full border-b border-ui-panel-border px-4 py-2.5 sm:px-0">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-base-fg/80">
                {activeLabel}
              </h2>
            </div>
            <div className="h-full p-4 text-sm sm:p-3 sm:ps-0">
              {tab === "general" && <GeneralPanel />}
              {tab === "keybinds" && (
                <div className="pb-4">
                  <KeybindsSettings />
                </div>
              )}
              {tab === "account" && <AccountPanel />}
              {tab === "billing" && <BillingPanel onCloseModal={onClose} />}
              {tab === "apiKeys" && <ApiKeysPanel />}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function GeneralPanel() {
  const { theme, setTheme } = useThemeStore();
  const enterToGenerate = useEnterToGenerateStore((s) => s.enabled);
  const setEnterToGenerate = useEnterToGenerateStore((s) => s.setEnabled);
  const lightboxSound = useLightboxSoundStore((s) => s.soundEnabled);
  const setLightboxSound = useLightboxSoundStore((s) => s.setSoundEnabled);
  const modelPickerStyle = useModelPickerStyleStore((s) => s.style);
  const setModelPickerStyle = useModelPickerStyleStore((s) => s.setStyle);
  const cheatsheetSticky = useKeybindsStore((s) => s.cheatsheetSticky);
  const setCheatsheetSticky = useKeybindsStore((s) => s.setCheatsheetSticky);

  return (
    <div className="space-y-5 text-base-fg">
      {/* Theme Selection */}
      <div className="flex flex-col gap-2.5 pt-3 border-b border-ui-panel-border pb-5">
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
            Appearance
          </p>
          <p className="text-xs opacity-70">
            Choose your preferred interface theme or automatically match your system appearance.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-[3px] border border-ui-panel-border bg-ui-controls p-1 w-fit">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={twMerge(
              "flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-xs font-mono transition-colors",
              theme === "dark"
                ? "bg-ui-panel text-base-fg shadow-sm font-semibold border border-ui-panel-border"
                : "text-base-fg/70 hover:text-base-fg hover:bg-ui-panel/40",
            )}
          >
            <MoonIcon className="h-3.5 w-3.5" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={twMerge(
              "flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-xs font-mono transition-colors",
              theme === "light"
                ? "bg-ui-panel text-base-fg shadow-sm font-semibold border border-ui-panel-border"
                : "text-base-fg/70 hover:text-base-fg hover:bg-ui-panel/40",
            )}
          >
            <SunIcon className="h-3.5 w-3.5" />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("system")}
            className={twMerge(
              "flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-xs font-mono transition-colors",
              theme === "system"
                ? "bg-ui-panel text-base-fg shadow-sm font-semibold border border-ui-panel-border"
                : "text-base-fg/70 hover:text-base-fg hover:bg-ui-panel/40",
            )}
          >
            <MonitorIcon className="h-3.5 w-3.5" />
            <span>System</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
            Enter to generate
          </p>
          <p className="text-xs opacity-70">
            When on, pressing Enter submits the prompt and Shift+Enter adds a
            new line. When off (default), both Enter and Shift+Enter add a new
            line, use the button to submit.
          </p>
        </div>
        <Switch
          enabled={enterToGenerate}
          setEnabled={setEnterToGenerate}
          offClassName="bg-white/20"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
            Play videos with sound
          </p>
          <p className="text-xs opacity-70">
            When on (default), videos in the media viewer start unmuted so you
            don't have to click unmute every time. When off, they start muted.
          </p>
        </div>
        <Switch
          enabled={lightboxSound}
          setEnabled={setLightboxSound}
          offClassName="bg-white/20"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">
            Group models by family
          </p>
          <p className="text-xs opacity-70">
            When on (default), the model picker groups models into submenus by
            family, like Seedance or Veo. When off, every model shows in one
            flat list.
          </p>
        </div>
        <Switch
          enabled={modelPickerStyle === "grouped"}
          setEnabled={(on) => setModelPickerStyle(on ? "grouped" : "flat")}
          offClassName="bg-white/20"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Keep shortcut cheatsheet open</p>
          <p className="text-xs opacity-70">
            In the editors, holding Ctrl (⌘ on Mac) alone for a few seconds
            shows a cheatsheet of the keyboard shortcuts. When on, it stays on
            screen after you release the key until you press Esc or click
            outside it. When off (default), it disappears as soon as you let
            go.
          </p>
        </div>
        <Switch
          enabled={cheatsheetSticky}
          setEnabled={setCheatsheetSticky}
          offClassName="bg-white/20"
        />
      </div>
    </div>
  );
}

function AccountPanel() {
  const { user, authChecked, passwordNotSet } = useSession();

  if (!authChecked) {
    return (
      <div className="pt-3 text-xs opacity-60">Loading account details...</div>
    );
  }

  if (!user) {
    return (
      <div className="pt-3 text-xs opacity-60">
        You need to be signed in to manage account settings.
      </div>
    );
  }

  return (
    <div className="pt-3">
      <AccountSection user={user} passwordNotSet={passwordNotSet} />
    </div>
  );
}

function BillingPanel({ onCloseModal }: { onCloseModal: () => void }) {
  const { user, authChecked } = useSession();

  if (!authChecked) {
    return (
      <div className="pt-3 text-xs opacity-60">Loading billing details...</div>
    );
  }

  if (!user) {
    return (
      <div className="pt-3 text-xs opacity-60">
        You need to be signed in to manage billing.
      </div>
    );
  }

  return (
    <div className="pt-3">
      <BillingSection onCloseModal={onCloseModal} />
    </div>
  );
}

function ApiKeysPanel() {
  const { user, authChecked } = useSession();

  if (!authChecked) {
    return <div className="pt-3 text-xs opacity-60">Loading API keys...</div>;
  }

  if (!user) {
    return (
      <div className="pt-3 text-xs opacity-60">
        You need to be signed in to manage API keys.
      </div>
    );
  }

  return (
    <div className="pb-4 pt-3">
      <ApiKeySection user={user} />
    </div>
  );
}

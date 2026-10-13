import { MoonIcon, SunIcon } from "lucide-react";
import { Tooltip } from "@storyteller/ui-tooltip";
import { useThemeStore } from "../../lib/theme-store";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip
      content={isDark ? "Switch to light theme" : "Switch to dark theme"}
      position="bottom"
    >
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border border-ui-border bg-ui-controls text-base-fg/80 transition-colors hover:bg-ui-controls hover:text-base-fg ${
          className || ""
        }`}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? (
          <SunIcon className="h-4 w-4 transition-transform hover:rotate-45" />
        ) : (
          <MoonIcon className="h-4 w-4 transition-transform hover:-rotate-12" />
        )}
      </button>
    </Tooltip>
  );
}

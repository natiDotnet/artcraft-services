import { LayoutGridIcon, ListIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DynamicIcon } from "@storyteller/icons";
import { Tooltip } from "@storyteller/ui-tooltip";
import {
  useGalleryViewStore,
  type GalleryViewMode,
} from "./gallery-view-store";

const OPTIONS: {
  mode: GalleryViewMode;
  icon: LucideIcon;
  label: string;
}[] = [
  { mode: "grid", icon: LayoutGridIcon, label: "Grid view" },
  { mode: "list", icon: ListIcon, label: "List view" },
];

// Segmented grid/list switch for the create-page galleries. Lives in the
// TopBar; the selection is shared with the gallery via useGalleryViewStore.
export function GalleryViewToggle() {
  const viewMode = useGalleryViewStore((s) => s.viewMode);
  const setViewMode = useGalleryViewStore((s) => s.setViewMode);

  return (
    <div
      role="group"
      aria-label="Gallery layout"
      className="flex items-center gap-0.5 rounded-lg border border-ui-border bg-ui-controls p-0.5"
    >
      {OPTIONS.map(({ mode, icon, label }) => {
        const active = viewMode === mode;
        return (
          <Tooltip key={mode} content={label} position="bottom" delay={300}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => setViewMode(mode)}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors ${
                active
                  ? "bg-ui-panel text-base-fg shadow-sm border border-ui-border font-medium"
                  : "text-base-fg/50 hover:text-base-fg hover:bg-ui-panel/50"
              }`}
            >
              <DynamicIcon icon={icon} className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

import { SquareCheckIcon } from "lucide-react";
import { Tooltip } from "@storyteller/ui-tooltip";
import { useGallerySelectionStore } from "./gallery-selection-store";

// TopBar toggle that puts the create-page gallery into multi-select mode.
// Sits next to GalleryViewToggle; the mode is shared with the gallery via
// useGallerySelectionStore.
export function GallerySelectToggle() {
  const active = useGallerySelectionStore((s) => s.active);
  const setActive = useGallerySelectionStore((s) => s.setActive);
  const label = active ? "Exit selection" : "Select items";

  return (
    <div className="flex items-center rounded-lg border border-ui-border bg-ui-controls p-0.5">
      <Tooltip content={label} position="bottom" delay={300}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={() => setActive(!active)}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-xs transition-colors ${
            active
              ? "bg-ui-panel text-base-fg shadow-sm border border-ui-border font-medium"
              : "text-base-fg/50 hover:text-base-fg hover:bg-ui-panel/50"
          }`}
        >
          <SquareCheckIcon className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

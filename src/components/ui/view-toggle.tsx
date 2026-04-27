import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/useViewMode";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ mode, onChange, className }: ViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5",
        className
      )}
      role="group"
      aria-label="Toggle view"
    >
      <Button
        type="button"
        variant={mode === "list" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2"
        onClick={() => onChange("list")}
        aria-pressed={mode === "list"}
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={mode === "grid" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2"
        onClick={() => onChange("grid")}
        aria-pressed={mode === "grid"}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}

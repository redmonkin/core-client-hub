import { useEffect, useState } from "react";

export type ViewMode = "list" | "grid";

export function useViewMode(key: string, defaultMode: ViewMode = "list"): [ViewMode, (m: ViewMode) => void] {
  const storageKey = `view-mode:${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const saved = window.localStorage.getItem(storageKey);
    return saved === "grid" || saved === "list" ? (saved as ViewMode) : defaultMode;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // ignore
    }
  }, [storageKey, mode]);

  return [mode, setMode];
}

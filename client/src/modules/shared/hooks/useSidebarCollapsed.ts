import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the dashboard sidebar is folded to its icon rail, remembered per browser.
 *
 * Read through `useSyncExternalStore` so the server and the first client render both draw the
 * expanded sidebar and the saved choice is applied afterwards, with no hydration mismatch and no
 * setState inside an effect. Storage can be blocked or throw (private windows, cleared site data),
 * so every access is wrapped and the choice falls back to memory for the rest of the visit.
 */

const STORAGE_KEY = "pms.dashboard.sidebarCollapsed";
const CHANGE_EVENT = "pms:sidebar-collapsed";

let memory = false;

const read = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage is blocked: the in-memory value is all there is.
    return memory;
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const setCollapsed = useCallback((next: boolean) => {
    memory = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // The in-memory value carries the choice.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [collapsed, setCollapsed];
}

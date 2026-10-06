"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";

export type ThemeMode = "light" | "dark" | "system";
export const themeModeKey = "avatar-ui-theme";
const changeEvent = "avatar-ui-theme-change";
const modes: { mode: ThemeMode; label: string; icon: () => React.JSX.Element }[] = [
  { mode: "light", label: "Light", icon: SunIcon },
  { mode: "system", label: "System", icon: MonitorIcon },
  { mode: "dark", label: "Dark", icon: MoonIcon },
];

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(themeModeKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changeEvent, callback); };
}
function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Light / system / dark switch for the page UI. The 3D scene backdrop has its own picker and is independent. */
export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "system" as ThemeMode);
  useEffect(() => {
    apply(mode);
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);
  const choose = useCallback((next: ThemeMode) => {
    try { localStorage.setItem(themeModeKey, next); } catch { /* storage unavailable: the choice just won't persist */ }
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  return <div className="theme-toggle" role="group" aria-label="Color theme">
    {modes.map(({ mode: value, label, icon: Glyph }) => <button key={value} type="button" title={`${label} theme`} aria-label={`${label} theme`} aria-pressed={mode === value} onClick={() => choose(value)}><Glyph /></button>)}
  </div>;
}

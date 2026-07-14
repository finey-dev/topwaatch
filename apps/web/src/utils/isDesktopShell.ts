export function isDesktopShell(): boolean {
  return import.meta.env.VITE_DESKTOP_APP === "true";
}

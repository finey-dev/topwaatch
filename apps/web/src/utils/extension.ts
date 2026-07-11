export type ExtensionStatus =
  | "unknown"
  | "failed"
  | "disallowed"
  | "noperms"
  | "outdated"
  | "success";

/** Extension removed  always report unknown/unavailable. */
export async function getExtensionState(): Promise<ExtensionStatus> {
  return "unknown";
}

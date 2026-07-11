/** Dicebear avatar helper for display names. */
export function getUserInitialFaceAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/10.x/initial-face/svg?seed=${encodeURIComponent(seed)}`;
}

export function isUserLoggedIn(hasAccount: boolean): boolean {
  return hasAccount;
}

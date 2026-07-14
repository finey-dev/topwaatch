/**
 * Scrolls an element into view with configurable options
 * @param selector - CSS selector string, Element, or null
 * @param options - Scroll options
 * @returns void (always returns, even if element not found)
 */
function queryScrollTarget(selector: string): Element | null {
  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    // HashRouter routes like #/settings are not valid querySelector input.
    if (!id || id.startsWith("/") || id.includes("/")) return null;
    if (/^[a-zA-Z][\w-]*$/.test(id)) {
      return document.getElementById(id);
    }
  }

  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

export function scrollToElement(
  selector: string | Element | null,
  options?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    offset?: number; // Additional offset in pixels (positive = scroll down more)
    delay?: number; // Delay in milliseconds before scrolling (useful when element needs to render)
  },
): void {
  const {
    behavior = "smooth",
    block = "start",
    inline = "nearest",
    offset = 0,
    delay = 0,
  } = options || {};

  const scroll = (): void => {
    let element: Element | null = null;

    if (selector === null) {
      return;
    }

    if (typeof selector === "string") {
      element = queryScrollTarget(selector);
    } else {
      element = selector;
    }

    if (!element) {
      return;
    }

    if (offset === 0) {
      // Use native scrollIntoView when no offset is needed
      element.scrollIntoView({ behavior, block, inline });
      return;
    }

    // Custom scroll with offset
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const offsetPosition = absoluteElementTop - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior,
    });
  };

  if (delay > 0) {
    setTimeout(() => {
      scroll();
    }, delay);
    return;
  }

  scroll();
}

const SETTINGS_CATEGORY_IDS = [
  "settings-account",
  "settings-preferences",
  "settings-appearance",
  "settings-captions",
  "settings-connection",
  "settings-import",
] as const;

const SETTINGS_SUB_SECTION_TO_CATEGORY: Record<string, string> = {
  "source-order": "settings-preferences",
  "topwaatch-cinema": "settings-connection",
};

/**
 * Extracts an in-page settings section id from location.hash.
 * HashRouter uses `#/settings`; section anchors are `#/settings#settings-account`
 * or plain `#settings-account` on BrowserRouter.
 */
export function getSettingsSectionIdFromHash(hash: string): string | null {
  if (!hash || hash === "#") return null;

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.startsWith("/")) {
    const nestedHash = raw.indexOf("#", 1);
    if (nestedHash === -1) return null;
    return raw.slice(nestedHash + 1) || null;
  }

  return raw;
}

export function applySettingsHashNavigation(
  hash: string,
  setSelectedCategory: (category: string) => void,
): void {
  const hashId = getSettingsSectionIdFromHash(hash);
  if (!hashId) return;

  if (SETTINGS_SUB_SECTION_TO_CATEGORY[hashId]) {
    const categoryId = SETTINGS_SUB_SECTION_TO_CATEGORY[hashId];
    setSelectedCategory(categoryId);
    scrollToHash(`#${hashId}`, { delay: 100 });
    return;
  }

  if (
    (SETTINGS_CATEGORY_IDS as readonly string[]).includes(hashId)
  ) {
    setSelectedCategory(hashId);
    scrollToHash(`#${hashId}`);
    return;
  }

  const element = queryScrollTarget(`#${hashId}`);
  if (!element) return;

  const parentSection = element.closest('[id^="settings-"]');
  if (parentSection) {
    const categoryId = parentSection.id;
    if ((SETTINGS_CATEGORY_IDS as readonly string[]).includes(categoryId)) {
      setSelectedCategory(categoryId);
      scrollToHash(`#${hashId}`, { delay: 100 });
      return;
    }
  }

  scrollToHash(`#${hashId}`);
}

/**
 * Scrolls to an element by hash (useful for hash navigation)
 * @param hash - Hash string (with or without #)
 * @param options - Scroll options
 * @returns void (always returns, even if element not found)
 */
export function scrollToHash(
  hash: string,
  options?: {
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    offset?: number;
    delay?: number;
  },
): void {
  const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
  scrollToElement(normalizedHash, options);
}

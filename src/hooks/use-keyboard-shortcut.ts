import { useEffect } from "react";

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  key: string; // The key to press (e.g., "1", "c", "f")
  meta?: boolean; // Cmd (Mac) / Ctrl (Windows/Linux)
  ctrl?: boolean; // Ctrl key
  alt?: boolean; // Alt/Option key
  shift?: boolean; // Shift key
}

/**
 * Check if a keyboard event matches the shortcut configuration
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Key match (case-insensitive for letters)
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

  // Meta key match (Cmd on Mac, Ctrl on Windows/Linux)
  const metaMatch = shortcut.meta ? (event.metaKey || event.ctrlKey) : true;

  // Ctrl key match (if specified separately)
  const ctrlMatch = shortcut.ctrl !== undefined ? event.ctrlKey === shortcut.ctrl : true;

  // Alt key match
  const altMatch = shortcut.alt !== undefined ? event.altKey === shortcut.alt : true;

  // Shift key match
  const shiftMatch = shortcut.shift !== undefined ? event.shiftKey === shortcut.shift : true;

  return keyMatch && metaMatch && ctrlMatch && altMatch && shiftMatch;
}

/**
 * Hook to register a keyboard shortcut
 *
 * @param shortcut - The keyboard shortcut configuration
 * @param handler - Function to execute when shortcut is pressed
 * @param enabled - Whether the shortcut is enabled (default: true)
 *
 * @example
 * // CMD+1 to navigate
 * useKeyboardShortcut({ key: "1", meta: true }, () => router.push("/dashboard"));
 *
 * @example
 * // C to add article
 * useKeyboardShortcut({ key: "c" }, () => setDialogOpen(true));
 *
 * @example
 * // F to favorite (only when not in input)
 * useKeyboardShortcut({ key: "f" }, handleFavorite, !isInputFocused);
 */
export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // For meta shortcuts (CMD+1, etc.), allow them even in inputs
      // For single key shortcuts (C, F), ignore them in inputs
      if (isInputElement && !shortcut.meta) {
        return;
      }

      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcut, handler, enabled]);
}

/**
 * Helper to create shortcut configuration for CMD/Ctrl + key
 */
export function metaKey(key: string): KeyboardShortcut {
  return { key, meta: true };
}

/**
 * Helper to create shortcut configuration for a single key
 */
export function singleKey(key: string): KeyboardShortcut {
  return { key };
}

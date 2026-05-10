/**
 * Session error detection and handling utilities.
 * Centralises all "Unauthorized / expired session" logic so no page
 * ever shows a raw backend error string to the user.
 */

const SESSION_PATTERNS = [
  "unauthorized",
  "invalid or expired session",
  "invalid session",
  "session expired",
  "session",
  "not authenticated",
];

/**
 * Returns true when the error string indicates a session problem.
 */
export function isSessionError(error: string): boolean {
  const lower = error.toLowerCase();
  return SESSION_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Dispatches a DOM event that App.tsx listens for, which triggers a
 * full logout + redirect to "/".  Using a CustomEvent decouples
 * individual pages from router/store imports.
 */
export function dispatchSessionExpired(): void {
  window.dispatchEvent(new CustomEvent("session-expired"));
}

/**
 * High-level handler.
 *
 *  - If the error is a session error  → dispatch session-expired event
 *    (App.tsx will clearSession + navigate to "/")
 *  - Otherwise                        → call onOtherError (show toast, etc.)
 */
export function handleSessionError(
  error: string,
  onOtherError?: (msg: string) => void,
): void {
  if (isSessionError(error)) {
    dispatchSessionExpired();
  } else {
    onOtherError?.(error);
  }
}

/**
 * Convenience wrapper for the common pattern:
 *   const res = await api.someMethod(token, ...)
 *   if (res.__kind__ === "err") { handleResultError(res.err, fallbackMsg) }
 *
 * Returns true if the result was an error (so the caller can bail out early).
 */
export function handleResultError(
  errMsg: string,
  fallbackToast: (msg: string) => void,
  fallbackMessage = "An unexpected error occurred. Please try again.",
): boolean {
  handleSessionError(errMsg, (msg) => {
    fallbackToast(msg?.trim() ? msg : fallbackMessage);
  });
  return true;
}

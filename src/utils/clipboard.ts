// Clipboard utility with auto-clear functionality

interface ClipboardOptions {
  /** Time in milliseconds after which to clear the clipboard (default: 30 seconds) */
  clearAfterMs?: number;
  /** Whether to show a success notification */
  showNotification?: boolean;
}

/**
 * Copy text to clipboard with optional auto-clear
 * @param text Text to copy to clipboard
 * @param options Configuration options
 */
export async function copyToClipboard(
  text: string,
  options: ClipboardOptions = {}
): Promise<void> {
  const { clearAfterMs = 30000, showNotification = true } = options;

  try {
    await navigator.clipboard.writeText(text);

    if (showNotification) {
      // Show temporary success indication (handled by calling components)
      // We return a cleanup function that can be used to clear early
    }

    // Set up auto-clear if enabled
    if (clearAfterMs > 0) {
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch (err) {
          // Ignore errors on clear - best effort
          console.warn('Failed to clear clipboard:', err);
        }
      }, clearAfterMs);
    }
  } catch (err) {
    throw new Error(`Failed to copy to clipboard: ${err}`);
  }
}

/**
 * Copy password to clipboard with security-focused defaults
 * Passwords are cleared from clipboard after 30 seconds by default
 */
export async function copyPasswordToClipboard(
  password: string,
  options: Omit<ClipboardOptions, 'clearAfterMs'> = {}
): Promise<void> {
  await copyToClipboard(password, {
    clearAfterMs: 30000, // 30 seconds for passwords
    ...options
  });
}

/**
 * Copy username/email to clipboard with standard defaults
 * Usernames are cleared after 60 seconds (less sensitive)
 */
export async function copyUsernameToClipboard(
  username: string,
  options: Omit<ClipboardOptions, 'clearAfterMs'> = {}
): Promise<void> {
  await copyToClipboard(username, {
    clearAfterMs: 60000, // 60 seconds for usernames
    ...options
  });
}
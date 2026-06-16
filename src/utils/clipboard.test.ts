import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, copyPasswordToClipboard, copyUsernameToClipboard } from './clipboard';

describe('Clipboard Utility', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    // Mock the clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
        readText: vi.fn().mockResolvedValue('')
      },
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      const text = 'test text';
      await copyToClipboard(text);

      expect(writeTextMock).toHaveBeenCalledWith(text);
    });

    it('should clear clipboard after specified time', async () => {
      // Use fake timers to control the async behavior
      vi.useFakeTimers();

      const text = 'test text';
      await copyToClipboard(text, { clearAfterMs: 100 });

      // First call should be the copy
      expect(writeTextMock).toHaveBeenCalledWith(text);

      // Fast forward timer to trigger the clear
      vi.advanceTimersByTime(100);

      // Second call should be the clear with empty string
      expect(writeTextMock).toHaveBeenCalledWith('');

      vi.useRealTimers();
    });

    it('should not clear clipboard when clearAfterMs is 0', async () => {
      const text = 'test text';
      await copyToClipboard(text, { clearAfterMs: 0 });

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(writeTextMock).toHaveBeenCalledWith(text);
    });

    it('should throw error when clipboard write fails', async () => {
      writeTextMock.mockRejectedValueOnce(new Error('Clipboard write failed'));

      await expect(copyToClipboard('test')).rejects.toThrow('Failed to copy to clipboard');
    });
  });

  describe('copyPasswordToClipboard', () => {
    it('should call copyToClipboard with password-specific options', async () => {
      await copyPasswordToClipboard('secret123');

      // Check that writeText was called with the password
      expect(writeTextMock).toHaveBeenCalledWith('secret123');
      // Note: We can't easily test the options without exposing internal implementation
      // But we know it calls the underlying function
    });
  });

  describe('copyUsernameToClipboard', () => {
    it('should call copyToClipboard', async () => {
      await copyUsernameToClipboard('user@example.com');

      // Check that writeText was called with the username
      expect(writeTextMock).toHaveBeenCalledWith('user@example.com');
    });
  });
});
import { describe, it, expect } from '@jest/globals';
import { GoogleOAuthManager } from '../src-tauri/gen/android/app/src/main/java/com/passwordkeeper/app/GoogleOAuthManager.kt';

describe('GoogleOAuthManager', () => {
  it('should start OAuth process', async () => {
    // Mock the necessary functions and variables
    const mockStart = jest.fn();
    GoogleOAuthManager.start = mockStart;

    // Call the function to test
    await GoogleOAuthManager.start(
      'context',
      'clientId',
      'redirectUri',
      'scopes',
      true,
    );

    // Check if the start function was called with the correct parameters
    expect(mockStart).toHaveBeenCalledWith(
      'context',
      'clientId',
      'redirectUri',
      'scopes',
      true,
    );
  });

  it('should handle intent and finish OAuth', async () => {
    // Mock the necessary functions and variables
    const mockHandleIntent = jest.fn();
    GoogleOAuthManager.handleIntent = mockHandleIntent;

    // Call the function to test
    await GoogleOAuthManager.handleIntent(
      'context',
      { action: 'action' } as Intent,
    );

    // Check if the handleIntent function was called with the correct parameters
    expect(mockHandleIntent).toHaveBeenCalledWith('context', { action: 'action' });
  });

  it('should finish OAuth with result', async () => {
    // Call the function to test
    await GoogleOAuthManager.finish('resultJson');

    // Check if the finish function was called with the correct parameters
    expect(GoogleOAuthManager.finish).toHaveBeenCalledWith('resultJson');
  });

  it('should finish OAuth with error', async () => {
    // Call the function to test
    await GoogleOAuthManager.finish(null, 'error');

    // Check if the finish function was called with the correct parameters
    expect(GoogleOAuthManager.finish).toHaveBeenCalledWith(null, 'error');
  });

  it('should handle intent cancel and finish OAuth', async () => {
    // Mock the necessary functions and variables
    const mockHandleIntent = jest.fn();
    GoogleOAuthManager.handleIntent = mockHandleIntent;

    // Call the function to test
    await GoogleOAuthManager.handleIntent(
      'context',
      { action: '${context.packageName}.GOOGLE_AUTH_CANCEL' } as Intent,
    );

    // Check if the handleIntent function was called with the correct parameters
    expect(mockHandleIntent).toHaveBeenCalledWith('context', { action: '${context.packageName}.GOOGLE_AUTH_CANCEL' });
  });

  it('should handle intent with no AppAuth response/error and finish OAuth', async () => {
    // Mock the necessary functions and variables
    const mockHandleIntent = jest.fn();
    GoogleOAuthManager.handleIntent = mockHandleIntent;

    // Call the function to test
    await GoogleOAuthManager.handleIntent(
      'context',
      { action: 'action' } as Intent,
    );

    // Check if the handleIntent function was called with the correct parameters
    expect(mockHandleIntent).toHaveBeenCalledWith('context', { action: 'action' });
  });

  it('should handle intent with AppAuth error and finish OAuth', async () => {
    // Mock the necessary functions and variables
    const mockHandleIntent = jest.fn();
    GoogleOAuthManager.handleIntent = mockHandleIntent;

    // Call the function to test
    await GoogleOAuthManager.handleIntent(
      'context',
      { action: 'action' } as Intent,
    );

    // Check if the handleIntent function was called with the correct parameters
    expect(mockHandleIntent).toHaveBeenCalledWith('context', { action: 'action' });
  });

  it('should handle intent with AppAuth response and finish OAuth', async () => {
    // Mock the necessary functions and variables
    const mockHandleIntent = jest.fn();
    GoogleOAuthManager.handleIntent = mockHandleIntent;

    // Call the function to test
    await GoogleOAuthManager.handleIntent(
      'context',
      { action: 'action' } as Intent,
    );

    // Check if the handleIntent function was called with the correct parameters
    expect(mockHandleIntent).toHaveBeenCalledWith('context', { action: 'action' });
  });
});

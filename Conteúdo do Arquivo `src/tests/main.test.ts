import { describe, it, expect } from '@jest/globals';
import { run } from '../src-tauri/src/main.rs';

describe('Main', () => {
  it('should start the application', async () => {
    // Mock the necessary functions and variables
    const mockRun = jest.fn();
    app_lib::run = mockRun;

    // Call the function to test
    await run();

    // Check if the run function was called with the correct parameters
    expect(mockRun).toHaveBeenCalled();
  });
});

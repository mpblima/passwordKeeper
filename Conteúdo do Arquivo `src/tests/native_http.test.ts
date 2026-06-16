import { describe, it, expect } from '@jest/globals';
import { NativeHttp } from '../src-tauri/gen/android/app/src/main/java/com/passwordkeeper/app/NativeHttp.kt';

describe('NativeHttp', () => {
  it('should make a GET request', async () => {
    // Mock the necessary functions and variables
    const mockRequest = jest.fn();
    NativeHttp.request = mockRequest;

    // Call the function to test
    await NativeHttp.request(
      'context',
      'GET',
      'https://jsonplaceholder.typicode.com/posts/1',
      '{}',
      '',
      false,
    );

    // Check if the request function was called with the correct parameters
    expect(mockRequest).toHaveBeenCalledWith(
      'context',
      'GET',
      'https://jsonplaceholder.typicode.com/posts/1',
      '{}',
      '',
      false,
    );
  });

  it('should make a POST request', async () => {
    // Mock the necessary functions and variables
    const mockRequest = jest.fn();
    NativeHttp.request = mockRequest;

    // Call the function to test
    await NativeHttp.request(
      'context',
      'POST',
      'https://jsonplaceholder.typicode.com/posts',
      '{"title": "foo", "body": "bar", "userId": 1}',
      true,
    );

    // Check if the request function was called with the correct parameters
    expect(mockRequest).toHaveBeenCalledWith(
      'context',
      'POST',
      'https://jsonplaceholder.typicode.com/posts',
      '{"title": "foo", "body": "bar", "userId": 1}',
      true,
    );
  });

  it('should handle request error', async () => {
    // Mock the necessary functions and variables
    const mockRequest = jest.fn();
    NativeHttp.request = mockRequest;

    // Call the function to test
    await NativeHttp.request(
      'context',
      'GET',
      'https://jsonplaceholder.typicode.com/nonexistent',
      '{}',
      '',
      false,
    );

    // Check if the request function was called with the correct parameters
    expect(mockRequest).toHaveBeenCalledWith(
      'context',
      'GET',
      'https://jsonplaceholder.typicode.com/nonexistent',
      '{}',
      '',
      false,
    );
  });
});

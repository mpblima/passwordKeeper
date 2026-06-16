import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock browser APIs for testing
// Note: Using vi from vitest for mocking

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// Mock crypto.getRandomValues
const originalGetRandomValues = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = vi.fn((array: Uint8Array) => {
  // Fill array with deterministic values for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = i + 1;
  }
  return array;
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock resizeTo for window
window.resizeTo = vi.fn();

// Mock alert
window.alert = vi.fn();

// Mock confirm
window.confirm = vi.fn().mockReturnValue(true);
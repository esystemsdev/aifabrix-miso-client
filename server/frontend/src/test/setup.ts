/**
 * Vitest setup file for frontend tests
 * Configures test environment and mocks
 */

import { vi } from 'vitest';

// Create global window object if it doesn't exist (for node environment)
if (typeof globalThis.window === 'undefined') {
  (globalThis as { window?: Window }).window = {} as Window;
}

// Mock window.location and window.history
Object.defineProperty(globalThis.window, 'location', {
  value: {
    hash: '',
    pathname: '/',
    search: '',
    protocol: 'https:',
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis.window, 'history', {
  value: {
    replaceState: vi.fn(),
    pushState: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(globalThis.window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Mock window.addEventListener and removeEventListener
globalThis.window.addEventListener = vi.fn();
globalThis.window.removeEventListener = vi.fn();

// Mock toast
(globalThis as { toast?: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> } }).toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};


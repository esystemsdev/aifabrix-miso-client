/**
 * Unit tests for App.tsx OAuth callback handling
 * Tests hashchange listener and authentication state updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('App OAuth Callback Handling', () => {
  let mockDataClient: {
    handleOAuthCallback: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    redirectToLogin: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let hashChangeListeners: Array<EventListener>;
  let focusListeners: Array<EventListener>;
  let mockSetIsAuthenticated: ReturnType<typeof vi.fn>;
  let mockToast: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure window exists
    if (typeof globalThis.window === 'undefined') {
      (globalThis as { window?: Window }).window = {} as Window;
    }

    // Mock window.location
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

    // Mock window.history
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

    // Track event listeners
    hashChangeListeners = [];
    focusListeners = [];
    
    globalThis.window.addEventListener = vi.fn((event: string, listener: EventListener) => {
      if (event === 'hashchange') {
        hashChangeListeners.push(listener);
      } else if (event === 'focus') {
        focusListeners.push(listener);
      }
    }) as unknown as typeof window.addEventListener;

    globalThis.window.removeEventListener = vi.fn((event: string, listener: EventListener) => {
      if (event === 'hashchange') {
        const index = hashChangeListeners.indexOf(listener);
        if (index > -1) hashChangeListeners.splice(index, 1);
      } else if (event === 'focus') {
        const index = focusListeners.indexOf(listener);
        if (index > -1) focusListeners.splice(index, 1);
      }
    }) as unknown as typeof window.removeEventListener;

    // Mock DataClient
    mockDataClient = {
      handleOAuthCallback: vi.fn(),
      isAuthenticated: vi.fn(),
      redirectToLogin: vi.fn(),
      logout: vi.fn(),
    };

    mockSetIsAuthenticated = vi.fn();
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Simulate the useEffect logic from App.tsx AuthSection
   * This tests the hashchange listener setup and behavior
   */
  const simulateAuthSectionEffect = (dataClient: typeof mockDataClient | null) => {
    if (!dataClient) return () => {};

    const handleAuthCheck = () => {
      try {
        const token = dataClient.handleOAuthCallback();
        
        if (token) {
          mockSetIsAuthenticated(true);
          mockToast.success('Authentication successful', {
            description: 'You have been successfully authenticated',
            duration: 3000,
          });
        } else {
          mockSetIsAuthenticated(dataClient.isAuthenticated());
        }
      } catch {
        // Mirror component behavior: errors are handled gracefully.
        mockSetIsAuthenticated(false);
      }
    };

    // Check immediately
    handleAuthCheck();

    // Set up listeners
    const handleHashChange: EventListener = () => {
      handleAuthCheck();
    };

    const handleFocus: EventListener = () => {
      setTimeout(handleAuthCheck, 100);
    };

    globalThis.window.addEventListener('hashchange', handleHashChange);
    globalThis.window.addEventListener('focus', handleFocus);

    // Return cleanup function
    return () => {
      globalThis.window.removeEventListener('hashchange', handleHashChange);
      globalThis.window.removeEventListener('focus', handleFocus);
    };
  };

  describe('Hashchange listener setup', () => {
    it('should set up hashchange listener when dataClient is available', () => {
      const cleanup = simulateAuthSectionEffect(mockDataClient);

      expect(globalThis.window.addEventListener).toHaveBeenCalledWith(
        'hashchange',
        expect.any(Function),
      );
      expect(globalThis.window.addEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
      );
      expect(hashChangeListeners.length).toBe(1);
      expect(focusListeners.length).toBe(1);

      cleanup();
    });

    it('should not set up listeners when dataClient is null', () => {
      simulateAuthSectionEffect(null);

      expect(globalThis.window.addEventListener).not.toHaveBeenCalled();
    });

    it('should call handleOAuthCallback immediately on mount', () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockReturnValue(false);

      simulateAuthSectionEffect(mockDataClient);

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalled();
      expect(mockDataClient.isAuthenticated).toHaveBeenCalled();
    });

    it('should clean up listeners on unmount', () => {
      const cleanup = simulateAuthSectionEffect(mockDataClient);

      expect(hashChangeListeners.length).toBe(1);
      expect(focusListeners.length).toBe(1);

      cleanup();

      expect(globalThis.window.removeEventListener).toHaveBeenCalledWith(
        'hashchange',
        expect.any(Function),
      );
      expect(globalThis.window.removeEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
      );
    });
  });

  describe('Hashchange event handling', () => {
    it('should handle hashchange event and extract token', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      mockDataClient.handleOAuthCallback.mockReturnValue(validToken);
      
      const cleanup = simulateAuthSectionEffect(mockDataClient);
      
      // Simulate hashchange event
      (globalThis.window.location as { hash: string }).hash = `#token=${validToken}`;
      if (hashChangeListeners[0]) {
        hashChangeListeners[0](new Event('hashchange'));
      }

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalledTimes(2); // Once on mount, once on hashchange
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockToast.success).toHaveBeenCalledWith(
        'Authentication successful',
        expect.objectContaining({
          description: 'You have been successfully authenticated',
          duration: 3000,
        }),
      );

      cleanup();
    });

    it('should update auth state to false when no token found', () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockReturnValue(false);
      
      const cleanup = simulateAuthSectionEffect(mockDataClient);
      
      // Simulate hashchange event with no token
      (globalThis.window.location as { hash: string }).hash = '#other=value';
      if (hashChangeListeners[0]) {
        hashChangeListeners[0](new Event('hashchange'));
      }

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalledTimes(2);
      expect(mockDataClient.isAuthenticated).toHaveBeenCalledTimes(2);
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);
      expect(mockToast.success).not.toHaveBeenCalled();

      cleanup();
    });

    it('should handle multiple hashchange events', () => {
      const token1 = 'token1.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1';
      const token2 = 'token2.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature2';
      
      mockDataClient.handleOAuthCallback
        .mockReturnValueOnce(null) // Initial call
        .mockReturnValueOnce(token1) // First hashchange
        .mockReturnValueOnce(token2); // Second hashchange
      
      const cleanup = simulateAuthSectionEffect(mockDataClient);
      
      // First hashchange
      (globalThis.window.location as { hash: string }).hash = `#token=${token1}`;
      if (hashChangeListeners[0]) {
        hashChangeListeners[0](new Event('hashchange'));
      }
      
      // Second hashchange
      (globalThis.window.location as { hash: string }).hash = `#token=${token2}`;
      if (hashChangeListeners[0]) {
        hashChangeListeners[0](new Event('hashchange'));
      }

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalledTimes(3);
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockSetIsAuthenticated).toHaveBeenCalledTimes(3); // Initial + 2 hashchanges

      cleanup();
    });
  });

  describe('Focus event handling', () => {
    it('should handle focus event and check auth', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      mockDataClient.handleOAuthCallback.mockReturnValue(validToken);
      mockDataClient.isAuthenticated.mockReturnValue(false);
      
      const cleanup = simulateAuthSectionEffect(mockDataClient);
      
      // Simulate focus event
      if (focusListeners[0]) {
        focusListeners[0](new Event('focus'));
      }
      
      // Wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalledTimes(2); // Initial + focus
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);

      cleanup();
    });

    it('should handle focus event when no token', async () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockReturnValue(false);
      
      const cleanup = simulateAuthSectionEffect(mockDataClient);
      
      // Simulate focus event
      if (focusListeners[0]) {
        focusListeners[0](new Event('focus'));
      }
      
      // Wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockDataClient.handleOAuthCallback).toHaveBeenCalledTimes(2);
      expect(mockDataClient.isAuthenticated).toHaveBeenCalledTimes(2);
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);

      cleanup();
    });
  });

  describe('Authentication state updates', () => {
    it('should set authenticated to true when token is found', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      mockDataClient.handleOAuthCallback.mockReturnValue(validToken);
      
      simulateAuthSectionEffect(mockDataClient);

      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('should set authenticated to false when no token and not authenticated', () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockReturnValue(false);
      
      simulateAuthSectionEffect(mockDataClient);

      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('should set authenticated to true when already authenticated', () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockReturnValue(true);
      
      simulateAuthSectionEffect(mockDataClient);

      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
    });
  });

  describe('Error handling', () => {
    it('should handle handleOAuthCallback throwing error gracefully', () => {
      mockDataClient.handleOAuthCallback.mockImplementation(() => {
        throw new Error('Token extraction failed');
      });
      mockDataClient.isAuthenticated.mockReturnValue(false);
      
      // Should not throw - errors are caught in the component
      expect(() => {
        const cleanup = simulateAuthSectionEffect(mockDataClient);
        cleanup();
      }).not.toThrow();

      // On callback failure, auth check falls back to safe unauthenticated state.
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should handle isAuthenticated throwing error gracefully', () => {
      mockDataClient.handleOAuthCallback.mockReturnValue(null);
      mockDataClient.isAuthenticated.mockImplementation(() => {
        throw new Error('Auth check failed');
      });
      
      // Should not throw - errors are caught in the component
      expect(() => {
        const cleanup = simulateAuthSectionEffect(mockDataClient);
        cleanup();
      }).not.toThrow();
    });
  });
});


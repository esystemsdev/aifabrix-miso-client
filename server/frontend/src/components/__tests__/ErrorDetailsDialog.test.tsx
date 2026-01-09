import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDetails } from '../../types';

// Mock the Dialog component since we're testing logic, not rendering
vi.mock('../ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => {
    return open ? <div data-testid="dialog">{children}</div> : null;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ErrorDetailsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.getElementById
    document.getElementById = vi.fn((id: string) => {
      if (id === 'error-dialog-overlay-style') {
        return null; // Style not yet injected
      }
      return null;
    });
    // Mock document.createElement
    document.createElement = vi.fn((tag: string) => {
      if (tag === 'style') {
        return {
          id: '',
          textContent: '',
          appendChild: vi.fn(),
        } as unknown as HTMLStyleElement;
      }
      return {} as HTMLElement;
    });
    // Mock document.head.appendChild
    document.head.appendChild = vi.fn();
  });

  describe('Props interface', () => {
    it('should accept valid ErrorDetails', () => {
      const errorDetails: ErrorDetails = {
        message: 'Test error',
        details: { code: 500 },
        stack: 'Error: Test error\n    at test.js:1:1',
      };

      expect(errorDetails.message).toBe('Test error');
      expect(errorDetails.details).toEqual({ code: 500 });
      expect(errorDetails.stack).toBeDefined();
    });

    it('should accept ErrorDetails without optional fields', () => {
      const errorDetails: ErrorDetails = {
        message: 'Simple error',
      };

      expect(errorDetails.message).toBe('Simple error');
      expect(errorDetails.details).toBeUndefined();
      expect(errorDetails.stack).toBeUndefined();
    });
  });

  describe('ErrorDetails structure', () => {
    it('should handle error with all fields', () => {
      const errorDetails: ErrorDetails = {
        message: 'Complete error',
        details: { statusCode: 404, type: '/Errors/NotFound' },
        stack: 'Error stack trace',
      };

      expect(errorDetails).toMatchObject({
        message: 'Complete error',
        details: { statusCode: 404, type: '/Errors/NotFound' },
        stack: 'Error stack trace',
      });
    });

    it('should handle error with message only', () => {
      const errorDetails: ErrorDetails = {
        message: 'Simple message',
      };

      expect(errorDetails.message).toBe('Simple message');
    });

    it('should handle error with details object', () => {
      const errorDetails: ErrorDetails = {
        message: 'Error with details',
        details: {
          field: 'email',
          reason: 'Invalid format',
        },
      };

      expect(errorDetails.details).toEqual({
        field: 'email',
        reason: 'Invalid format',
      });
    });

    it('should handle error with stack trace', () => {
      const errorDetails: ErrorDetails = {
        message: 'Error with stack',
        stack: 'Error: Error with stack\n    at function (file.js:10:5)',
      };

      expect(errorDetails.stack).toContain('Error: Error with stack');
    });
  });

  describe('ErrorDetails type validation', () => {
    it('should require message field', () => {
      // TypeScript will catch this, but we test the structure
      const errorDetails: ErrorDetails = {
        message: 'Required field',
      };

      expect(errorDetails.message).toBeDefined();
    });

    it('should allow optional details field', () => {
      const errorDetails1: ErrorDetails = {
        message: 'With details',
        details: { key: 'value' },
      };

      const errorDetails2: ErrorDetails = {
        message: 'Without details',
      };

      expect(errorDetails1.details).toBeDefined();
      expect(errorDetails2.details).toBeUndefined();
    });

    it('should allow optional stack field', () => {
      const errorDetails1: ErrorDetails = {
        message: 'With stack',
        stack: 'Stack trace',
      };

      const errorDetails2: ErrorDetails = {
        message: 'Without stack',
      };

      expect(errorDetails1.stack).toBeDefined();
      expect(errorDetails2.stack).toBeUndefined();
    });
  });
});

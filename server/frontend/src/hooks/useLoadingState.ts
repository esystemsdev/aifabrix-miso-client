import { useState } from 'react';

/**
 * Return type for useLoadingState hook
 */
export interface UseLoadingStateReturn {
  /** Whether an operation is currently loading */
  loading: boolean;
  /** Function to set loading state directly */
  setLoading: (loading: boolean) => void;
  /** Execute an async function with automatic loading state management */
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Shared loading state hook for consistent loading state management across components
 * 
 * Provides a consistent way to manage loading states with automatic state management
 * for async operations. The `withLoading` helper automatically sets loading to true
 * before execution and false after completion (success or error).
 * 
 * @returns Object containing loading state, setLoading function, and withLoading helper
 * 
 * @example
 * ```tsx
 * const { loading, withLoading } = useLoadingState();
 * 
 * const handleSubmit = async () => {
 *   await withLoading(async () => {
 *     await dataClient.post('/api/users', userData);
 *   });
 * };
 * ```
 */
export function useLoadingState(): UseLoadingStateReturn {
  const [loading, setLoading] = useState(false);
  
  /**
   * Execute an async function with automatic loading state management
   * 
   * Sets loading to true before execution and false after completion (success or error).
   * 
   * @param fn - Async function to execute
   * @returns Promise that resolves with the function's return value
   * 
   * @example
   * ```tsx
   * const result = await withLoading(async () => {
   *   return await dataClient.get('/api/users');
   * });
   * ```
   */
  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, setLoading, withLoading };
}

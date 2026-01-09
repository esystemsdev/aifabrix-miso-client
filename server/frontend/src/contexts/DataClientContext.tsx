import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { DataClient, autoInitializeDataClient } from '@aifabrix/miso-client';

/**
 * Context value for DataClient
 */
interface DataClientContextValue {
  /** DataClient instance */
  dataClient: DataClient | null;
  /** Whether DataClient is initializing */
  isLoading: boolean;
  /** Initialization error, if any */
  error: Error | null;
  /** Current retry attempt number (0 if no retries yet) */
  retryCount: number;
  /** Re-initialize DataClient with auto-config */
  reinitialize: () => Promise<void>;
  /** Set a manually created DataClient instance */
  setManualClient: (client: DataClient) => void;
}

/**
 * Context for DataClient instance
 */
const DataClientContext = createContext<DataClientContextValue | undefined>(undefined);

/**
 * Props for DataClientProvider
 */
interface DataClientProviderProps {
  /** Child components */
  children: ReactNode;
  /** Optional initialization options */
  initOptions?: {
    clientTokenUri?: string;
    baseUrl?: string;
    cacheConfig?: boolean;
  };
}

/**
 * Provider component that initializes and provides DataClient instance to all child components
 * 
 * @param props - Component props
 * @returns Provider component
 * 
 * @example
 * ```tsx
 * <DataClientProvider>
 *   <App />
 * </DataClientProvider>
 * ```
 */
export function DataClientProvider({ children, initOptions }: DataClientProviderProps) {
  const [dataClient, setDataClient] = useState<DataClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Maximum number of retry attempts for initialization
   */
  const MAX_RETRIES = 3;

  /**
   * Delay between retry attempts in milliseconds
   */
  const RETRY_DELAY = 2000;

  /**
   * Initialize DataClient with retry logic
   * 
   * Attempts to initialize the DataClient with automatic retry on failure.
   * Retries up to MAX_RETRIES times with exponential backoff.
   * 
   * @param attempt - Current retry attempt number (default: 0)
   * @returns Promise that resolves when initialization completes (success or final failure)
   */
  const initialize = async (attempt: number = 0): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const client = await autoInitializeDataClient({
        clientTokenUri: initOptions?.clientTokenUri,
        baseUrl: initOptions?.baseUrl,
        cacheConfig: initOptions?.cacheConfig ?? true,
        onError: (err) => {
          setError(err);
        },
      });
      
      setDataClient(client);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Retry logic: attempt retry if we haven't exceeded max retries
      if (attempt < MAX_RETRIES) {
        const nextAttempt = attempt + 1;
        setRetryCount(nextAttempt);
        
        // Exponential backoff: delay increases with each retry
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry initialization
        return initialize(nextAttempt);
      }
      
      // Max retries exceeded - set error and stop loading
      setError(error);
      setDataClient(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Re-initialize DataClient
   * 
   * Resets retry count and attempts to initialize DataClient again.
   * Useful for manual retry after an initialization failure.
   * 
   * @returns Promise that resolves when re-initialization completes
   */
  const reinitialize = async (): Promise<void> => {
    setRetryCount(0); // Reset retry count for manual reinitialize
    await initialize(0);
  };

  /**
   * Set a manually created DataClient instance
   * 
   * Allows setting a DataClient instance that was created outside of the provider.
   * Resets error state and retry count.
   * 
   * @param client - DataClient instance to use
   */
  const setManualClient = (client: DataClient): void => {
    setDataClient(client);
    setError(null);
    setIsLoading(false);
    setRetryCount(0);
  };

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  const value = useMemo(
    () => ({
      dataClient,
      isLoading,
      error,
      retryCount,
      reinitialize,
      setManualClient,
    }),
    [dataClient, isLoading, error, retryCount],
  );

  return (
    <DataClientContext.Provider value={value}>
      {children}
    </DataClientContext.Provider>
  );
}

/**
 * Hook to access DataClient instance from context
 * 
 * @returns DataClient context value
 * @throws Error if used outside DataClientProvider
 * 
 * @example
 * ```tsx
 * const { dataClient, isLoading, error } = useDataClient();
 * 
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!dataClient) return <div>Not initialized</div>;
 * 
 * const users = await dataClient.get('/api/users');
 * ```
 */
export function useDataClient() {
  const context = useContext(DataClientContext);
  
  if (context === undefined) {
    throw new Error('useDataClient must be used within DataClientProvider');
  }
  
  return context;
}


import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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

  /**
   * Initialize DataClient
   */
  const initialize = async () => {
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
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setDataClient(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Re-initialize DataClient
   */
  const reinitialize = async () => {
    await initialize();
  };

  /**
   * Set a manually created DataClient instance
   */
  const setManualClient = (client: DataClient) => {
    setDataClient(client);
    setError(null);
    setIsLoading(false);
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
      reinitialize,
      setManualClient,
    }),
    [dataClient, isLoading, error],
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


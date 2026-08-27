import {
  createJSONStorage,
  persist,
  PersistStorage,
  StateStorage,
  StorageValue,
} from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { StateCreator } from "zustand/vanilla";

import type { FilterQuery } from "../types/filter.types";
import type {
  PersistedRememberedFilterState,
  RememberedFilterScope,
  RememberedFilterStore,
  RememberedFilterStoreOptions,
  RememberedFilterStoreState,
} from "./remembered-filter-store.types";

const STORAGE_PREFIX = "miso:filters";
const DEFAULT_VERSION = 1;

const FALLBACK_STORAGE: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function safelyRead<T>(
  operation: () => T | PromiseLike<T>,
  fallback: T,
): T | Promise<T> {
  try {
    const result = operation();
    return isPromiseLike<T>(result)
      ? Promise.resolve(result).catch(() => fallback)
      : result;
  } catch {
    return fallback;
  }
}

function safelyWrite(operation: () => unknown): unknown {
  try {
    const result = operation();
    return isPromiseLike(result)
      ? Promise.resolve(result).catch(() => undefined)
      : result;
  } catch {
    return undefined;
  }
}

function getStateStorage(storage?: StateStorage): StateStorage {
  if (storage) return storage;

  try {
    const browserStorage = (
      globalThis as unknown as { localStorage?: StateStorage }
    ).localStorage;
    return browserStorage ?? FALLBACK_STORAGE;
  } catch {
    return FALLBACK_STORAGE;
  }
}

function createSafePersistStorage<TState>(
  stateStorage: StateStorage,
): PersistStorage<TState> {
  const jsonStorage = createJSONStorage<TState>(() => stateStorage);
  if (!jsonStorage) {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  return {
    getItem: (
      name,
    ): StorageValue<TState> | null | Promise<StorageValue<TState> | null> =>
      safelyRead(() => jsonStorage.getItem(name), null),
    setItem: (name, value): unknown =>
      safelyWrite(() => jsonStorage.setItem(name, value)),
    removeItem: (name): unknown =>
      safelyWrite(() => jsonStorage.removeItem(name)),
  };
}

function copyQuery<TQuery extends FilterQuery>(query: TQuery): TQuery {
  return JSON.parse(JSON.stringify(query)) as TQuery;
}

function requireScopePart(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return encodeURIComponent(value);
}

function isPersistedState<TQuery extends FilterQuery>(
  value: unknown,
): value is PersistedRememberedFilterState<TQuery> {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof (value as { query?: unknown }).query === "object" &&
    (value as { query?: unknown }).query !== null &&
    !Array.isArray((value as { query?: unknown }).query)
  );
}

function getVersion(version: number | undefined): number {
  const resolvedVersion = version ?? DEFAULT_VERSION;
  if (!Number.isInteger(resolvedVersion) || resolvedVersion < 0) {
    throw new Error("version must be a non-negative integer");
  }
  return resolvedVersion;
}

function createMigration<TQuery extends FilterQuery>(
  migrate: RememberedFilterStoreOptions<TQuery>["migrate"],
):
  | ((
      persistedState: unknown,
      persistedVersion: number,
    ) =>
      | PersistedRememberedFilterState<TQuery>
      | Promise<PersistedRememberedFilterState<TQuery>>)
  | undefined {
  if (!migrate) return undefined;

  return (persistedState, persistedVersion) => {
    const persistedQuery = isPersistedState<TQuery>(persistedState)
      ? persistedState.query
      : undefined;
    const migrated = migrate(persistedQuery, persistedVersion);
    return isPromiseLike<TQuery>(migrated)
      ? Promise.resolve(migrated).then((query) => ({
          query: copyQuery(query),
        }))
      : { query: copyQuery(migrated) };
  };
}

function createStateCreator<TQuery extends FilterQuery>(
  initialQuery: TQuery,
): StateCreator<
  RememberedFilterStoreState<TQuery>,
  [["zustand/persist", unknown]]
> {
  return (set) => ({
    query: copyQuery(initialQuery),
    setQuery: (query) => set({ query: copyQuery(query) }),
    patchQuery: (query) =>
      set((state) => ({
        query: copyQuery({ ...state.query, ...query } as TQuery),
      })),
    setFilters: (filters) =>
      set((state) => ({
        query: copyQuery({ ...state.query, filters } as TQuery),
      })),
    setSort: (sort) =>
      set((state) => ({
        query: copyQuery({ ...state.query, sort } as TQuery),
      })),
    setPage: (page) =>
      set((state) => ({
        query: { ...state.query, page },
      })),
    setPageSize: (pageSize) =>
      set((state) => ({
        query: { ...state.query, pageSize },
      })),
    reset: () => set({ query: copyQuery(initialQuery) }),
  });
}

/**
 * Build the stable browser-storage key used by a remembered filter store.
 * Scope values must be non-empty and must not contain secrets.
 * @param scope - Application, user, and page identifiers
 * @returns Namespaced and URL-encoded storage key
 * @throws Error when any scope value is empty
 */
export function createRememberedFilterStorageKey(
  scope: RememberedFilterScope,
): string {
  return [
    STORAGE_PREFIX,
    requireScopePart(scope.appId, "appId"),
    requireScopePart(scope.userId, "userId"),
    requireScopePart(scope.pageId, "pageId"),
  ].join(":");
}

/**
 * Create a framework-independent persistent store for one page's filters.
 * The query must be JSON-serializable and must not contain secrets.
 * @param options - Store scope, initial query, storage, and migration settings
 * @returns Vanilla Zustand store with shared filter actions and persist controls
 * @throws Error when scope values or version are invalid
 */
export function createRememberedFilterStore<
  TQuery extends FilterQuery = FilterQuery,
>(
  options: RememberedFilterStoreOptions<TQuery>,
): RememberedFilterStore<TQuery> {
  const version = getVersion(options.version);
  const storageName = createRememberedFilterStorageKey(options);
  const initialQuery = copyQuery(options.initialQuery);
  const storage = createSafePersistStorage<
    PersistedRememberedFilterState<TQuery>
  >(getStateStorage(options.storage));

  return createStore<RememberedFilterStoreState<TQuery>>()(
    persist(createStateCreator(initialQuery), {
      name: storageName,
      storage,
      version,
      migrate: createMigration(options.migrate),
      skipHydration: options.skipHydration,
      partialize: (state) => ({ query: copyQuery(state.query) }),
      merge: (persistedState, currentState) =>
        isPersistedState<TQuery>(persistedState)
          ? {
              ...currentState,
              query: copyQuery(persistedState.query),
            }
          : currentState,
    }),
  );
}

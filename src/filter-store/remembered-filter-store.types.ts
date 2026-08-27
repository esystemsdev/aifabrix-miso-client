import type { StateStorage } from "zustand/middleware";
import type { Mutate, StoreApi } from "zustand/vanilla";

import type { FilterOption, FilterQuery } from "../types/filter.types";

/**
 * Persisted portion of a remembered filter store.
 */
export interface PersistedRememberedFilterState<
  TQuery extends FilterQuery = FilterQuery,
> {
  /** Page-specific filter query saved in storage. */
  query: TQuery;
}

/**
 * State and actions shared by remembered filter stores.
 */
export interface RememberedFilterStoreState<
  TQuery extends FilterQuery = FilterQuery,
> {
  /** Current page-specific filter query. */
  query: TQuery;

  /**
   * Replace the complete query.
   * @param query - New page-specific query
   */
  setQuery(query: TQuery): void;

  /**
   * Shallow-merge fields into the current query.
   * @param query - Query fields to update
   */
  patchQuery(query: Partial<TQuery>): void;

  /**
   * Replace API filter options without changing other query fields.
   * @param filters - New filter options, or undefined to clear them
   */
  setFilters(filters: FilterOption[] | undefined): void;

  /**
   * Replace sort fields without changing other query fields.
   * @param sort - New sort fields, or undefined to clear them
   */
  setSort(sort: string[] | undefined): void;

  /**
   * Set the current page without changing other query fields.
   * @param page - One-based page number, or undefined to clear it
   */
  setPage(page: number | undefined): void;

  /**
   * Set the page size without changing other query fields.
   * @param pageSize - Number of items per page, or undefined to clear it
   */
  setPageSize(pageSize: number | undefined): void;

  /** Restore the initial query and update persisted state. */
  reset(): void;
}

/**
 * Scope used to isolate persisted filter state.
 */
export interface RememberedFilterScope {
  /** Stable, non-sensitive application identifier. */
  appId: string;

  /** Stable, non-sensitive user scope used to isolate browser state. */
  userId: string;

  /** Stable page or form identifier within the application. */
  pageId: string;
}

/**
 * Configuration for a remembered filter store.
 */
export interface RememberedFilterStoreOptions<
  TQuery extends FilterQuery = FilterQuery,
> extends RememberedFilterScope {
  /** Query restored by reset and used when no persisted state exists. */
  initialQuery: TQuery;

  /** Persisted state schema version. Defaults to 1. */
  version?: number;

  /** Optional storage implementation. Defaults to browser localStorage. */
  storage?: StateStorage;

  /** Prevent automatic hydration, for consumers that hydrate manually. */
  skipHydration?: boolean;

  /**
   * Convert a query saved by an older schema version.
   * @param persistedQuery - Previously persisted query
   * @param persistedVersion - Version associated with the persisted query
   * @returns Query compatible with the current store version
   */
  migrate?: (
    persistedQuery: unknown,
    persistedVersion: number,
  ) => TQuery | Promise<TQuery>;
}

/**
 * Vanilla Zustand store returned by createRememberedFilterStore.
 */
export type RememberedFilterStore<TQuery extends FilterQuery = FilterQuery> =
  Mutate<
    StoreApi<RememberedFilterStoreState<TQuery>>,
    [["zustand/persist", PersistedRememberedFilterState<TQuery>]]
  >;

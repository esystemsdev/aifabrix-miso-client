import type { StateStorage } from "zustand/middleware";

import {
  createRememberedFilterStorageKey,
  createRememberedFilterStore,
} from "../../src/filter-store";
import type { FilterQuery } from "../../src/types/filter.types";
import packageManifest from "../../package.json";

interface ConnectedSystemsQuery extends FilterQuery {
  search: string;
  formFilters: {
    status: string[];
    owner: string | null;
  };
}

class MemoryStorage implements StateStorage {
  readonly values = new Map<string, string>();

  getItem(name: string): string | null {
    return this.values.get(name) ?? null;
  }

  setItem(name: string, value: string): void {
    this.values.set(name, value);
  }

  removeItem(name: string): void {
    this.values.delete(name);
  }
}

const scope = {
  appId: "dataplane",
  userId: "user-123",
  pageId: "connected-systems",
};

const initialQuery: ConnectedSystemsQuery = {
  search: "",
  formFilters: {
    status: [],
    owner: null,
  },
  filters: [],
  sort: ["name"],
  page: 1,
  pageSize: 25,
};

describe("remembered filter store", () => {
  it("publishes the dedicated filter-store subpath", () => {
    expect(packageManifest.exports["./filter-store"]).toEqual({
      types: "./dist/filter-store/index.d.ts",
      import: "./dist/filter-store/index.js",
      require: "./dist/filter-store/index.js",
    });
  });

  it("creates an encoded, scoped storage key", () => {
    expect(
      createRememberedFilterStorageKey({
        appId: "data:plane",
        userId: "user/name",
        pageId: "connected systems",
      }),
    ).toBe("miso:filters:data%3Aplane:user%2Fname:connected%20systems");
  });

  it.each(["appId", "userId", "pageId"] as const)(
    "rejects an empty %s",
    (field) => {
      expect(() =>
        createRememberedFilterStorageKey({
          ...scope,
          [field]: " ",
        }),
      ).toThrow(`${field} must be a non-empty string`);
    },
  );

  it("updates a generic page query through shared actions", () => {
    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage: new MemoryStorage(),
    });

    store.getState().patchQuery({
      search: "billing",
      formFilters: { status: ["active"], owner: "user-7" },
    });
    store
      .getState()
      .setFilters([{ field: "status", op: "eq", value: "active" }]);
    store.getState().setSort(["-updatedAt"]);
    store.getState().setPage(3);
    store.getState().setPageSize(50);

    expect(store.getState().query).toEqual({
      search: "billing",
      formFilters: { status: ["active"], owner: "user-7" },
      filters: [{ field: "status", op: "eq", value: "active" }],
      sort: ["-updatedAt"],
      page: 3,
      pageSize: 50,
    });
  });

  it("defensively copies nested page-specific filter values", () => {
    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage: new MemoryStorage(),
    });
    const nextQuery: ConnectedSystemsQuery = {
      ...initialQuery,
      formFilters: { status: ["active"], owner: "user-7" },
    };

    store.getState().setQuery(nextQuery);
    nextQuery.formFilters.status.push("disabled");

    expect(store.getState().query.formFilters.status).toEqual(["active"]);
  });

  it("persists only the query and restores it for the same scope", () => {
    const storage = new MemoryStorage();
    const firstStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });

    firstStore.getState().patchQuery({ search: "remember me", page: 4 });

    const serialized = storage.getItem(createRememberedFilterStorageKey(scope));
    const persisted = JSON.parse(serialized as string) as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(Object.keys(persisted.state)).toEqual(["query"]);
    expect(persisted.version).toBe(1);

    const restoredStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });
    expect(restoredStore.getState().query.search).toBe("remember me");
    expect(restoredStore.getState().query.page).toBe(4);
  });

  it("isolates persisted state by application, user, and page", () => {
    const storage = new MemoryStorage();
    const firstStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });
    firstStore.getState().patchQuery({ search: "private scope" });

    for (const differentScope of [
      { ...scope, appId: "miso" },
      { ...scope, userId: "user-456" },
      { ...scope, pageId: "users" },
    ]) {
      const isolatedStore = createRememberedFilterStore({
        ...differentScope,
        initialQuery,
        storage,
      });
      expect(isolatedStore.getState().query.search).toBe("");
    }
  });

  it("resets to the initial query and persists the reset", () => {
    const storage = new MemoryStorage();
    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });
    store.getState().patchQuery({ search: "temporary", page: 8 });

    store.getState().reset();

    expect(store.getState().query).toEqual(initialQuery);
    const restoredStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });
    expect(restoredStore.getState().query.search).toBe("");
    expect(restoredStore.getState().query.page).toBe(1);
  });

  it("works without browser globals", () => {
    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
    });

    expect(store.getState().query.search).toBe("");
    expect(() =>
      store.getState().patchQuery({ search: "memory only" }),
    ).not.toThrow();
    expect(store.getState().query.search).toBe("memory only");
  });

  it("swallows storage failures while keeping in-memory state usable", () => {
    const throwingStorage: StateStorage = {
      getItem: () => {
        throw new Error("read denied");
      },
      setItem: () => {
        throw new Error("write denied");
      },
      removeItem: () => {
        throw new Error("remove denied");
      },
    };

    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage: throwingStorage,
    });

    expect(() =>
      store.getState().patchQuery({ search: "still works" }),
    ).not.toThrow();
    expect(() => store.persist.clearStorage()).not.toThrow();
    expect(store.getState().query.search).toBe("still works");
  });

  it("ignores malformed persisted JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(createRememberedFilterStorageKey(scope), "{not-json");

    const store = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });

    expect(store.getState().query).toEqual(initialQuery);
  });

  it("migrates a query saved by an older version", () => {
    const storage = new MemoryStorage();
    const oldStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
      version: 1,
    });
    oldStore.getState().patchQuery({ search: "legacy", pageSize: 10 });

    const migrate = jest.fn(
      (persistedQuery: unknown, persistedVersion: number) => ({
        ...(persistedQuery as ConnectedSystemsQuery),
        pageSize: 100,
        search: `${(persistedQuery as ConnectedSystemsQuery).search}-v2`,
      }),
    );
    const migratedStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
      version: 2,
      migrate,
    });

    expect(migrate).toHaveBeenCalledWith(
      expect.objectContaining({ search: "legacy", pageSize: 10 }),
      1,
    );
    expect(migratedStore.getState().query.search).toBe("legacy-v2");
    expect(migratedStore.getState().query.pageSize).toBe(100);
  });

  it("supports manual hydration", () => {
    const storage = new MemoryStorage();
    const storedStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
    });
    storedStore.getState().patchQuery({ search: "hydrate later" });

    const manualStore = createRememberedFilterStore({
      ...scope,
      initialQuery,
      storage,
      skipHydration: true,
    });
    expect(manualStore.getState().query.search).toBe("");

    manualStore.persist.rehydrate();

    expect(manualStore.getState().query.search).toBe("hydrate later");
  });

  it("rejects invalid versions", () => {
    expect(() =>
      createRememberedFilterStore({
        ...scope,
        initialQuery,
        version: -1,
      }),
    ).toThrow("version must be a non-negative integer");
  });
});

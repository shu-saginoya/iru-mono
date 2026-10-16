import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as itemCache from "./item-cache";
import {
  dashboardQueryKeys,
  fetchAllItems,
  persistItemsFromQueryCache,
  rollbackItemCreate,
  rollbackItemDelete,
  rollbackItemEdit,
  rollbackItemToggle,
  rollbackListCreate,
  rollbackListUpdate,
} from "./dashboard-queries";
import type { Item } from "./item-state";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dashboard query keys", () => {
  it("separates item caches by user and list", () => {
    expect(dashboardQueryKeys.items("user-a", "list-1")).not.toEqual(
      dashboardQueryKeys.items("user-b", "list-1"),
    );
    expect(dashboardQueryKeys.items("user-a", "list-1")).not.toEqual(
      dashboardQueryKeys.items("user-a", "list-2"),
    );
  });
});

describe("fetchAllItems", () => {
  it("combines all API pages into one item list", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `item-${index}`,
      title: `item ${index}`,
      quantity: 1,
      is_completed: false,
    }));
    const secondPage = [
      {
        id: "item-100",
        title: "item 100",
        quantity: 1,
        is_completed: false,
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: firstPage,
          pagination: { total: 101 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: secondPage,
          pagination: { total: 101 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllItems("user-a", "list-1")).resolves.toEqual([
      ...firstPage,
      ...secondPage,
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/lists/list-1/items?status=all&limit=100&offset=0",
      { signal: undefined },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/lists/list-1/items?status=all&limit=100&offset=100",
      { signal: undefined },
    );
  });

  it("skips cache writes when an in-flight fetch is aborted", async () => {
    const controller = new AbortController();
    const writeSpy = vi.spyOn(itemCache, "writeItemCache").mockResolvedValue();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return {
        ok: true,
        json: async () => ({
          items: [{ id: "item-1", title: "milk", quantity: 1, is_completed: false }],
          pagination: { total: 1 },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAllItems("user-a", "list-1", controller.signal),
    ).rejects.toThrow(/AbortError|aborted/i);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("does not return data when the fetch is aborted during cache persistence", async () => {
    const controller = new AbortController();
    const writeSpy = vi
      .spyOn(itemCache, "writeItemCache")
      .mockImplementation(async () => {
        controller.abort();
      });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ id: "item-1", title: "milk", quantity: 1, is_completed: false }],
          pagination: { total: 1 },
        }),
      }),
    );

    await expect(
      fetchAllItems("user-a", "list-1", controller.signal),
    ).rejects.toThrow(/AbortError|aborted/i);
    expect(writeSpy).toHaveBeenCalledOnce();
  });
});

describe("persistItemsFromQueryCache", () => {
  it("persists the settled query data for its user and list", async () => {
    const queryClient = new QueryClient();
    const items: Item[] = [
      { id: "item-1", title: "milk", quantity: 1, is_completed: false },
    ];
    queryClient.setQueryData(dashboardQueryKeys.items("user-a", "list-1"), items);
    const writeSpy = vi.spyOn(itemCache, "writeItemCache").mockResolvedValue();

    await persistItemsFromQueryCache(queryClient, "user-a", "list-1");

    expect(writeSpy).toHaveBeenCalledWith("user-a", "list-1", items);
    queryClient.clear();
  });

  it("does not overwrite persistent data when the query has no data", async () => {
    const queryClient = new QueryClient();
    const writeSpy = vi.spyOn(itemCache, "writeItemCache").mockResolvedValue();

    await persistItemsFromQueryCache(queryClient, "user-a", "list-1");

    expect(writeSpy).not.toHaveBeenCalled();
    queryClient.clear();
  });
});

describe("optimistic mutation rollback", () => {
  const first: Item = {
    id: "item-1",
    title: "milk",
    quantity: 1,
    is_completed: false,
  };
  const second: Item = {
    id: "item-2",
    title: "eggs",
    quantity: 2,
    is_completed: false,
  };

  it("rolls back only the failed item when another toggle succeeds", () => {
    const optimisticallyUpdated = [
      { ...first, is_completed: true },
      { ...second, is_completed: true },
    ];

    expect(rollbackItemToggle(optimisticallyUpdated, first)).toEqual([
      first,
      { ...second, is_completed: true },
    ]);
  });

  it("preserves other item changes when an item creation fails", () => {
    expect(
      rollbackItemCreate(
        [{ ...first, id: "optimistic-item" }, { ...second, title: "changed" }],
        "optimistic-item",
      ),
    ).toEqual([{ ...second, title: "changed" }]);
  });

  it("restores edited fields without reverting another item's changes", () => {
    expect(
      rollbackItemEdit(
        [{ ...first, title: "optimistic name" }, { ...second, quantity: 4 }],
        first,
      ),
    ).toEqual([first, { ...second, quantity: 4 }]);
  });

  it("restores a deleted item without replacing concurrent item changes", () => {
    expect(
      rollbackItemDelete([{ ...second, title: "changed" }], first, 0),
    ).toEqual([first, { ...second, title: "changed" }]);
  });

  it("rolls back only the affected list", () => {
    const lists = [
      { id: "list-1", name: "optimistic name" },
      { id: "list-2", name: "changed name" },
    ];

    expect(
      rollbackListCreate(
        [{ id: "optimistic-list", name: "new list" }, ...lists],
        "optimistic-list",
      ),
    ).toEqual(lists);
    expect(rollbackListUpdate(lists, "list-1", "old name")).toEqual([
      { id: "list-1", name: "old name" },
      { id: "list-2", name: "changed name" },
    ]);
  });
});

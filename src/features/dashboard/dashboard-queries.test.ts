import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dashboardQueryKeys,
  fetchAllItems,
} from "./dashboard-queries";

afterEach(() => {
  vi.unstubAllGlobals();
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

    await expect(fetchAllItems("list-1")).resolves.toEqual([
      ...firstPage,
      ...secondPage,
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/lists/list-1/items?status=all&limit=100&offset=0",
      {},
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/lists/list-1/items?status=all&limit=100&offset=100",
      {},
    );
  });
});

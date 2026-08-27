import { describe, expect, it } from "vitest";
import {
  rollbackItemMutation,
  toggleItemOptimistically,
  type Item,
} from "./item-state";

const pendingItem: Item = {
  id: "item-1",
  title: "牛乳",
  quantity: 1,
  is_completed: false,
};

describe("item optimistic state", () => {
  it("removes a completed item from the pending view immediately", () => {
    const result = toggleItemOptimistically([pendingItem], "item-1");

    expect(result.items).toEqual([{ ...pendingItem, is_completed: true }]);
    expect(result.snapshot).toEqual({ item: pendingItem, index: 0 });
  });

  it("restores the item at its original position on rollback", () => {
    const otherItem = { ...pendingItem, id: "item-2", title: "卵" };
    const result = toggleItemOptimistically([pendingItem, otherItem], "item-1");

    expect(result.snapshot).not.toBeNull();
    expect(rollbackItemMutation(result.items, result.snapshot!)).toEqual([
      pendingItem,
      otherItem,
    ]);
  });

  it("updates an item in place when it remains in the current view", () => {
    const completedItem = { ...pendingItem, is_completed: true };
    const result = toggleItemOptimistically([completedItem], "item-1");

    expect(result.items).toEqual([{ ...completedItem, is_completed: false }]);
  });
});

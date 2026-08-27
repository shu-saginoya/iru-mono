export type Item = {
  id: string;
  title: string;
  quantity: number;
  is_completed: boolean;
};

export type ItemMutationSnapshot = {
  item: Item;
  index: number;
};

export function toggleItemOptimistically(items: Item[], itemId: string) {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return { items, snapshot: null };

  const item = items[index];
  const updatedItem = { ...item, is_completed: !item.is_completed };
  const nextItems = items.map((current, currentIndex) =>
    currentIndex === index ? updatedItem : current,
  );

  return {
    items: nextItems,
    snapshot: { item, index } satisfies ItemMutationSnapshot,
  };
}

export function rollbackItemMutation(
  items: Item[],
  snapshot: ItemMutationSnapshot,
) {
  if (items.some((item) => item.id === snapshot.item.id)) {
    return items.map((item) =>
      item.id === snapshot.item.id ? snapshot.item : item,
    );
  }

  const restoredItems = [...items];
  restoredItems.splice(snapshot.index, 0, snapshot.item);
  return restoredItems;
}

export function replaceItem(items: Item[], itemId: string, replacement: Item) {
  return items.map((item) => (item.id === itemId ? replacement : item));
}

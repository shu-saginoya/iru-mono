import type { Item } from "./item-state";

const databaseName = "iru-mono";
const databaseVersion = 1;
const storeName = "item-cache";

type ItemCacheRecord = {
  userId: string;
  listId: string;
  items: Item[];
  updatedAt: number;
};

function getDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, {
          keyPath: ["userId", "listId"],
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB error"));
  });
}

export async function readItemCache(userId: string, listId: string) {
  try {
    const database = await getDatabase();
    return await new Promise<Item[] | null>((resolve, reject) => {
      const request = database
        .transaction(storeName, "readonly")
        .objectStore(storeName)
        .get([userId, listId]);
      request.onsuccess = () => {
        const record = request.result as ItemCacheRecord | undefined;
        resolve(record?.items ?? null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB error"));
    });
  } catch {
    return null;
  }
}

export async function writeItemCache(
  userId: string,
  listId: string,
  items: Item[],
) {
  try {
    const database = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put({
        userId,
        listId,
        items,
        updatedAt: Date.now(),
      } satisfies ItemCacheRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB error"));
    });
  } catch {
    // IndexedDB is an enhancement; API data remains authoritative.
  }
}

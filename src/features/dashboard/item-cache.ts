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
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB error"));
  });
}

export async function readItemCache(userId: string, listId: string) {
  try {
    const database = await getDatabase();
    return await new Promise<Item[] | null>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get([userId, listId]);
      let items: Item[] | null = null;
      request.onsuccess = () => {
        const record = request.result as ItemCacheRecord | undefined;
        items = record?.items ?? null;
      };
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB error"));
      transaction.oncomplete = () => {
        database.close();
        resolve(items);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB error"));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
  } catch (error) {
    console.warn("Unable to read cached items from IndexedDB", error);
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
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB error"));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
  } catch (error) {
    console.warn("Unable to persist cached items to IndexedDB", error);
  }
}

export async function clearItemCacheForUser(userId: string) {
  const database = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as ItemCacheRecord;
      if (record.userId === userId) cursor.delete();
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB error"));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB error"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}

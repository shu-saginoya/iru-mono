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
    let blocked = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, {
          keyPath: ["userId", "listId"],
        });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error("IndexedDB is blocked by another connection"));
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB error"));
  });
}

export async function readItemCache(userId: string, listId: string) {
  try {
    const database = await getDatabase();
    try {
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
        transaction.oncomplete = () => resolve(items);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("IndexedDB error"));
        transaction.onabort = () =>
          reject(
            transaction.error ?? new Error("IndexedDB transaction aborted"),
          );
      });
    } finally {
      database.close();
    }
  } catch (error) {
    console.warn("Unable to read cached items from IndexedDB", error);
    return null;
  }
}

export async function writeItemCache(
  userId: string,
  listId: string,
  items: Item[],
  signal?: AbortSignal,
) {
  try {
    const database = await getDatabase();
    try {
      if (signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const abortTransaction = () => transaction.abort();
        const cleanup = () =>
          signal?.removeEventListener("abort", abortTransaction);
        transaction.oncomplete = () => {
          cleanup();
          resolve();
        };
        transaction.onerror = () => {
          cleanup();
          reject(transaction.error ?? new Error("IndexedDB error"));
        };
        transaction.onabort = () => {
          cleanup();
          reject(
            signal?.aborted
              ? new DOMException("The operation was aborted", "AbortError")
              : (transaction.error ??
                  new Error("IndexedDB transaction aborted")),
          );
        };
        signal?.addEventListener("abort", abortTransaction, { once: true });
        if (signal?.aborted) {
          abortTransaction();
          return;
        }
        try {
          transaction.objectStore(storeName).put({
            userId,
            listId,
            items,
            updatedAt: Date.now(),
          } satisfies ItemCacheRecord);
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    } finally {
      database.close();
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn("Unable to persist cached items to IndexedDB", error);
  }
}

export async function clearItemCacheForUser(userId: string) {
  if (typeof indexedDB === "undefined") return;
  const database = await getDatabase();
  try {
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
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB error"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
  } finally {
    database.close();
  }
}

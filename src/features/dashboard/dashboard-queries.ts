"use client";

import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { readItemCache, writeItemCache } from "@/features/dashboard/item-cache";
import type { Item } from "@/features/dashboard/item-state";

export type ShoppingList = { id: string; name: string };
export type ListDetails = { id: string; name: string; created_by: string };
export type Member = {
  user_id: string;
  joined_at: string;
  users: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
};
export type Invitation = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  list: { name: string } | null;
};

export const dashboardQueryKeys = {
  lists: (userId: string) => ["dashboard", userId, "lists"] as const,
  invitations: (userId: string) =>
    ["dashboard", userId, "invitations"] as const,
  listDetails: (userId: string, listId: string) =>
    ["dashboard", userId, "lists", listId, "details"] as const,
  items: (userId: string, listId: string) =>
    ["dashboard", userId, "lists", listId, "items", "all"] as const,
};

export const dashboardMutationKeys = {
  lists: (userId: string) =>
    ["dashboard", userId, "mutations", "lists"] as const,
  items: (userId: string) =>
    ["dashboard", userId, "mutations", "items"] as const,
  saveItem: (userId: string) =>
    [...dashboardMutationKeys.items(userId), "save"] as const,
  toggleItem: (userId: string) =>
    [...dashboardMutationKeys.items(userId), "toggle"] as const,
  deleteItem: (userId: string) =>
    [...dashboardMutationKeys.items(userId), "delete"] as const,
};

async function getRequestError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string; code?: string };
    return data.code
      ? `${data.error ?? fallback} (${data.code})`
      : (data.error ?? fallback);
  } catch {
    return fallback;
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: string,
) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("通信に失敗しました。接続を確認してください");
  }
  if (!response.ok) throw new Error(await getRequestError(response, fallback));
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
}

async function requestEmpty(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: string,
) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("通信に失敗しました。接続を確認してください");
  }
  if (!response.ok) throw new Error(await getRequestError(response, fallback));
}

export async function fetchAllItems(
  userId: string,
  listId: string,
  signal?: AbortSignal,
) {
  const pageSize = 100;
  const items: Item[] = [];
  let offset = 0;
  let total = 0;

  do {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }
    const data = await requestJson<{
      items: Item[];
      pagination: { total: number };
    }>(
      `/lists/${listId}/items?status=all&limit=${pageSize}&offset=${offset}`,
      { signal },
      "アイテムを取得できませんでした",
    );
    items.push(...data.items);
    total = data.pagination.total;
    offset += data.items.length;
    if (!data.items.length) break;
  } while (offset < total);

  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }

  await writeItemCache(userId, listId, items, signal);
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }
  return items;
}

function mutationKeyMatches(
  candidate: readonly unknown[] | undefined,
  prefix: readonly unknown[],
) {
  return prefix.every((part, index) => candidate?.[index] === part);
}

async function invalidateAfterMutationsSettle(
  queryClient: QueryClient,
  mutationKey: readonly unknown[],
  queryKey: readonly unknown[],
  matchesVariables: (variables: unknown) => boolean = () => true,
  afterInvalidation?: () => Promise<void>,
) {
  const countPendingMutations = () =>
    queryClient
      .getMutationCache()
      .getAll()
      .filter(
      (mutation) =>
        mutation.state.status === "pending" &&
        mutationKeyMatches(mutation.options.mutationKey, mutationKey) &&
        matchesVariables(mutation.state.variables),
      ).length;
  const initialPendingCount = countPendingMutations();
  if (initialPendingCount <= 1) {
    await queryClient.invalidateQueries({
      queryKey,
      exact: true,
      refetchType: "all",
    });
    if (countPendingMutations() <= 1) await afterInvalidation?.();
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (countPendingMutations() <= 1) {
    await queryClient.invalidateQueries({
      queryKey,
      exact: true,
      refetchType: "all",
    });
    if (countPendingMutations() <= 1) await afterInvalidation?.();
  }
}

function mutationHasListId(variables: unknown, listId: string) {
  return (
    typeof variables === "object" &&
    variables !== null &&
    "listId" in variables &&
    variables.listId === listId
  );
}

export function rollbackItemCreate(items: Item[], optimisticId: string) {
  return items.filter((item) => item.id !== optimisticId);
}

export function rollbackItemEdit(items: Item[], previousItem: Item) {
  return items.map((item) =>
    item.id === previousItem.id
      ? {
          ...item,
          title: previousItem.title,
          quantity: previousItem.quantity,
        }
      : item,
  );
}

export function rollbackItemToggle(items: Item[], previousItem: Item) {
  return items.map((item) =>
    item.id === previousItem.id
      ? { ...item, is_completed: previousItem.is_completed }
      : item,
  );
}

export function rollbackItemDelete(
  items: Item[],
  deletedItem: Item,
  previousIndex: number,
) {
  if (items.some((item) => item.id === deletedItem.id)) return items;
  const restored = [...items];
  restored.splice(Math.min(previousIndex, restored.length), 0, deletedItem);
  return restored;
}

export function rollbackListCreate(
  lists: ShoppingList[],
  optimisticId: string,
) {
  return lists.filter((list) => list.id !== optimisticId);
}

export function rollbackListUpdate(
  lists: ShoppingList[],
  listId: string,
  previousName: string,
) {
  return lists.map((list) =>
    list.id === listId ? { ...list, name: previousName } : list,
  );
}

function restoreListAtIndex(
  lists: ShoppingList[],
  previousList: ShoppingList,
  previousIndex: number,
) {
  if (lists.some((list) => list.id === previousList.id)) return lists;
  const restored = [...lists];
  restored.splice(Math.min(previousIndex, restored.length), 0, previousList);
  return restored;
}

function replaceItem(items: Item[], itemId: string, replacement: Item) {
  return items.map((item) => (item.id === itemId ? replacement : item));
}

function withItems(
  queryClient: QueryClient,
  userId: string,
  listId: string,
  update: (items: Item[]) => Item[],
) {
  const key = dashboardQueryKeys.items(userId, listId);
  const previousItems = queryClient.getQueryData<Item[]>(key) ?? [];
  const nextItems = update(previousItems);
  queryClient.setQueryData(key, nextItems);
  return previousItems;
}

export async function persistItemsFromQueryCache(
  queryClient: QueryClient,
  userId: string,
  listId: string,
) {
  const items = queryClient.getQueryData<Item[]>(
    dashboardQueryKeys.items(userId, listId),
  );
  if (items !== undefined) await writeItemCache(userId, listId, items);
}

export function useDashboardListsQuery(userId: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.lists(userId),
    queryFn: () =>
      requestJson<{ lists: ShoppingList[] }>(
        "/lists",
        {},
        "リストを取得できませんでした",
      ).then((data) => data.lists),
  });
}

export function useInvitationsQuery(userId: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.invitations(userId),
    queryFn: () =>
      requestJson<{ invitations: Invitation[] }>(
        "/invitations",
        {},
        "招待を取得できませんでした",
      ).then((data) => data.invitations),
  });
}

export function useListDetailsQuery(userId: string, listId: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.listDetails(userId, listId),
    queryFn: () =>
      requestJson<{ list: ListDetails; members: Member[] }>(
        `/lists/${listId}`,
        {},
        "リスト情報を取得できませんでした",
      ),
    enabled: Boolean(listId),
  });
}

export function useItemsQuery(userId: string, listId: string) {
  const queryClient = useQueryClient();
  const queryKey = dashboardQueryKeys.items(userId, listId);
  const cacheIdentity = JSON.stringify([userId, listId]);
  const [restoredCacheIdentity, setRestoredCacheIdentity] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;
    if (!listId) return;
    const cacheKey = dashboardQueryKeys.items(userId, listId);

    void readItemCache(userId, listId).then((cachedItems) => {
      if (active && cachedItems && !queryClient.getQueryData(cacheKey)) {
        // updatedAt: 0 で古いデータ扱いにし、表示後にAPIと同期する
        queryClient.setQueryData(cacheKey, cachedItems, { updatedAt: 0 });
      }
      if (active) setRestoredCacheIdentity(cacheIdentity);
    });

    return () => {
      active = false;
    };
  }, [cacheIdentity, listId, queryClient, userId]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAllItems(userId, listId, signal),
    enabled: Boolean(listId) && restoredCacheIdentity === cacheIdentity,
  });

  return {
    ...query,
    isCacheRestoring:
      Boolean(listId) && restoredCacheIdentity !== cacheIdentity,
  };
}

export function useDashboardMutations(userId: string) {
  const queryClient = useQueryClient();
  const listsKey = dashboardQueryKeys.lists(userId);
  const pendingItemIds = useMutationState<unknown>({
    filters: {
      mutationKey: ["dashboard", userId, "mutations"],
      status: "pending",
    },
    select: (mutation) => mutation.state.variables,
  })
    .map((variables) => {
      if (!variables || typeof variables !== "object") return null;
      const operation = variables as {
        listId?: unknown;
        item?: { id?: unknown };
        itemId?: unknown;
      };
      const itemId = operation.item?.id ?? operation.itemId;
      return typeof operation.listId === "string" && typeof itemId === "string"
        ? { listId: operation.listId, itemId }
        : null;
    })
    .filter(
      (entry): entry is { listId: string; itemId: string } => entry !== null,
    );

  const createList = useMutation({
    mutationKey: dashboardMutationKeys.lists(userId),
    mutationFn: (name: string) =>
      requestJson<{ list: ShoppingList }>(
        "/lists",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        "リストを作成できませんでした",
      ).then((data) => data.list),
    onMutate: async (name) => {
        await queryClient.cancelQueries({ queryKey: listsKey, exact: true });
        const optimistic = { id: `optimistic-${crypto.randomUUID()}`, name: name.trim() };
        queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) => [
          optimistic,
          ...lists,
        ]);
        return { optimisticId: optimistic.id };
      },
      onError: (_error, _name, context) => {
        if (!context) return;
        queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
          rollbackListCreate(lists, context.optimisticId),
        );
    },
    onSuccess: (list, _name, context) => {
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.map((current) =>
          current.id === context?.optimisticId ? list : current,
        ),
      );
    },
    onSettled: () =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.lists(userId),
        listsKey,
      ),
  });

  const saveItem = useMutation({
    mutationKey: dashboardMutationKeys.saveItem(userId),
    mutationFn: ({
      listId,
      item,
    }: {
      listId: string;
      item: Pick<Item, "title" | "quantity"> & { id?: string };
    }) =>
      requestJson<{ item: Item }>(
        item.id ? `/lists/${listId}/items/${item.id}` : `/lists/${listId}/items`,
        {
          method: item.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title, quantity: item.quantity }),
        },
        item.id ? "アイテムを編集できませんでした" : "アイテムを追加できませんでした",
      ).then((data) => data.item),
    onMutate: async ({ listId, item }) => {
      const key = dashboardQueryKeys.items(userId, listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousItems =
        queryClient.getQueryData<Item[]>(key) ?? [];
      const previousItem = item.id
        ? previousItems.find((current) => current.id === item.id)
        : undefined;
      const optimisticId = item.id ?? `optimistic-${crypto.randomUUID()}`;
      withItems(queryClient, userId, listId, (items) =>
        item.id
          ? items.map((current) =>
              current.id === item.id
                ? { ...current, title: item.title.trim(), quantity: item.quantity }
                : current,
            )
          : [
              {
                id: optimisticId,
                title: item.title.trim(),
                quantity: item.quantity,
                is_completed: false,
              },
              ...items,
            ],
      );
      return { key, optimisticId, previousItem };
    },
    onError: (_error, variables, context) => {
      if (!context) return;
      queryClient.setQueryData<Item[]>(context.key, (items = []) =>
        variables.item.id
          ? context.previousItem
            ? rollbackItemEdit(items, context.previousItem)
            : items
          : rollbackItemCreate(items, context.optimisticId),
      );
    },
    onSuccess: (item, variables, context) => {
      if (!context) return;
      queryClient.setQueryData<Item[]>(context.key, (items = []) =>
        replaceItem(items, variables.item.id ?? context.optimisticId, item),
      );
    },
    onSettled: (_data, _error, variables) =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.items(userId),
        dashboardQueryKeys.items(userId, variables.listId),
        (pendingVariables) =>
          mutationHasListId(pendingVariables, variables.listId),
        () => persistItemsFromQueryCache(queryClient, userId, variables.listId),
      ),
  });

  const toggleItem = useMutation({
    mutationKey: dashboardMutationKeys.toggleItem(userId),
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      requestJson<{ item: Item }>(
        `/lists/${listId}/items/${itemId}/toggle`,
        { method: "PATCH" },
        "アイテムの状態を変更できませんでした",
      ).then((data) => data.item),
    onMutate: async ({ listId, itemId }) => {
      const key = dashboardQueryKeys.items(userId, listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousItem = queryClient
        .getQueryData<Item[]>(key)
        ?.find((item) => item.id === itemId);
      withItems(queryClient, userId, listId, (items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, is_completed: !item.is_completed } : item,
        ),
      );
      return { previousItem, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItem) {
        queryClient.setQueryData<Item[]>(context.key, (items = []) =>
          rollbackItemToggle(items, context.previousItem!),
        );
      }
    },
    onSuccess: (item, variables) => {
      queryClient.setQueryData<Item[]>(
        dashboardQueryKeys.items(userId, variables.listId),
        (items = []) => replaceItem(items, variables.itemId, item),
      );
    },
    onSettled: (_data, _error, variables) =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.items(userId),
        dashboardQueryKeys.items(userId, variables.listId),
        (pendingVariables) =>
          mutationHasListId(pendingVariables, variables.listId),
        () => persistItemsFromQueryCache(queryClient, userId, variables.listId),
      ),
  });

  const deleteItem = useMutation({
    mutationKey: dashboardMutationKeys.deleteItem(userId),
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      requestEmpty(
        `/lists/${listId}/items/${itemId}`,
        { method: "DELETE" },
        "アイテムを削除できませんでした",
      ),
    onMutate: async ({ listId, itemId }) => {
      const key = dashboardQueryKeys.items(userId, listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previousItems = queryClient.getQueryData<Item[]>(key) ?? [];
      const previousIndex = previousItems.findIndex(
        (item) => item.id === itemId,
      );
      const deletedItem = previousItems[previousIndex];
      withItems(queryClient, userId, listId, (items) =>
        items.filter((item) => item.id !== itemId),
      );
      return { deletedItem, previousIndex, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.deletedItem && context.previousIndex >= 0) {
        queryClient.setQueryData<Item[]>(context.key, (items = []) =>
          rollbackItemDelete(
            items,
            context.deletedItem!,
            context.previousIndex,
          ),
        );
      }
    },
    onSettled: (_data, _error, variables) =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.items(userId),
        dashboardQueryKeys.items(userId, variables.listId),
        (pendingVariables) =>
          mutationHasListId(pendingVariables, variables.listId),
        () => persistItemsFromQueryCache(queryClient, userId, variables.listId),
      ),
  });

  const updateList = useMutation({
    mutationKey: dashboardMutationKeys.lists(userId),
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      requestJson<{ list: ShoppingList }>(
        `/lists/${listId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        "リスト名を変更できませんでした",
      ).then((data) => data.list),
    onMutate: async ({ listId, name }) => {
      const detailsKey = dashboardQueryKeys.listDetails(userId, listId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listsKey, exact: true }),
        queryClient.cancelQueries({ queryKey: detailsKey }),
      ]);
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      const previousList = previousLists.find((list) => list.id === listId);
      const previousDetails = queryClient.getQueryData<{
        list: ListDetails;
        members: Member[];
      }>(detailsKey);
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.map((list) =>
          list.id === listId ? { ...list, name: name.trim() } : list,
        ),
      );
      queryClient.setQueryData(detailsKey, (details: typeof previousDetails) =>
        details
          ? { ...details, list: { ...details.list, name: name.trim() } }
          : details,
      );
      return {
        previousList,
        previousDetails,
        detailsKey,
        previousListName: previousList?.name,
        previousDetailsName: previousDetails?.list.name,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousList) {
        queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
          lists.map((list) =>
            list.id === context.previousList!.id && context.previousListName
              ? { ...list, name: context.previousListName }
              : list,
          ),
        );
      }
      if (context.previousDetails && context.previousDetailsName) {
        queryClient.setQueryData(
          context.detailsKey,
          (details: typeof context.previousDetails) =>
            details
              ? {
                  ...details,
                  list: {
                    ...details.list,
                    name: context.previousDetailsName!,
                  },
                }
              : details,
        );
      }
    },
    onSuccess: (list, variables) => {
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.map((current) => (current.id === list.id ? list : current)),
      );
      queryClient.setQueryData(
        dashboardQueryKeys.listDetails(userId, variables.listId),
        (details: { list: ListDetails; members: Member[] } | undefined) =>
          details
            ? { ...details, list: { ...details.list, name: list.name } }
            : details,
      );
    },
    onSettled: (_data, _error, variables) =>
      Promise.all([
        invalidateAfterMutationsSettle(
          queryClient,
          dashboardMutationKeys.lists(userId),
          listsKey,
        ),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.listDetails(userId, variables.listId),
          exact: true,
          refetchType: "all",
        }),
      ]),
  });

  const createInvitation = useMutation({
    mutationFn: ({ listId, email }: { listId: string; email: string }) =>
      requestJson<{ invitation: { url: string } }>(
        `/lists/${listId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        "招待を送信できませんでした",
      ).then((data) => data.invitation),
  });

  const removeMember = useMutation({
    mutationFn: ({ listId, memberId }: { listId: string; memberId: string }) =>
      requestEmpty(
        `/lists/${listId}/members/${memberId}`,
        { method: "DELETE" },
        "メンバーを除外できませんでした",
      ),
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.listDetails(userId, variables.listId),
        refetchType: "all",
      }),
  });

  const leaveList = useMutation({
    mutationKey: dashboardMutationKeys.lists(userId),
    mutationFn: (listId: string) =>
      requestEmpty(
        `/lists/${listId}/membership`,
        { method: "DELETE" },
        "リストから退会できませんでした",
      ),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listsKey, exact: true });
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      const previousList = previousLists.find((list) => list.id === listId);
      const previousIndex = previousLists.findIndex(
        (list) => list.id === listId,
      );
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.filter((list) => list.id !== listId),
      );
      return { previousList, previousIndex };
    },
    onError: (_error, _listId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
          restoreListAtIndex(lists, context.previousList!, context.previousIndex),
        );
      }
    },
    onSettled: () =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.lists(userId),
        listsKey,
      ),
  });

  const deleteList = useMutation({
    mutationKey: dashboardMutationKeys.lists(userId),
    mutationFn: (listId: string) =>
      requestEmpty(
        `/lists/${listId}`,
        { method: "DELETE" },
        "リストを削除できませんでした",
      ),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listsKey, exact: true });
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      const previousList = previousLists.find((list) => list.id === listId);
      const previousIndex = previousLists.findIndex(
        (list) => list.id === listId,
      );
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.filter((list) => list.id !== listId),
      );
      return { previousList, previousIndex };
    },
    onError: (_error, _listId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
          restoreListAtIndex(lists, context.previousList!, context.previousIndex),
        );
      }
    },
    onSettled: () =>
      invalidateAfterMutationsSettle(
        queryClient,
        dashboardMutationKeys.lists(userId),
        listsKey,
      ),
  });

  return {
    createList,
    saveItem,
    toggleItem,
    deleteItem,
    updateList,
    createInvitation,
    removeMember,
    leaveList,
    deleteList,
    pendingItemIds,
  };
}

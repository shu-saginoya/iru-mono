"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
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
  } catch {
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
  } catch {
    throw new Error("通信に失敗しました。接続を確認してください");
  }
  if (!response.ok) throw new Error(await getRequestError(response, fallback));
}

export async function fetchAllItems(listId: string) {
  const pageSize = 100;
  const items: Item[] = [];
  let offset = 0;
  let total = 0;

  do {
    const data = await requestJson<{
      items: Item[];
      pagination: { total: number };
    }>(
      `/lists/${listId}/items?status=all&limit=${pageSize}&offset=${offset}`,
      {},
      "アイテムを取得できませんでした",
    );
    items.push(...data.items);
    total = data.pagination.total;
    offset += data.items.length;
    if (!data.items.length) break;
  } while (offset < total);

  return items;
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

  useEffect(() => {
    let active = true;
    if (!listId) return;

    void readItemCache(userId, listId).then((cachedItems) => {
      if (active && cachedItems && !queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData(queryKey, cachedItems);
      }
    });

    return () => {
      active = false;
    };
  }, [listId, queryClient, queryKey, userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAllItems(listId),
    enabled: Boolean(listId),
  });

  useEffect(() => {
    if (listId && query.data) void writeItemCache(userId, listId, query.data);
  }, [listId, query.data, userId]);

  return query;
}

export function useDashboardMutations(userId: string) {
  const queryClient = useQueryClient();
  const listsKey = dashboardQueryKeys.lists(userId);

  const createList = useMutation({
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
      await queryClient.cancelQueries({ queryKey: listsKey });
      const previous = queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      const optimistic = { id: `optimistic-${crypto.randomUUID()}`, name: name.trim() };
      queryClient.setQueryData(listsKey, [optimistic, ...previous]);
      return { optimisticId: optimistic.id, previous };
    },
    onError: (_error, _name, context) => {
      if (context) queryClient.setQueryData(listsKey, context.previous);
    },
    onSuccess: (list, _name, context) => {
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.map((current) =>
          current.id === context?.optimisticId ? list : current,
        ),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  const saveItem = useMutation({
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
      const optimisticId = item.id ?? `optimistic-${crypto.randomUUID()}`;
      const previous = withItems(queryClient, userId, listId, (items) =>
        item.id
          ? replaceItem(items, item.id, { ...item, id: item.id, is_completed: false })
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
      return { previous, key, optimisticId };
    },
    onError: (_error, variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      void variables;
    },
    onSuccess: (item, variables, context) => {
      if (!context) return;
      queryClient.setQueryData<Item[]>(context.key, (items = []) =>
        replaceItem(items, variables.item.id ?? context.optimisticId, item),
      );
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.items(userId, variables.listId),
      }),
  });

  const toggleItem = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      requestJson<{ item: Item }>(
        `/lists/${listId}/items/${itemId}/toggle`,
        { method: "PATCH" },
        "アイテムの状態を変更できませんでした",
      ).then((data) => data.item),
    onMutate: async ({ listId, itemId }) => {
      const key = dashboardQueryKeys.items(userId, listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = withItems(queryClient, userId, listId, (items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, is_completed: !item.is_completed } : item,
        ),
      );
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: (item, variables) => {
      queryClient.setQueryData<Item[]>(
        dashboardQueryKeys.items(userId, variables.listId),
        (items = []) => replaceItem(items, variables.itemId, item),
      );
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.items(userId, variables.listId),
      }),
  });

  const deleteItem = useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      requestEmpty(
        `/lists/${listId}/items/${itemId}`,
        { method: "DELETE" },
        "アイテムを削除できませんでした",
      ),
    onMutate: async ({ listId, itemId }) => {
      const key = dashboardQueryKeys.items(userId, listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = withItems(queryClient, userId, listId, (items) =>
        items.filter((item) => item.id !== itemId),
      );
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.items(userId, variables.listId),
      }),
  });

  const updateList = useMutation({
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
        queryClient.cancelQueries({ queryKey: listsKey }),
        queryClient.cancelQueries({ queryKey: detailsKey }),
      ]);
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
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
      return { previousLists, previousDetails, detailsKey };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(listsKey, context.previousLists);
      queryClient.setQueryData(context.detailsKey, context.previousDetails);
    },
    onSuccess: (list, variables) => {
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.map((current) => (current.id === list.id ? list : current)),
      );
      queryClient.setQueryData(
        dashboardQueryKeys.listDetails(userId, variables.listId),
        (details: { list: ListDetails; members: Member[] } | undefined) =>
          details ? { ...details, list: { ...details.list, name: list.name } } : details,
      );
    },
    onSettled: (_data, _error, variables) =>
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.listDetails(userId, variables.listId),
      }),
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
      }),
  });

  const leaveList = useMutation({
    mutationFn: (listId: string) =>
      requestEmpty(
        `/lists/${listId}/membership`,
        { method: "DELETE" },
        "リストから退会できませんでした",
      ),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listsKey });
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.filter((list) => list.id !== listId),
      );
      return { previousLists };
    },
    onError: (_error, _listId, context) => {
      if (context) queryClient.setQueryData(listsKey, context.previousLists);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  const deleteList = useMutation({
    mutationFn: (listId: string) =>
      requestEmpty(
        `/lists/${listId}`,
        { method: "DELETE" },
        "リストを削除できませんでした",
      ),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: listsKey });
      const previousLists =
        queryClient.getQueryData<ShoppingList[]>(listsKey) ?? [];
      queryClient.setQueryData<ShoppingList[]>(listsKey, (lists = []) =>
        lists.filter((list) => list.id !== listId),
      );
      return { previousLists };
    },
    onError: (_error, _listId, context) => {
      if (context) queryClient.setQueryData(listsKey, context.previousLists);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
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
  };
}

"use client";

import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  replaceItem,
  rollbackItemMutation,
  toggleItemOptimistically,
  type Item,
} from "@/features/dashboard/item-state";
import { ItemList } from "@/features/dashboard/components/item-list";
import { ItemModal } from "@/features/dashboard/components/item-modal";
import { Sidebar } from "@/features/dashboard/components/sidebar";
import { ListSettingsModal } from "@/features/dashboard/components/list-settings-modal";

type ShoppingList = { id: string; name: string };
type ListDetails = { id: string; name: string; created_by: string };
type Member = {
  user_id: string;
  joined_at: string;
  users: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
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
  if (!response.ok) {
    throw new Error(await getRequestError(response, fallback));
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallback);
  }
}

export function Dashboard({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [listName, setListName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [isSavingList, setIsSavingList] = useState(false);
  const [isManagingMember, setIsManagingMember] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState("");
  const [listError, setListError] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [listDetails, setListDetails] = useState<ListDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editedListName, setEditedListName] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const itemsRef = useRef(items);
  const itemsRequestId = useRef(0);
  const itemTitleInput = useRef<HTMLInputElement>(null);
  const lastListKey = `iru-mono:last-list:${userId}`;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadLists = useCallback(async () => {
    const response = await fetch("/lists");
    if (!response.ok) throw new Error("リストを取得できませんでした");
    const data = (await response.json()) as { lists: ShoppingList[] };
    const savedListId = localStorage.getItem(lastListKey);
    const initialListId = data.lists.some((list) => list.id === savedListId)
      ? (savedListId ?? "")
      : data.lists[0]?.id || "";
    setLists(data.lists);
    setSelectedListId((current) => current || initialListId);
  }, [lastListKey]);

  const loadItems = useCallback(
    async (listId: string) => {
      const requestId = ++itemsRequestId.current;
      if (!listId) {
        setItems([]);
        return;
      }
      const data = await requestJson<{ items: Item[] }>(
        `/lists/${listId}/items?status=all&limit=100`,
        {},
        "アイテムを取得できませんでした",
      );
      if (requestId === itemsRequestId.current) {
        setItems(
          data.items.filter((item) => item.is_completed === showCompleted),
        );
      }
    },
    [showCompleted],
  );

  async function loadListDetails(listId: string) {
    const response = await fetch(`/lists/${listId}`);
    if (!response.ok)
      throw new Error(
        await getRequestError(response, "リスト情報を取得できませんでした"),
      );
    const data = (await response.json()) as {
      list: ListDetails;
      members: Member[];
    };
    setListDetails(data.list);
    setMembers(data.members);
    setEditedListName(data.list.name);
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadLists();
      } catch (cause) {
        if (active && cause instanceof Error) {
          setError(cause.message);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadLists]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await loadItems(selectedListId);
      } catch (cause) {
        if (active && cause instanceof Error) {
          setError(cause.message);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadItems, selectedListId]);
  useEffect(() => {
    if (selectedListId) localStorage.setItem(lastListKey, selectedListId);
  }, [selectedListId, lastListKey]);
  useEffect(() => {
    if (isItemModalOpen) itemTitleInput.current?.focus();
  }, [isItemModalOpen]);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!isCreatingItem) setIsItemModalOpen(false);
      if (!isSavingList && !isManagingMember) setIsListModalOpen(false);
      setIsSidebarOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreatingItem, isManagingMember, isSavingList]);

  function selectList(listId: string) {
    setSelectedListId(listId);
    setIsSidebarOpen(false);
    setError("");
  }

  function openItemModal(item?: Item) {
    setItemError("");
    setEditingItem(item ?? null);
    setItemTitle(item?.title ?? "");
    setQuantity(item?.quantity ?? 1);
    setIsItemModalOpen(true);
  }

  function closeItemModal() {
    if (isCreatingItem) return;
    setIsItemModalOpen(false);
  }

  function openListModal() {
    if (!selectedListId) return;
    setListError("");
    setListDetails(null);
    setMembers([]);
    setIsListModalOpen(true);
    loadListDetails(selectedListId).catch((cause: Error) =>
      setListError(cause.message),
    );
  }

  async function createList(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingList) return;
    setIsCreatingList(true);
    setError("");
    try {
      const response = await fetch("/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listName }),
      });
      if (!response.ok) throw new Error("リストを作成できませんでした");
      const data = (await response.json()) as { list: ShoppingList };
      setLists((current) => [data.list, ...current]);
      selectList(data.list.id);
      setListName("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "リストを作成できませんでした",
      );
    } finally {
      setIsCreatingList(false);
    }
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedListId || isCreatingItem) return;
    setIsCreatingItem(true);
    setItemError("");
    const listId = selectedListId;
    const itemBeingEdited = editingItem;
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimisticItem: Item = {
      id: optimisticId,
      title: itemTitle.trim(),
      quantity,
      is_completed: false,
    };
    try {
      if (!itemBeingEdited && !showCompleted) {
        const nextItems = [optimisticItem, ...itemsRef.current];
        itemsRef.current = nextItems;
        setItems(nextItems);
      }
      const data = await requestJson<{ item: Item }>(
        itemBeingEdited
          ? `/lists/${listId}/items/${itemBeingEdited.id}`
          : `/lists/${listId}/items`,
        {
          method: itemBeingEdited ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: itemTitle, quantity }),
        },
        itemBeingEdited
          ? "アイテムを編集できませんでした"
          : "アイテムを追加できませんでした",
      );
      if (!itemBeingEdited) {
        const nextItems = replaceItem(
          itemsRef.current,
          optimisticId,
          data.item,
        );
        itemsRef.current = nextItems;
        setItems(nextItems);
      } else {
        const nextItems = replaceItem(
          itemsRef.current,
          itemBeingEdited.id,
          data.item,
        );
        itemsRef.current = nextItems;
        setItems(nextItems);
      }
      setItemTitle("");
      setQuantity(1);
      setEditingItem(null);
      setIsItemModalOpen(false);
      await loadItems(selectedListId);
    } catch (cause) {
      if (!itemBeingEdited) {
        const nextItems = itemsRef.current.filter(
          (item) => item.id !== optimisticId,
        );
        itemsRef.current = nextItems;
        setItems(nextItems);
      }
      setItemError(
        cause instanceof Error
          ? cause.message
          : "アイテムを追加できませんでした",
      );
    } finally {
      setIsCreatingItem(false);
    }
  }

  async function toggleItem(itemId: string) {
    if (busyItemId) return;
    const optimistic = toggleItemOptimistically(
      itemsRef.current,
      itemId,
      showCompleted,
    );
    if (!optimistic.snapshot) return;
    itemsRef.current = optimistic.items;
    setItems(optimistic.items);
    setBusyItemId(itemId);
    setError("");
    try {
      const data = await requestJson<{ item: Item }>(
        `/lists/${selectedListId}/items/${itemId}/toggle`,
        { method: "PATCH" },
        "アイテムの状態を変更できませんでした",
      );
      const nextItems = replaceItem(itemsRef.current, itemId, data.item);
      itemsRef.current = nextItems;
      setItems(nextItems);
    } catch (cause) {
      const nextItems = rollbackItemMutation(
        itemsRef.current,
        optimistic.snapshot,
      );
      itemsRef.current = nextItems;
      setItems(nextItems);
      setError(
        cause instanceof Error
          ? cause.message
          : "アイテムの状態を変更できませんでした",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteItem(item: Item) {
    if (busyItemId || !window.confirm(`「${item.title}」を削除しますか？`))
      return;
    setBusyItemId(item.id);
    setError("");
    try {
      const response = await fetch(
        `/lists/${selectedListId}/items/${item.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("アイテムを削除できませんでした");
      await loadItems(selectedListId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "アイテムを削除できませんでした",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function updateList(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedListId || isSavingList) return;
    setIsSavingList(true);
    setListError("");
    try {
      const response = await fetch(`/lists/${selectedListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedListName }),
      });
      if (!response.ok)
        throw new Error(
          await getRequestError(response, "リスト名を変更できませんでした"),
        );
      const data = (await response.json()) as { list: ShoppingList };
      setLists((current) =>
        current.map((list) =>
          list.id === data.list.id ? { ...list, name: data.list.name } : list,
        ),
      );
      setListDetails((current) =>
        current ? { ...current, name: data.list.name } : current,
      );
    } catch (cause) {
      setListError(
        cause instanceof Error
          ? cause.message
          : "リスト名を変更できませんでした",
      );
    } finally {
      setIsSavingList(false);
    }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedListId || isManagingMember) return;
    setIsManagingMember(true);
    setListError("");
    try {
      const response = await fetch(`/lists/${selectedListId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberUserId }),
      });
      if (!response.ok)
        throw new Error(
          await getRequestError(response, "メンバーを追加できませんでした"),
        );
      setMemberUserId("");
      await loadListDetails(selectedListId);
    } catch (cause) {
      setListError(
        cause instanceof Error
          ? cause.message
          : "メンバーを追加できませんでした",
      );
    } finally {
      setIsManagingMember(false);
    }
  }

  async function removeMember(memberId: string) {
    if (
      !selectedListId ||
      isManagingMember ||
      !window.confirm("このメンバーを除外しますか？")
    )
      return;
    setIsManagingMember(true);
    setListError("");
    try {
      const response = await fetch(
        `/lists/${selectedListId}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          await getRequestError(response, "メンバーを除外できませんでした"),
        );
      await loadListDetails(selectedListId);
    } catch (cause) {
      setListError(
        cause instanceof Error
          ? cause.message
          : "メンバーを除外できませんでした",
      );
    } finally {
      setIsManagingMember(false);
    }
  }

  async function leaveList() {
    if (
      !selectedListId ||
      isManagingMember ||
      !window.confirm("このリストから退会しますか？")
    )
      return;
    setIsManagingMember(true);
    setListError("");
    try {
      const response = await fetch(`/lists/${selectedListId}/membership`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(
          await getRequestError(response, "リストから退会できませんでした"),
        );
      localStorage.removeItem(lastListKey);
      setIsListModalOpen(false);
      setSelectedListId("");
      await loadLists();
    } catch (cause) {
      setListError(
        cause instanceof Error
          ? cause.message
          : "リストから退会できませんでした",
      );
    } finally {
      setIsManagingMember(false);
    }
  }

  async function deleteList() {
    if (
      !selectedListId ||
      isSavingList ||
      !window.confirm(
        "このリストと全アイテムを削除しますか？この操作は取り消せません。",
      )
    )
      return;
    setIsSavingList(true);
    setListError("");
    try {
      const response = await fetch(`/lists/${selectedListId}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error(
          await getRequestError(response, "リストを削除できませんでした"),
        );
      localStorage.removeItem(lastListKey);
      setIsListModalOpen(false);
      setSelectedListId("");
      await loadLists();
    } catch (cause) {
      setListError(
        cause instanceof Error ? cause.message : "リストを削除できませんでした",
      );
    } finally {
      setIsSavingList(false);
    }
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <button
            className="menu-button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="リストを開く"
            title="リストを開く"
          >
            ☰
          </button>
          <div>
            <p className="eyebrow">SHARED SHOPPING</p>
            <h1>IRU MONO</h1>
          </div>
        </div>
        <div className="account">
          <span>{email}</span>
          <button className="quiet-button" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>
      {isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="リストを閉じる"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="workspace">
        <Sidebar
          lists={lists}
          selectedListId={selectedListId}
          listName={listName}
          isSidebarOpen={isSidebarOpen}
          isCreatingList={isCreatingList}
          onClose={() => setIsSidebarOpen(false)}
          onSelectList={selectList}
          onListNameChange={setListName}
          onCreateList={createList}
        />
        <section className="content-panel">
          <div className="content-heading">
            <div>
              <p className="eyebrow">YOUR LIST</p>
              <h2>
                {lists.find((list) => list.id === selectedListId)?.name ||
                  "リストを作成してください"}
              </h2>
            </div>
            {selectedListId && (
              <div className="heading-actions">
                <div className="segmented">
                  <button
                    className={!showCompleted ? "selected" : ""}
                    onClick={() => setShowCompleted(false)}
                  >
                    未完了
                  </button>
                  <button
                    className={showCompleted ? "selected" : ""}
                    onClick={() => setShowCompleted(true)}
                  >
                    完了済み
                  </button>
                </div>
                <button
                  className="utility-button"
                  onClick={openListModal}
                  aria-label="リストを管理"
                  title="リストを管理"
                >
                  <Settings size={18} />
                </button>
              </div>
            )}
          </div>
          {selectedListId ? (
            <ItemList
              items={items}
              showCompleted={showCompleted}
              busyItemId={busyItemId}
              onToggle={toggleItem}
              onEdit={openItemModal}
              onDelete={deleteItem}
            />
          ) : (
            <div className="empty-state large">
              <span>＋</span>
              <p>リストを作成してください</p>
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      {selectedListId && !showCompleted && (
        <button
          className="item-fab"
          onClick={() => openItemModal()}
          aria-label="アイテムを追加"
          title="アイテムを追加"
        >
          +
        </button>
      )}
      {isItemModalOpen && (
        <ItemModal
          editingItem={editingItem}
          itemTitle={itemTitle}
          quantity={quantity}
          itemError={itemError}
          isCreatingItem={isCreatingItem}
          itemTitleInput={itemTitleInput}
          onClose={closeItemModal}
          onSubmit={saveItem}
          onTitleChange={setItemTitle}
          onQuantityChange={setQuantity}
        />
      )}
      {isListModalOpen && (
        <ListSettingsModal
          userId={userId}
          listDetails={listDetails}
          members={members}
          editedListName={editedListName}
          memberUserId={memberUserId}
          listError={listError}
          isSavingList={isSavingList}
          isManagingMember={isManagingMember}
          onClose={() => setIsListModalOpen(false)}
          onUpdateList={updateList}
          onEditedListNameChange={setEditedListName}
          onAddMember={addMember}
          onMemberUserIdChange={setMemberUserId}
          onRemoveMember={removeMember}
          onLeaveList={leaveList}
          onDeleteList={deleteList}
        />
      )}
    </main>
  );
}

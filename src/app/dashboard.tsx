"use client";

import { Edit3, Settings, Trash2, UserMinus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ShoppingList = { id: string; name: string };
type Item = {
  id: string;
  title: string;
  quantity: number;
  is_completed: boolean;
};
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
  const itemTitleInput = useRef<HTMLInputElement>(null);
  const lastListKey = `iru-mono:last-list:${userId}`;

  async function loadLists() {
    const response = await fetch("/lists");
    if (!response.ok) throw new Error("リストを取得できませんでした");
    const data = (await response.json()) as { lists: ShoppingList[] };
    const savedListId = localStorage.getItem(lastListKey);
    const initialListId = data.lists.some((list) => list.id === savedListId)
      ? (savedListId ?? "")
      : data.lists[0]?.id || "";
    setLists(data.lists);
    setSelectedListId((current) => current || initialListId);
  }

  async function loadItems(listId: string) {
    if (!listId) return setItems([]);
    const status = showCompleted ? "completed" : "pending";
    const response = await fetch(`/lists/${listId}/items?status=${status}`);
    if (!response.ok)
      throw new Error(
        await getRequestError(response, "アイテムを取得できませんでした"),
      );
    const data = (await response.json()) as { items: Item[] };
    setItems(data.items);
  }

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
    loadLists().catch((cause: Error) => setError(cause.message));
  }, []);
  useEffect(() => {
    loadItems(selectedListId).catch((cause: Error) => setError(cause.message));
  }, [selectedListId, showCompleted]);
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
    try {
      const response = await fetch(
        editingItem
          ? `/lists/${selectedListId}/items/${editingItem.id}`
          : `/lists/${selectedListId}/items`,
        {
          method: editingItem ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: itemTitle, quantity }),
        },
      );
      if (!response.ok)
        throw new Error(
          await getRequestError(
            response,
            editingItem
              ? "アイテムを編集できませんでした"
              : "アイテムを追加できませんでした",
          ),
        );
      setItemTitle("");
      setQuantity(1);
      setEditingItem(null);
      setIsItemModalOpen(false);
      await loadItems(selectedListId);
    } catch (cause) {
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
    setBusyItemId(itemId);
    setError("");
    try {
      const response = await fetch(
        `/lists/${selectedListId}/items/${itemId}/toggle`,
        { method: "PATCH" },
      );
      if (!response.ok) throw new Error("アイテムの状態を変更できませんでした");
      await loadItems(selectedListId);
    } catch (cause) {
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
        <aside className={isSidebarOpen ? "sidebar open" : "sidebar"}>
          <div className="sidebar-header">
            <div className="section-heading">
              <h2>リスト</h2>
              <span>{lists.length}</span>
            </div>
            <button
              className="sidebar-close"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="リストを閉じる"
            >
              ×
            </button>
          </div>
          <div className="list-links">
            {lists.map((list) => (
              <button
                className={
                  list.id === selectedListId ? "list-link active" : "list-link"
                }
                key={list.id}
                onClick={() => selectList(list.id)}
              >
                {list.name}
              </button>
            ))}
          </div>
          <form className="stack-form" onSubmit={createList}>
            <label htmlFor="list-name">新しいリスト</label>
            <div className="inline-form">
              <input
                id="list-name"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="例: 今週の買い物"
                maxLength={100}
                required
                disabled={isCreatingList}
              />
              <button
                className="icon-button"
                aria-label="リストを作成"
                title="リストを作成"
                disabled={isCreatingList}
              >
                {isCreatingList ? "…" : "+"}
              </button>
            </div>
          </form>
        </aside>
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
            <div className="items-list">
              {items.length ? (
                items.map((item) => (
                  <article className="item-row" key={item.id}>
                    <button
                      className={item.is_completed ? "check checked" : "check"}
                      onClick={() => toggleItem(item.id)}
                      disabled={busyItemId !== null}
                      aria-label={
                        item.is_completed ? "未完了に戻す" : "完了にする"
                      }
                    >
                      {item.is_completed ? "✓" : ""}
                    </button>
                    <div className="item-copy">
                      <strong>{item.title}</strong>
                      <span>数量 {item.quantity}</span>
                    </div>
                    <button
                      className="utility-button"
                      onClick={() => openItemModal(item)}
                      disabled={busyItemId !== null}
                      aria-label="アイテムを編集"
                      title="アイテムを編集"
                    >
                      <Edit3 size={16} />
                    </button>
                    {!item.is_completed && (
                      <button
                        className="delete-button"
                        onClick={() => deleteItem(item)}
                        disabled={busyItemId !== null}
                        aria-label="削除"
                        title="削除"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <span>{showCompleted ? "○" : "＋"}</span>
                  <p>
                    {showCompleted
                      ? "完了済みのアイテムはありません"
                      : "右下の＋から買い物を追加しましょう"}
                  </p>
                </div>
              )}
            </div>
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
        <div className="modal-backdrop" onMouseDown={closeItemModal}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <h2 id="item-modal-title">
                {editingItem ? "アイテムを編集" : "アイテムを追加"}
              </h2>
              <button
                className="sidebar-close"
                onClick={closeItemModal}
                disabled={isCreatingItem}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            <form className="modal-form" onSubmit={saveItem}>
              <label htmlFor="item-title">商品名</label>
              <input
                ref={itemTitleInput}
                id="item-title"
                value={itemTitle}
                onChange={(event) => setItemTitle(event.target.value)}
                placeholder="例: 牛乳"
                maxLength={255}
                required
                disabled={isCreatingItem}
              />
              <label htmlFor="item-quantity">数量</label>
              <input
                id="item-quantity"
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
                disabled={isCreatingItem}
              />
              {itemError && (
                <p className="error-message" role="alert">
                  {itemError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="quiet-button"
                  onClick={closeItemModal}
                  disabled={isCreatingItem}
                >
                  キャンセル
                </button>
                <button className="primary-button" disabled={isCreatingItem}>
                  {isCreatingItem ? "保存中…" : editingItem ? "保存" : "追加"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isListModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() =>
            !isSavingList && !isManagingMember && setIsListModalOpen(false)
          }
        >
          <section
            className="modal list-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">LIST SETTINGS</p>
                <h2 id="list-modal-title">リストを管理</h2>
              </div>
              <button
                className="sidebar-close"
                onClick={() => setIsListModalOpen(false)}
                disabled={isSavingList || isManagingMember}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            {listDetails ? (
              <>
                <section className="settings-section">
                  <h3>リスト名</h3>
                  {listDetails.created_by === userId ? (
                    <form
                      className="inline-form settings-form"
                      onSubmit={updateList}
                    >
                      <input
                        value={editedListName}
                        onChange={(event) =>
                          setEditedListName(event.target.value)
                        }
                        maxLength={100}
                        required
                        disabled={isSavingList}
                      />
                      <button
                        className="primary-button"
                        disabled={isSavingList}
                      >
                        {isSavingList ? "保存中…" : "保存"}
                      </button>
                    </form>
                  ) : (
                    <p>{listDetails.name}</p>
                  )}
                </section>
                <section className="settings-section">
                  <div className="settings-heading">
                    <h3>
                      <Users size={18} /> メンバー
                    </h3>
                    <span>{members.length}人</span>
                  </div>
                  {listDetails.created_by === userId && (
                    <form className="member-form" onSubmit={addMember}>
                      <label htmlFor="member-user-id">ユーザーID</label>
                      <div className="inline-form">
                        <input
                          id="member-user-id"
                          value={memberUserId}
                          onChange={(event) =>
                            setMemberUserId(event.target.value)
                          }
                          placeholder="Supabase UUID"
                          required
                          disabled={isManagingMember}
                        />
                        <button
                          className="primary-button"
                          disabled={isManagingMember}
                        >
                          {isManagingMember ? "追加中…" : "追加"}
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="members-list">
                    {members.map((member) => (
                      <div className="member-row" key={member.user_id}>
                        <div>
                          <strong>
                            {member.users?.display_name || "名前未設定"}
                          </strong>
                          <span>
                            {member.user_id === listDetails.created_by
                              ? "作成者"
                              : member.user_id === userId
                                ? "あなた"
                                : member.user_id}
                          </span>
                        </div>
                        {listDetails.created_by === userId &&
                          member.user_id !== listDetails.created_by && (
                            <button
                              className="utility-button danger"
                              onClick={() => removeMember(member.user_id)}
                              disabled={isManagingMember}
                              aria-label="メンバーを除外"
                              title="メンバーを除外"
                            >
                              <UserMinus size={17} />
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                </section>
                <section className="settings-section danger-zone">
                  {listDetails.created_by === userId ? (
                    <>
                      <h3>リストを削除</h3>
                      <p>リスト内のアイテムとメンバー情報も削除されます。</p>
                      <button
                        className="danger-button"
                        onClick={deleteList}
                        disabled={isSavingList}
                      >
                        リストを削除
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>このリストから退会</h3>
                      <p>
                        退会後は、メンバーに追加されるまでリストにアクセスできません。
                      </p>
                      <button
                        className="danger-button"
                        onClick={leaveList}
                        disabled={isManagingMember}
                      >
                        リストから退会
                      </button>
                    </>
                  )}
                </section>
              </>
            ) : (
              <p className="modal-loading">リスト情報を読み込んでいます…</p>
            )}
            {listError && (
              <p className="error-message" role="alert">
                {listError}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

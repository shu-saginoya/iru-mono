"use client";

import { useEffect, useState } from "react";

type ShoppingList = { id: string; name: string };
type Item = {
  id: string;
  title: string;
  quantity: number;
  is_completed: boolean;
};

export function Dashboard({ email }: { email: string }) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [listName, setListName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  async function loadLists() {
    const response = await fetch("/lists");
    if (!response.ok) throw new Error("リストを取得できませんでした");
    const data = (await response.json()) as { lists: ShoppingList[] };
    setLists(data.lists);
    setSelectedListId((current) => current || data.lists[0]?.id || "");
  }

  async function loadItems(listId: string) {
    if (!listId) return setItems([]);
    const status = showCompleted ? "completed" : "pending";
    const response = await fetch(`/lists/${listId}/items?status=${status}`);
    if (!response.ok) throw new Error("アイテムを取得できませんでした");
    const data = (await response.json()) as { items: Item[] };
    setItems(data.items);
  }

  useEffect(() => {
    loadLists().catch((cause: Error) => setError(cause.message));
  }, []);
  useEffect(() => {
    loadItems(selectedListId).catch((cause: Error) => setError(cause.message));
  }, [selectedListId, showCompleted]);

  async function createList(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: listName }),
    });
    if (!response.ok) return setError("リストを作成できませんでした");
    const data = (await response.json()) as { list: ShoppingList };
    setLists((current) => [data.list, ...current]);
    setSelectedListId(data.list.id);
    setListName("");
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedListId) return;
    const response = await fetch(`/lists/${selectedListId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: itemTitle, quantity }),
    });
    if (!response.ok) return setError("アイテムを追加できませんでした");
    setItemTitle("");
    setQuantity(1);
    await loadItems(selectedListId);
  }

  async function toggleItem(itemId: string) {
    await fetch(`/lists/${selectedListId}/items/${itemId}/toggle`, {
      method: "PATCH",
    });
    await loadItems(selectedListId);
  }

  async function deleteItem(itemId: string) {
    const response = await fetch(`/lists/${selectedListId}/items/${itemId}`, {
      method: "DELETE",
    });
    if (!response.ok) return setError("アイテムを削除できませんでした");
    await loadItems(selectedListId);
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SHARED SHOPPING</p>
          <h1>IRU MONO</h1>
        </div>
        <div className="account">
          <span>{email}</span>
          <button className="quiet-button" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="section-heading">
            <h2>リスト</h2>
            <span>{lists.length}</span>
          </div>
          <div className="list-links">
            {lists.map((list) => (
              <button
                className={
                  list.id === selectedListId ? "list-link active" : "list-link"
                }
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
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
              />
              <button
                className="icon-button"
                aria-label="リストを作成"
                title="リストを作成"
              >
                +
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
          </div>
          {selectedListId ? (
            <>
              <form className="add-item-form" onSubmit={createItem}>
                <input
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  placeholder="買うものを入力"
                  maxLength={255}
                  required
                />
                <input
                  className="quantity"
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  aria-label="数量"
                />
                <button className="primary-button">追加する</button>
              </form>
              <div className="items-list">
                {items.length ? (
                  items.map((item) => (
                    <article className="item-row" key={item.id}>
                      <button
                        className={
                          item.is_completed ? "check checked" : "check"
                        }
                        onClick={() => toggleItem(item.id)}
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
                      {!item.is_completed && (
                        <button
                          className="delete-button"
                          onClick={() => deleteItem(item.id)}
                          aria-label="削除"
                          title="削除"
                        >
                          ×
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
                        : "最初の買い物を追加しましょう"}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state large">
              <span>＋</span>
              <p>左のフォームからリストを作成してください</p>
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type ShoppingList = { id: string; name: string };
type Item = { id: string; title: string; quantity: number; is_completed: boolean };

async function getRequestError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string; code?: string };
    return data.code ? `${data.error ?? fallback} (${data.code})` : data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function Dashboard({ email, userId }: { email: string; userId: string }) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [listName, setListName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState("");
  const itemTitleInput = useRef<HTMLInputElement>(null);
  const lastListKey = `iru-mono:last-list:${userId}`;

  async function loadLists() {
    const response = await fetch("/lists");
    if (!response.ok) throw new Error("リストを取得できませんでした");
    const data = (await response.json()) as { lists: ShoppingList[] };
    const savedListId = localStorage.getItem(lastListKey);
    const initialListId = data.lists.some((list) => list.id === savedListId)
      ? savedListId ?? ""
      : data.lists[0]?.id || "";
    setLists(data.lists);
    setSelectedListId((current) => current || initialListId);
  }

  async function loadItems(listId: string) {
    if (!listId) return setItems([]);
    const status = showCompleted ? "completed" : "pending";
    const response = await fetch(`/lists/${listId}/items?status=${status}`);
    if (!response.ok) throw new Error(await getRequestError(response, "アイテムを取得できませんでした"));
    const data = (await response.json()) as { items: Item[] };
    setItems(data.items);
  }

  useEffect(() => { loadLists().catch((cause: Error) => setError(cause.message)); }, []);
  useEffect(() => { loadItems(selectedListId).catch((cause: Error) => setError(cause.message)); }, [selectedListId, showCompleted]);
  useEffect(() => { if (selectedListId) localStorage.setItem(lastListKey, selectedListId); }, [selectedListId, lastListKey]);
  useEffect(() => {
    if (isItemModalOpen) itemTitleInput.current?.focus();
  }, [isItemModalOpen]);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsItemModalOpen(false);
      setIsSidebarOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function selectList(listId: string) {
    setSelectedListId(listId);
    setIsSidebarOpen(false);
    setError("");
  }

  async function createList(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingList) return;
    setIsCreatingList(true);
    setError("");
    try {
      const response = await fetch("/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: listName }) });
      if (!response.ok) throw new Error("リストを作成できませんでした");
      const data = (await response.json()) as { list: ShoppingList };
      setLists((current) => [data.list, ...current]);
      selectList(data.list.id);
      setListName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "リストを作成できませんでした");
    } finally {
      setIsCreatingList(false);
    }
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedListId || isCreatingItem) return;
    setIsCreatingItem(true);
    setItemError("");
    try {
      const response = await fetch(`/lists/${selectedListId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: itemTitle, quantity }) });
      if (!response.ok) throw new Error(await getRequestError(response, "アイテムを追加できませんでした"));
      setItemTitle("");
      setQuantity(1);
      setIsItemModalOpen(false);
      await loadItems(selectedListId);
    } catch (cause) {
      setItemError(cause instanceof Error ? cause.message : "アイテムを追加できませんでした");
    } finally {
      setIsCreatingItem(false);
    }
  }

  async function toggleItem(itemId: string) {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setError("");
    try {
      const response = await fetch(`/lists/${selectedListId}/items/${itemId}/toggle`, { method: "PATCH" });
      if (!response.ok) throw new Error("アイテムの状態を変更できませんでした");
      await loadItems(selectedListId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "アイテムの状態を変更できませんでした");
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteItem(itemId: string) {
    if (busyItemId) return;
    setBusyItemId(itemId);
    setError("");
    try {
      const response = await fetch(`/lists/${selectedListId}/items/${itemId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("アイテムを削除できませんでした");
      await loadItems(selectedListId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "アイテムを削除できませんでした");
    } finally {
      setBusyItemId(null);
    }
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><button className="menu-button" onClick={() => setIsSidebarOpen(true)} aria-label="リストを開く" title="リストを開く">☰</button><div><p className="eyebrow">SHARED SHOPPING</p><h1>IRU MONO</h1></div></div>
        <div className="account"><span>{email}</span><button className="quiet-button" onClick={logout}>ログアウト</button></div>
      </header>
      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="リストを閉じる" onClick={() => setIsSidebarOpen(false)} />}
      <div className="workspace">
        <aside className={isSidebarOpen ? "sidebar open" : "sidebar"}>
          <div className="sidebar-header"><div className="section-heading"><h2>リスト</h2><span>{lists.length}</span></div><button className="sidebar-close" onClick={() => setIsSidebarOpen(false)} aria-label="リストを閉じる">×</button></div>
          <div className="list-links">{lists.map((list) => <button className={list.id === selectedListId ? "list-link active" : "list-link"} key={list.id} onClick={() => selectList(list.id)}>{list.name}</button>)}</div>
          <form className="stack-form" onSubmit={createList}><label htmlFor="list-name">新しいリスト</label><div className="inline-form"><input id="list-name" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="例: 今週の買い物" maxLength={100} required disabled={isCreatingList} /><button className="icon-button" aria-label="リストを作成" title="リストを作成" disabled={isCreatingList}>{isCreatingList ? "…" : "+"}</button></div></form>
        </aside>
        <section className="content-panel">
          <div className="content-heading"><div><p className="eyebrow">YOUR LIST</p><h2>{lists.find((list) => list.id === selectedListId)?.name || "リストを作成してください"}</h2></div>{selectedListId && <div className="heading-actions"><div className="segmented"><button className={!showCompleted ? "selected" : ""} onClick={() => setShowCompleted(false)}>未完了</button><button className={showCompleted ? "selected" : ""} onClick={() => setShowCompleted(true)}>完了済み</button></div></div>}</div>
          {selectedListId ? <div className="items-list">{items.length ? items.map((item) => <article className="item-row" key={item.id}><button className={item.is_completed ? "check checked" : "check"} onClick={() => toggleItem(item.id)} disabled={busyItemId !== null} aria-label={item.is_completed ? "未完了に戻す" : "完了にする"}>{item.is_completed ? "✓" : ""}</button><div className="item-copy"><strong>{item.title}</strong><span>数量 {item.quantity}</span></div>{!item.is_completed && <button className="delete-button" onClick={() => deleteItem(item.id)} disabled={busyItemId !== null} aria-label="削除" title="削除">×</button>}</article>) : <div className="empty-state"><span>{showCompleted ? "○" : "＋"}</span><p>{showCompleted ? "完了済みのアイテムはありません" : "右上の＋から買い物を追加しましょう"}</p></div>}</div> : <div className="empty-state large"><span>＋</span><p>リストを作成してください</p></div>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
      </div>
      {selectedListId && !showCompleted && <button className="item-fab" onClick={() => { setItemError(""); setIsItemModalOpen(true); }} aria-label="アイテムを追加" title="アイテムを追加">+</button>}
      {isItemModalOpen && <div className="modal-backdrop" onMouseDown={() => !isCreatingItem && setIsItemModalOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><h2 id="add-item-title">アイテムを追加</h2><button className="sidebar-close" onClick={() => setIsItemModalOpen(false)} disabled={isCreatingItem} aria-label="閉じる">×</button></div><form className="modal-form" onSubmit={createItem}><label htmlFor="item-title">商品名</label><input ref={itemTitleInput} id="item-title" value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} placeholder="例: 牛乳" maxLength={255} required disabled={isCreatingItem} /><label htmlFor="item-quantity">数量</label><input id="item-quantity" type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required disabled={isCreatingItem} />{itemError && <p className="error-message" role="alert">{itemError}</p>}<div className="modal-actions"><button type="button" className="quiet-button" onClick={() => setIsItemModalOpen(false)} disabled={isCreatingItem}>キャンセル</button><button className="primary-button" disabled={isCreatingItem}>{isCreatingItem ? "追加中…" : "追加"}</button></div></form></section></div>}
    </main>
  );
}

"use client";

import { Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@/features/dashboard/item-state";
import { ItemList } from "@/features/dashboard/components/item-list";
import { ItemModal } from "@/features/dashboard/components/item-modal";
import { Sidebar } from "@/features/dashboard/components/sidebar";
import { ListSettingsModal } from "@/features/dashboard/components/list-settings-modal";
import {
  useDashboardListsQuery,
  useDashboardMutations,
  useInvitationsQuery,
  useItemsQuery,
  useListDetailsQuery,
} from "@/features/dashboard/dashboard-queries";
import { clearItemCacheForUser } from "@/features/dashboard/item-cache";

const emptyLists: { id: string; name: string }[] = [];
const emptyInvitations: {
  id: string;
  list: { name: string } | null;
}[] = [];
const emptyItems: Item[] = [];

export function Dashboard({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const [selectedListId, setSelectedListId] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [listName, setListName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [itemModalListId, setItemModalListId] = useState<string | null>(null);
  const [listModalListId, setListModalListId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState("");
  const [listError, setListError] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editedListName, setEditedListName] = useState("");
  const [hasEditedListName, setHasEditedListName] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const itemTitleInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const lastListKey = `iru-mono:last-list:${userId}`;
  const closeListModal = useCallback(() => {
    setIsListModalOpen(false);
    setEditedListName("");
    setHasEditedListName(false);
    setListModalListId(null);
  }, []);

  const listsQuery = useDashboardListsQuery(userId);
  const invitationsQuery = useInvitationsQuery(userId);
  const lists = listsQuery.data ?? emptyLists;
  const selectableLists = lists.filter(
    (list) => !list.id.startsWith("optimistic-"),
  );
  const invitations = invitationsQuery.data ?? emptyInvitations;
  const savedListId =
    typeof window === "undefined" ? null : localStorage.getItem(lastListKey);
  const activeListId =
    selectedListId &&
    selectableLists.some((list) => list.id === selectedListId)
      ? selectedListId
      : selectableLists.some((list) => list.id === savedListId)
        ? (savedListId ?? "")
        : (selectableLists[0]?.id ?? "");
  const [previousActiveListId, setPreviousActiveListId] =
    useState(activeListId);
  if (previousActiveListId !== activeListId) {
    setPreviousActiveListId(activeListId);
    if (itemModalListId && itemModalListId !== activeListId) {
      setIsItemModalOpen(false);
      setEditingItem(null);
      setItemTitle("");
      setQuantity(1);
      setItemError("");
      setItemModalListId(null);
    }
    // 操作中に非表示にしたモーダルは、失敗時の復元用に対象IDを保持する
    if (isListModalOpen && listModalListId !== activeListId) {
      closeListModal();
    }
  }
  const isItemModalForActiveList =
    isItemModalOpen && itemModalListId === activeListId;
  const isListModalForActiveList =
    isListModalOpen && listModalListId === activeListId;
  const itemsQuery = useItemsQuery(userId, activeListId);
  const detailsQuery = useListDetailsQuery(
    userId,
    isListModalForActiveList ? activeListId : "",
  );
  const mutations = useDashboardMutations(userId);
  const items = itemsQuery.data ?? emptyItems;
  const listDetails = detailsQuery.data?.list ?? null;
  const members = detailsQuery.data?.members ?? [];
  const effectiveEditedListName = hasEditedListName
    ? editedListName
    : (listDetails?.name ?? editedListName);
  const isCreatingList = mutations.createList.isPending;
  const isCreatingItem = mutations.saveItem.isPending;
  const isSavingList =
    mutations.updateList.isPending || mutations.deleteList.isPending;
  const isManagingMember =
    mutations.createInvitation.isPending ||
    mutations.removeMember.isPending ||
    mutations.leaveList.isPending;
  const busyItemIds = mutations.pendingItemIds
    .filter((mutation) => mutation.listId === activeListId)
    .map((mutation) => mutation.itemId);

  useEffect(() => {
    if (activeListId) localStorage.setItem(lastListKey, activeListId);
  }, [activeListId, lastListKey]);

  useEffect(() => {
    if (isItemModalOpen) itemTitleInput.current?.focus();
  }, [isItemModalOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!isCreatingItem) setIsItemModalOpen(false);
      if (!isSavingList && !isManagingMember) closeListModal();
      setIsSidebarOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeListModal, isCreatingItem, isManagingMember, isSavingList]);

  function selectList(listId: string) {
    if (listId.startsWith("optimistic-")) return;
    setSelectedListId(listId);
    setIsSidebarOpen(false);
    setError("");
    setItemError("");
  }

  function openItemModal(item?: Item) {
    if (itemsQuery.isPending) return;
    setItemError("");
    setEditingItem(item ?? null);
    setItemTitle(item?.title ?? "");
    setQuantity(item?.quantity ?? 1);
    setItemModalListId(activeListId);
    setIsItemModalOpen(true);
  }

  function closeItemModal() {
    if (!isCreatingItem) {
      setIsItemModalOpen(false);
      setItemModalListId(null);
    }
  }

  function openListModal() {
    if (!activeListId) return;
    setListError("");
    setEditedListName("");
    setHasEditedListName(false);
    setListModalListId(activeListId);
    setIsListModalOpen(true);
  }

  async function createList(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingList) return;
    setError("");
    try {
      const list = await mutations.createList.mutateAsync(listName);
      setListName("");
      selectList(list.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "リストを作成できませんでした",
      );
    }
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    const itemListId = itemModalListId;
    if (
      !itemListId ||
      itemListId !== activeListId ||
      !selectableLists.some((list) => list.id === itemListId) ||
      itemsQuery.isPending ||
      isCreatingItem
    )
      return;
    setItemError("");
    try {
      await mutations.saveItem.mutateAsync({
        listId: itemListId,
        item: {
          id: editingItem?.id,
          title: itemTitle,
          quantity,
        },
      });
      setItemTitle("");
      setQuantity(1);
      setEditingItem(null);
      setItemModalListId(null);
      setIsItemModalOpen(false);
    } catch (cause) {
      setItemError(
        cause instanceof Error
          ? cause.message
          : editingItem
            ? "アイテムを編集できませんでした"
            : "アイテムを追加できませんでした",
      );
    }
  }

  async function toggleItem(itemId: string) {
    if (!activeListId || busyItemIds.includes(itemId)) return;
    setItemError("");
    try {
      await mutations.toggleItem.mutateAsync({ listId: activeListId, itemId });
    } catch (cause) {
      setItemError(
        cause instanceof Error
          ? cause.message
          : "アイテムの状態を変更できませんでした",
      );
    }
  }

  async function deleteItem(item: Item) {
    if (
      !activeListId ||
      busyItemIds.includes(item.id) ||
      !window.confirm(`「${item.title}」を削除しますか？`)
    )
      return;
    setItemError("");
    try {
      await mutations.deleteItem.mutateAsync({
        listId: activeListId,
        itemId: item.id,
      });
    } catch (cause) {
      setItemError(
        cause instanceof Error ? cause.message : "アイテムを削除できませんでした",
      );
    }
  }

  async function updateList(event: React.FormEvent) {
    event.preventDefault();
    const listId = listModalListId;
    if (
      !listId ||
      listId !== activeListId ||
      !selectableLists.some((list) => list.id === listId) ||
      isSavingList
    )
      return;
    setListError("");
    try {
      await mutations.updateList.mutateAsync({
        listId,
        name: effectiveEditedListName,
      });
    } catch (cause) {
      setListError(
        cause instanceof Error ? cause.message : "リスト名を変更できませんでした",
      );
    }
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    const listId = listModalListId;
    if (
      !listId ||
      listId !== activeListId ||
      !selectableLists.some((list) => list.id === listId) ||
      isManagingMember
    )
      return;
    setListError("");
    setInviteMessage("");
    try {
      const invitation = await mutations.createInvitation.mutateAsync({
        listId,
        email: memberEmail,
      });
      setMemberEmail("");
      setInvitationUrl(invitation.url);
      setInviteMessage("招待リンクを発行しました");
    } catch (cause) {
      setListError(
        cause instanceof Error ? cause.message : "招待を送信できませんでした",
      );
    }
  }

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setInviteMessage("招待リンクをコピーしました");
    } catch {
      setListError("招待リンクをコピーできませんでした");
    }
  }

  async function removeMember(memberId: string) {
    const listId = listModalListId;
    if (
      !listId ||
      listId !== activeListId ||
      !selectableLists.some((list) => list.id === listId) ||
      isManagingMember ||
      !window.confirm("このメンバーを除外しますか？")
    )
      return;
    setListError("");
    try {
      await mutations.removeMember.mutateAsync({
        listId,
        memberId,
      });
    } catch (cause) {
      setListError(
        cause instanceof Error ? cause.message : "メンバーを除外できませんでした",
      );
    }
  }

  async function leaveList() {
    const listId = listModalListId;
    if (
      !listId ||
      listId !== activeListId ||
      !selectableLists.some((list) => list.id === listId) ||
      isManagingMember ||
      !window.confirm("このリストから退会しますか？")
    )
      return;
    const leavingListId = listId;
    setListError("");
    setSelectedListId("");
    setIsListModalOpen(false);
    try {
      await mutations.leaveList.mutateAsync(leavingListId);
      localStorage.removeItem(lastListKey);
      closeListModal();
    } catch (cause) {
      setSelectedListId(leavingListId);
      setIsListModalOpen(true);
      setListError(
        cause instanceof Error ? cause.message : "リストから退会できませんでした",
      );
    }
  }

  async function deleteList() {
    const listId = listModalListId;
    if (
      !listId ||
      listId !== activeListId ||
      !selectableLists.some((list) => list.id === listId) ||
      isSavingList ||
      !window.confirm(
        "このリストと全アイテムを削除しますか？この操作は取り消せません。",
      )
    )
      return;
    const deletingListId = listId;
    setListError("");
    setSelectedListId("");
    setIsListModalOpen(false);
    try {
      await mutations.deleteList.mutateAsync(deletingListId);
      localStorage.removeItem(lastListKey);
      closeListModal();
    } catch (cause) {
      setSelectedListId(deletingListId);
      setIsListModalOpen(true);
      setListError(
        cause instanceof Error ? cause.message : "リストを削除できませんでした",
      );
    }
  }

  async function logout() {
    const response = await fetch("/auth/logout", { method: "POST" });
    if (!response.ok) {
      setError("ログアウトできませんでした");
      return;
    }
    queryClient.clear();
    try {
      await clearItemCacheForUser(userId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `ログアウト時にローカルキャッシュを削除できませんでした: ${cause.message}`
          : "ログアウト時にローカルキャッシュを削除できませんでした",
      );
      return;
    }
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
          selectedListId={activeListId}
          listName={listName}
          isSidebarOpen={isSidebarOpen}
          isCreatingList={isCreatingList}
          onClose={() => setIsSidebarOpen(false)}
          onSelectList={selectList}
          onListNameChange={setListName}
          onCreateList={createList}
        />
        <section className="content-panel">
          {invitations.length > 0 && (
            <section className="invitation-notice" aria-label="招待">
              <div>
                <strong>リストへの招待があります</strong>
                {invitations.map((invitation) => (
                  <p key={invitation.id}>
                    {invitation.list?.name ?? "リスト"} に招待されています。
                    共有された招待リンクを開いて承認してください。
                  </p>
                ))}
              </div>
            </section>
          )}
          <div className="content-heading">
            <div>
              <p className="eyebrow">YOUR LIST</p>
              <h2>
                {lists.find((list) => list.id === activeListId)?.name ||
                  "リストを作成してください"}
              </h2>
            </div>
            {activeListId && (
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
          {activeListId ? (
            <ItemList
              items={items.filter(
                (item) => item.is_completed === showCompleted,
              )}
              showCompleted={showCompleted}
              isLoading={
                (itemsQuery.isCacheRestoring || itemsQuery.isPending) &&
                !itemsQuery.data
              }
              isRefreshing={itemsQuery.isFetching && Boolean(items.length)}
              error={
                itemError ||
                (itemsQuery.error instanceof Error
                  ? itemsQuery.error.message
                  : itemsQuery.error
                    ? "アイテムを取得できませんでした"
                    : "")
              }
              busyItemIds={busyItemIds}
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
          {(error || listsQuery.error) && (
            <p className="error-message" role="alert">
              {error ||
                (listsQuery.error instanceof Error
                  ? listsQuery.error.message
                  : "リストを取得できませんでした")}
            </p>
          )}
        </section>
      </div>
      {activeListId && !showCompleted && (
        <button
          className="item-fab"
          onClick={() => openItemModal()}
          aria-label="アイテムを追加"
          title="アイテムを追加"
        >
          +
        </button>
      )}
      {isItemModalForActiveList && (
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
      {isListModalForActiveList && (
        <ListSettingsModal
          userId={userId}
          listDetails={listDetails}
          members={members}
          editedListName={effectiveEditedListName}
          memberEmail={memberEmail}
          listError={listError || (detailsQuery.error instanceof Error ? detailsQuery.error.message : "")}
          inviteMessage={inviteMessage}
          invitationUrl={invitationUrl}
          isSavingList={isSavingList}
          isManagingMember={isManagingMember}
          onClose={closeListModal}
          onUpdateList={updateList}
          onEditedListNameChange={(value) => {
            setHasEditedListName(true);
            setEditedListName(value);
          }}
          onAddMember={addMember}
          onMemberEmailChange={setMemberEmail}
          onCopyInvitation={copyInvitation}
          onRemoveMember={removeMember}
          onLeaveList={leaveList}
          onDeleteList={deleteList}
        />
      )}
    </main>
  );
}

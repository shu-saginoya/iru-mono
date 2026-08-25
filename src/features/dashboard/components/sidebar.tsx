"use client";

type ShoppingList = { id: string; name: string };

type SidebarProps = {
  lists: ShoppingList[];
  selectedListId: string;
  listName: string;
  isSidebarOpen: boolean;
  isCreatingList: boolean;
  onClose: () => void;
  onSelectList: (listId: string) => void;
  onListNameChange: (value: string) => void;
  onCreateList: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function Sidebar({
  lists,
  selectedListId,
  listName,
  isSidebarOpen,
  isCreatingList,
  onClose,
  onSelectList,
  onListNameChange,
  onCreateList,
}: SidebarProps) {
  return (
    <aside className={isSidebarOpen ? "sidebar open" : "sidebar"}>
      <div className="sidebar-header">
        <div className="section-heading">
          <h2>リスト</h2>
          <span>{lists.length}</span>
        </div>
        <button
          className="sidebar-close"
          onClick={onClose}
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
            onClick={() => onSelectList(list.id)}
          >
            {list.name}
          </button>
        ))}
      </div>
      <form className="stack-form" onSubmit={onCreateList}>
        <label htmlFor="list-name">新しいリスト</label>
        <div className="inline-form">
          <input
            id="list-name"
            value={listName}
            onChange={(event) => onListNameChange(event.target.value)}
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
  );
}

"use client";

import { Edit3, Trash2 } from "lucide-react";
import type { Item } from "@/features/dashboard/item-state";

type ItemListProps = {
  items: Item[];
  showCompleted: boolean;
  busyItemId: string | null;
  onToggle: (itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export function ItemList({
  items,
  showCompleted,
  busyItemId,
  onToggle,
  onEdit,
  onDelete,
}: ItemListProps) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <span>{showCompleted ? "○" : "＋"}</span>
        <p>
          {showCompleted
            ? "完了済みのアイテムはありません"
            : "右下の＋から買い物を追加しましょう"}
        </p>
      </div>
    );
  }

  return (
    <div className="items-list">
      {items.map((item) => (
        <article className="item-row" key={item.id}>
          <button
            className={item.is_completed ? "check checked" : "check"}
            onClick={() => onToggle(item.id)}
            disabled={busyItemId === item.id}
            aria-label={item.is_completed ? "未完了に戻す" : "完了にする"}
          >
            {item.is_completed ? "✓" : ""}
          </button>
          <div className="item-copy">
            <strong>{item.title}</strong>
            <span>数量 {item.quantity}</span>
          </div>
          <button
            className="utility-button"
            onClick={() => onEdit(item)}
            disabled={busyItemId === item.id}
            aria-label="アイテムを編集"
            title="アイテムを編集"
          >
            <Edit3 size={16} />
          </button>
          {!item.is_completed && (
            <button
              className="delete-button"
              onClick={() => onDelete(item)}
              disabled={busyItemId === item.id}
              aria-label="削除"
              title="削除"
            >
              <Trash2 size={17} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

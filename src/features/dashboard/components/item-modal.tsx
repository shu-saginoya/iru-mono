"use client";

import { X } from "lucide-react";
import { RefObject } from "react";
import type { Item } from "@/features/dashboard/item-state";

type ItemModalProps = {
  editingItem: Item | null;
  itemTitle: string;
  quantity: number;
  itemError: string;
  isCreatingItem: boolean;
  itemTitleInput: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
};

export function ItemModal({
  editingItem,
  itemTitle,
  quantity,
  itemError,
  isCreatingItem,
  itemTitleInput,
  onClose,
  onSubmit,
  onTitleChange,
  onQuantityChange,
}: ItemModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
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
            onClick={onClose}
            disabled={isCreatingItem}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit}>
          <label htmlFor="item-title">商品名</label>
          <input
            ref={itemTitleInput}
            id="item-title"
            value={itemTitle}
            onChange={(event) => onTitleChange(event.target.value)}
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
            onChange={(event) => onQuantityChange(Number(event.target.value))}
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
              onClick={onClose}
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
  );
}

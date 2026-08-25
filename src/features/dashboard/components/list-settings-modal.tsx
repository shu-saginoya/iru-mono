"use client";

import { UserMinus, Users, X } from "lucide-react";
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

type Props = {
  userId: string;
  listDetails: ListDetails | null;
  members: Member[];
  editedListName: string;
  memberUserId: string;
  listError: string;
  isSavingList: boolean;
  isManagingMember: boolean;
  onClose: () => void;
  onUpdateList: (event: React.FormEvent<HTMLFormElement>) => void;
  onEditedListNameChange: (value: string) => void;
  onAddMember: (event: React.FormEvent<HTMLFormElement>) => void;
  onMemberUserIdChange: (value: string) => void;
  onRemoveMember: (memberId: string) => void;
  onLeaveList: () => void;
  onDeleteList: () => void;
};

export function ListSettingsModal({
  userId,
  listDetails,
  members,
  editedListName,
  memberUserId,
  listError,
  isSavingList,
  isManagingMember,
  onClose,
  onUpdateList,
  onEditedListNameChange,
  onAddMember,
  onMemberUserIdChange,
  onRemoveMember,
  onLeaveList,
  onDeleteList,
}: Props) {
  const isOwner = listDetails?.created_by === userId;
  const isBusy = isSavingList || isManagingMember;

  return (
    <div className="modal-backdrop" onMouseDown={() => !isBusy && onClose()}>
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
            onClick={onClose}
            disabled={isBusy}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        {listDetails ? (
          <>
            <section className="settings-section">
              <h3>リスト名</h3>
              {isOwner ? (
                <form
                  className="inline-form settings-form"
                  onSubmit={onUpdateList}
                >
                  <input
                    value={editedListName}
                    onChange={(event) =>
                      onEditedListNameChange(event.target.value)
                    }
                    maxLength={100}
                    required
                    disabled={isSavingList}
                  />
                  <button className="primary-button" disabled={isSavingList}>
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
              {isOwner && (
                <form className="member-form" onSubmit={onAddMember}>
                  <label htmlFor="member-user-id">ユーザーID</label>
                  <div className="inline-form">
                    <input
                      id="member-user-id"
                      value={memberUserId}
                      onChange={(event) =>
                        onMemberUserIdChange(event.target.value)
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
                    {isOwner && member.user_id !== listDetails.created_by && (
                      <button
                        className="utility-button danger"
                        onClick={() => onRemoveMember(member.user_id)}
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
              {isOwner ? (
                <>
                  <h3>リストを削除</h3>
                  <p>リスト内のアイテムとメンバー情報も削除されます。</p>
                  <button
                    className="danger-button"
                    onClick={onDeleteList}
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
                    onClick={onLeaveList}
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
  );
}

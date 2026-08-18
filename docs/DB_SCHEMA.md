# データベーススキーマ設計（MVP）

## 1. 方針

Supabase PostgreSQL と Supabase Auth を使用します。アプリ側のユーザー ID は `auth.users.id` と同じ UUID です。パスワードや Google の認証情報はアプリ DB に保存しません。

初回リリースは `users`、`lists`、`list_members`、`items` の 4 テーブルだけで構成します。タグと `item_tags` は作成しません。

## 2. エンティティ

```text
auth.users 1 ─── 1 public.users
public.users 1 ─── N public.lists（created_by）
public.users N ─── N public.lists（list_members）
public.lists 1 ─── N public.items
```

## 3. テーブル

### public.users

| カラム       | 型          | 制約                   |
| ------------ | ----------- | ---------------------- |
| id           | uuid        | PK、auth.users.id 参照 |
| display_name | text        | nullable               |
| avatar_url   | text        | nullable               |
| created_at   | timestamptz | default now()          |
| updated_at   | timestamptz | default now()          |

### public.lists

| カラム     | 型          | 制約                          |
| ---------- | ----------- | ----------------------------- |
| id         | uuid        | PK、default gen_random_uuid() |
| name       | text        | 1〜100 文字、not null         |
| created_by | uuid        | users.id 参照、not null       |
| created_at | timestamptz | default now()                 |
| updated_at | timestamptz | default now()                 |

### public.list_members

| カラム    | 型          | 制約                          |
| --------- | ----------- | ----------------------------- |
| id        | uuid        | PK、default gen_random_uuid() |
| list_id   | uuid        | lists.id 参照、not null       |
| user_id   | uuid        | users.id 参照、not null       |
| joined_at | timestamptz | default now()                 |

`unique (list_id, user_id)` を設定します。

### public.items

| カラム       | 型          | 制約                          |
| ------------ | ----------- | ----------------------------- |
| id           | uuid        | PK、default gen_random_uuid() |
| list_id      | uuid        | lists.id 参照、not null       |
| title        | text        | 1〜255 文字、not null         |
| quantity     | integer     | 1〜999、default 1             |
| is_completed | boolean     | default false                 |
| completed_at | timestamptz | nullable                      |
| created_at   | timestamptz | default now()                 |
| updated_at   | timestamptz | default now()                 |

## 4. SQL

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  quantity integer not null default 1 check (quantity between 1 and 999),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_completed = false and completed_at is null)
      or (is_completed = true and completed_at is not null))
);

create index list_members_user_id_idx on public.list_members(user_id);
create index items_list_id_idx on public.items(list_id);
create index items_created_at_idx on public.items(created_at);
```

## 5. RLS 方針

4 テーブルすべてで RLS を有効にします。`lists`、`list_members`、`items` は、対象リストに `auth.uid()` が所属している場合だけ読み取り・変更を許可します。

初回リリースでは、以下を明確にします。

- リスト作成時に `created_by` と作成者の `list_members` を登録する
- 作成者だけがメンバー追加・除外・リスト削除を行える
- アイテムの作成・更新・完了切り替えは全メンバーが行える
- サービスロールキーはサーバー専用にする

## 6. 後から追加するもの

- tags、item_tags
- 招待情報を管理するテーブル
- 役割・権限テーブル
- Realtime 用の詳細設計
- 完了アイテムの自動削除ジョブ

最終更新: 2026年8月18日

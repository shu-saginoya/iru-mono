# データベーススキーマ（MVP）

テーブル、制約、RLS の正本。機能要件は [プロダクト仕様](SPEC.md)、API との対応は [API仕様](API_SPEC.md) を参照する。

## 1. 方針

Supabase PostgreSQL と Supabase Auth を使用します。アプリ側のユーザー ID は `auth.users.id` と同じ UUID です。パスワードや Google の認証情報はアプリ DB に保存しません。

初回リリースは `users`、`lists`、`list_members`、`items`、`list_invitations` の 5 テーブルで構成します。タグと `item_tags` は作成しません。

## 2. エンティティ

```text
auth.users 1 ─── 1 public.users
public.users 1 ─── N public.lists（created_by）
public.users N ─── N public.lists（list_members）
public.lists 1 ─── N public.items
public.lists 1 ─── N public.list_invitations
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

### public.list_invitations

| カラム      | 型          | 制約                           |
| ----------- | ----------- | ------------------------------ |
| id          | uuid        | PK、default gen_random_uuid()  |
| list_id     | uuid        | lists.id 参照、not null        |
| invited_by  | uuid        | users.id 参照、not null        |
| email       | text        | 招待先メールアドレス、not null |
| token_hash  | text        | 一意、not null                 |
| expires_at  | timestamptz | not null                       |
| accepted_at | timestamptz | nullable                       |
| created_at  | timestamptz | default now()、not null        |

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

create table public.list_invitations (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index list_members_user_id_idx on public.list_members(user_id);
create index items_list_id_idx on public.items(list_id);
create index items_created_at_idx on public.items(created_at);
create index list_invitations_email_idx on public.list_invitations(lower(email));
create index list_invitations_list_id_idx on public.list_invitations(list_id);
```

## 5. RLS 方針

5 テーブルすべてで RLS を有効にします。`lists`、`list_members`、`items` は、対象リストに `auth.uid()` が所属している場合だけ読み取り・変更を許可します。`list_invitations` は作成者が発行・参照・削除でき、招待先本人は自分宛ての招待だけを参照できます。

初回リリースでは、以下を明確にします。

- リスト作成時に `created_by` と作成者の `list_members` を登録する
- 作成者だけが招待発行・メンバー除外・リスト削除を行える
- 招待承認時のメンバー登録は、招待先メールアドレスとログイン中のメールアドレスを検証する SECURITY DEFINER 関数で行う
- アイテムの作成・更新・完了切り替えは全メンバーが行える
- サービスロールキーはサーバー専用にする

## 6. 将来の拡張

- tags、item_tags
- 役割・権限テーブル
- Realtime 用の詳細設計
- 完了アイテムの自動削除ジョブ

詳細な機能の対象外は [プロダクト仕様](SPEC.md) に集約する。

最終更新: 2026年9月6日

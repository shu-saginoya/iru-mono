# データベーススキーマ設計（Supabase 版）

## 1. 概要

Supabase PostgreSQL + Supabase Auth を前提としたデータベース設計です。
ユーザーとリストを独立した概念として扱い、リストのメンバーがタグとアイテムを共有します。

本設計では以下を前提とします。

- 認証は Supabase Auth の Google OAuth に委譲する
- アプリ側の `users.id` は Supabase Auth のユーザー ID と対応させる
- パスワードや Google の認証情報はアプリ DB に保存しない
- ユーザーは複数のリストを作成・利用できる
- 1 つのリストには複数のユーザーが所属できる
- 所属関係は `list_members` で管理する
- タグとアイテムはリストに所属する
- タグ名は同じリスト内で一意とする
- 完了済みアイテムは 30 日経過後に自動削除する

---

## 2. ER 図

```text
┌──────────────────┐
│      users       │  Supabase Auth のプロフィール
├──────────────────┤
│ id (PK/FK)       │  auth.users.id
│ displayName      │
│ avatarUrl        │
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │ 1:N createdBy
         │
┌────────▼─────────┐       1:N       ┌──────────────────┐
│      lists       │─────────────────│   list_members   │
├──────────────────┤                 ├──────────────────┤
│ id (PK)          │                 │ id (PK)          │
│ name             │                 │ listId (FK)      │
│ createdById (FK) │                 │ userId (FK)      │
│ createdAt        │                 │ joinedAt         │
│ updatedAt        │                 └──────────────────┘
└───────┬──────────┘
        │ 1:N
        ├──────────────────────┐
        │                      │
┌───────▼──────────┐    ┌──────▼───────────┐
│       tags       │    │      items       │
├──────────────────┤    ├──────────────────┤
│ id (PK)          │    │ id (PK)          │
│ listId (FK)      │    │ listId (FK)      │
│ name             │    │ title            │
│ createdAt        │    │ quantity         │
│ updatedAt        │    │ isCompleted      │
└────────┬─────────┘    │ completedAt      │
         │              │ createdAt        │
         │ M:N          │ updatedAt        │
         └──────┐       └────────┬─────────┘
                │                │
           ┌────▼────────────────▼────┐
           │        item_tags         │
           ├──────────────────────────┤
           │ itemId (FK)              │
           │ tagId (FK)               │
           │ createdAt                │
           └──────────────────────────┘
```

---

## 3. テーブル定義

### 3.1 `public.users`

Supabase Auth のユーザーに対応するアプリ側プロフィール。`id` は `auth.users.id` と同じ値を使用します。

| カラム         | 型          | 制約                     | 説明                        |
| -------------- | ----------- | ------------------------ | --------------------------- |
| `id`           | uuid        | PRIMARY KEY, FOREIGN KEY | `auth.users.id`             |
| `display_name` | text        | NULLABLE                 | Google アカウントの表示名   |
| `avatar_url`   | text        | NULLABLE                 | Google アカウントの画像 URL |
| `created_at`   | timestamptz | NOT NULL, DEFAULT now()  | 作成日時                    |
| `updated_at`   | timestamptz | NOT NULL, DEFAULT now()  | 更新日時                    |

### 3.2 `public.lists`

ユーザーが作成する共有リスト。

| カラム       | 型          | 制約                                   | 説明                |
| ------------ | ----------- | -------------------------------------- | ------------------- |
| `id`         | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid() | リスト ID           |
| `name`       | text        | NOT NULL                               | リスト名            |
| `created_by` | uuid        | FOREIGN KEY, NOT NULL                  | 作成者のユーザー ID |
| `created_at` | timestamptz | NOT NULL, DEFAULT now()                | 作成日時            |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now()                | 更新日時            |

### 3.3 `public.list_members`

ユーザーとリストの所属関係。作成者もこのテーブルに登録します。

| カラム      | 型          | 制約                                   | 説明        |
| ----------- | ----------- | -------------------------------------- | ----------- |
| `id`        | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid() | 所属 ID     |
| `list_id`   | uuid        | FOREIGN KEY, NOT NULL                  | リスト ID   |
| `user_id`   | uuid        | FOREIGN KEY, NOT NULL                  | ユーザー ID |
| `joined_at` | timestamptz | NOT NULL, DEFAULT now()                | 参加日時    |

制約: `UNIQUE (list_id, user_id)`

### 3.4 `public.tags`

リスト単位で管理するタグ。

| カラム       | 型          | 制約                                   | 説明      |
| ------------ | ----------- | -------------------------------------- | --------- |
| `id`         | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid() | タグ ID   |
| `list_id`    | uuid        | FOREIGN KEY, NOT NULL                  | リスト ID |
| `name`       | text        | NOT NULL                               | タグ名    |
| `created_at` | timestamptz | NOT NULL, DEFAULT now()                | 作成日時  |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now()                | 更新日時  |

制約: `UNIQUE (list_id, name)`

### 3.5 `public.items`

リスト単位で管理する買い物アイテム。

| カラム         | 型          | 制約                                   | 説明        |
| -------------- | ----------- | -------------------------------------- | ----------- |
| `id`           | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid() | アイテム ID |
| `list_id`      | uuid        | FOREIGN KEY, NOT NULL                  | リスト ID   |
| `title`        | text        | NOT NULL                               | 商品名      |
| `quantity`     | integer     | NOT NULL, DEFAULT 1                    | 数量        |
| `is_completed` | boolean     | NOT NULL, DEFAULT false                | 完了状態    |
| `completed_at` | timestamptz | NULLABLE                               | 完了日時    |
| `created_at`   | timestamptz | NOT NULL, DEFAULT now()                | 作成日時    |
| `updated_at`   | timestamptz | NOT NULL, DEFAULT now()                | 更新日時    |

### 3.6 `public.item_tags`

アイテムとタグの多対多関係。

| カラム       | 型          | 制約                    | 説明        |
| ------------ | ----------- | ----------------------- | ----------- |
| `item_id`    | uuid        | FOREIGN KEY, NOT NULL   | アイテム ID |
| `tag_id`     | uuid        | FOREIGN KEY, NOT NULL   | タグ ID     |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | 作成日時    |

制約: `PRIMARY KEY (item_id, tag_id)`

---

## 4. Supabase SQL 定義

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

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, name)
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

create table public.item_tags (
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

create index list_members_user_id_idx on public.list_members(user_id);
create index tags_list_id_idx on public.tags(list_id);
create index items_list_id_idx on public.items(list_id);
create index items_completed_at_idx on public.items(completed_at);
```

`item_tags` への登録時は、アプリケーションまたは追加の DB 制約で `item_id` と `tag_id` が同じ `list_id` に属することを確認します。

---

## 5. Row Level Security

Supabase の Row Level Security を有効にし、所属リストのデータだけへアクセスできるようにします。

```sql
alter table public.users enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.tags enable row level security;
alter table public.items enable row level security;
alter table public.item_tags enable row level security;
```

代表的な所属判定:

```sql
exists (
  select 1
  from public.list_members
  where list_members.list_id = <対象リスト ID>
    and list_members.user_id = auth.uid()
)
```

実装時は、各テーブルの SELECT・INSERT・UPDATE・DELETE ポリシーでこの判定を使用します。サービスロールキーは RLS を迂回するため、サーバー専用とし、ブラウザへ渡しません。

---

## 6. リスト作成時の処理

リスト作成は次の処理を同一トランザクションで行います。

1. `lists` に作成者と名前を登録する
2. `list_members` に作成者を登録する
3. 作成したリストを返す

作成者の `created_by` と `list_members.user_id` は同じ Supabase Auth ユーザー ID です。

---

## 7. 自動削除バッチ

完了から 30 日経過したアイテムを削除します。Supabase の Scheduled Edge Function または pg_cron を利用します。

```sql
delete from public.items
where is_completed = true
  and completed_at < now() - interval '30 days';
```

`items` の削除により、外部キーの cascade で `item_tags` も削除されます。

---

## 8. サンプルデータ

### User

| id                | display_name | avatar_url                       |
| ----------------- | ------------ | -------------------------------- |
| `google-user-001` | Taro         | `https://example.com/taro.png`   |
| `google-user-002` | Hanako       | `https://example.com/hanako.png` |

### List

| id         | name         | created_by        |
| ---------- | ------------ | ----------------- |
| `list-001` | 日常の買い物 | `google-user-001` |

### ListMember

| list_id    | user_id           |
| ---------- | ----------------- |
| `list-001` | `google-user-001` |
| `list-001` | `google-user-002` |

---

## 9. 今後の検討項目

- [ ] リスト参加方式（招待コード・招待リンク・ユーザー指定）
- [ ] リスト作成者と一般メンバーの役割管理
- [ ] リスト作成者の退会・削除フロー
- [ ] RLS ポリシーの全テーブル分の具体化
- [ ] 完了アイテム削除の Scheduled Edge Function または pg_cron の選定

最終更新: 2026年8月17日

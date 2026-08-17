# データベーススキーマ設計（修正版）

## 1. 概要

IRU-MONO のデータベーススキーマ設計です。
PostgreSQL + Prisma ORM を前提とし、複数ユーザーで共有する買い物リストを扱う設計に整理しています。

本設計では以下を前提とします。

- ユーザーは個人で登録し、リストとは独立して管理する
- ユーザーがリストを作成し、作成者は自動的にメンバーになる
- 1 つのリストには複数のユーザーが所属できる
- 1 人のユーザーは複数のリストを作成・利用できる
- ユーザーとリストの所属関係は `ListMember` で管理する
- リストごとにタグとアイテムが共有される
- タグ名は同じリスト内で一意
- アイテムとタグの関係は多対多で管理する
- 完了済みアイテムは 30 日経過後に自動削除される

> 補足: `Tag` と `Item` はユーザーではなく `List` に所属し、アクセス時は `ListMember` による所属確認を行う

---

## 2. ER 図

```text
┌───────────────┐
│    List        │
├───────────────┤
│ id (PK)        │
│ name           │
│ createdById (FK)│
│ createdAt      │
│ updatedAt      │
└───────┬───────┘
        │ 1:N
        │
┌───────▼───────┐
│   ListMember   │
├───────────────┤
│ id (PK)        │
│ listId (FK)    │
│ userId (FK)    │
│ joinedAt       │
└───────┬───────┘
        │
        │ N:1
        │
┌───────▼───────┐
│     User      │
├───────────────┤
│ id (PK)        │
│ username       │
│ passwordHash    │
│ createdAt      │
│ updatedAt      │
└───────┬───────┘
        │ 1:N
        │
┌───────▼───────┐
│     Tag        │
├───────────────┤
│ id (PK)        │
│ name           │
│ listId (FK)    │
│ createdAt      │
│ updatedAt      │
└───────┬───────┘
        │ M:N
        │
┌───────▼───────┐
│    ItemTag     │
├───────────────┤
│ id (PK)        │
│ itemId (FK)    │
│ tagId (FK)     │
│ createdAt      │
└───────┬───────┘
        │
        │ 1:N
        │
┌───────▼───────┐
│     Item       │
├───────────────┤
│ id (PK)        │
│ title          │
│ quantity       │
│ isCompleted    │
│ listId (FK)    │
│ completedAt    │
│ createdAt      │
│ updatedAt      │
└───────────────┘
```

---

## 3. テーブル定義

### 3.1 List（リスト）

買い物リストの共有単位を管理するテーブル。

| カラム名    | データ型 | 制約                    | 説明                             |
| ----------- | -------- | ----------------------- | -------------------------------- |
| id          | String   | PRIMARY KEY             | リストID                         |
| name        | String   | NOT NULL                | リスト名（例: 「日常の買い物」） |
| createdById | String   | FOREIGN KEY, NOT NULL   | 作成者ユーザーID                 |
| createdAt   | DateTime | NOT NULL, DEFAULT now() | 作成日時                         |
| updatedAt   | DateTime | NOT NULL, DEFAULT now() | 更新日時                         |

**Prisma スキーマ**:

```prisma
model List {
  id          String       @id @default(cuid())
  name        String
  createdById String
  createdBy   User         @relation("ListCreator", fields: [createdById], references: [id])
  members     ListMember[]
  tags        Tag[]
  items       Item[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([createdById])
}
```

**設計メモ**:

- リスト作成時に、作成者を `ListMember` として登録する
- リストの共有範囲は `ListMember` に登録されたユーザーで決まる

---

### 3.2 ListMember（リストメンバー）

ユーザーとリストの所属関係を管理する中間テーブル。

| カラム名 | データ型 | 制約                    | 説明       |
| -------- | -------- | ----------------------- | ---------- |
| id       | String   | PRIMARY KEY             | 所属関係ID |
| listId   | String   | FOREIGN KEY, NOT NULL   | リストID   |
| userId   | String   | FOREIGN KEY, NOT NULL   | ユーザーID |
| joinedAt | DateTime | NOT NULL, DEFAULT now() | 参加日時   |

**Prisma スキーマ**:

```prisma
model ListMember {
  id       String   @id @default(cuid())
  listId   String
  userId   String
  list     List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())

  @@unique([listId, userId])
  @@index([listId])
  @@index([userId])
}
```

**設計意図**:

- 1 つのリストに複数ユーザーが参加できるようにする
- 1 人のユーザーが複数リストを作成・利用できるようにする
- リストごとの共有範囲を明確にする

### 3.3 User（ユーザー）

ログインユーザーを管理するテーブル。

| カラム名     | データ型 | 制約                    | 説明                 |
| ------------ | -------- | ----------------------- | -------------------- |
| id           | String   | PRIMARY KEY             | ユーザーID           |
| username     | String   | UNIQUE, NOT NULL        | ユーザー名           |
| passwordHash | String   | NOT NULL                | パスワードのハッシュ |
| createdAt    | DateTime | NOT NULL, DEFAULT now() | 作成日時             |
| updatedAt    | DateTime | NOT NULL, DEFAULT now() | 更新日時             |

**Prisma スキーマ**:

```prisma
model User {
  id           String       @id @default(cuid())
  username     String       @unique
  passwordHash String
  createdLists List[]       @relation("ListCreator")
  memberships  ListMember[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([username])
}
```

**設計意図**:

- 将来的な複数リスト所属を見据えて、`User` 自体に `listId` を持たせない
- 所属関係は `ListMember` で管理する

---

### 3.4 Tag（タグ）

買い物シーンの分類を行うタグ。

| カラム名  | データ型  | 制約                    | 説明                          |
| --------- | --------- | ----------------------- | ----------------------------- |
| id        | String    | PRIMARY KEY             | タグID                        |
| name      | String    | NOT NULL                | タグ名（例: スーパー）        |
| listId    | String    | FOREIGN KEY, NOT NULL   | 所属リストID                  |
| list      | List      | relation                | 所属リスト                    |
| items     | ItemTag[] |                         | 付き与された ItemTag レコード |
| createdAt | DateTime  | NOT NULL, DEFAULT now() | 作成日時                      |
| updatedAt | DateTime  | NOT NULL, DEFAULT now() | 更新日時                      |

**Prisma スキーマ**:

```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String
  listId    String
  list      List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  items     ItemTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([listId, name])
  @@index([listId])
}
```

**制約**:

- `(listId, name)` はユニーク
- 同じリスト内でタグ名の重複を禁止

---

### 3.5 Item（アイテム）

買い物リストの対象となるアイテム。

| カラム名    | データ型  | 制約                    | 説明         |
| ----------- | --------- | ----------------------- | ------------ |
| id          | String    | PRIMARY KEY             | アイテムID   |
| title       | String    | NOT NULL                | 商品名       |
| quantity    | Int       | NOT NULL, DEFAULT 1     | 数量         |
| isCompleted | Boolean   | NOT NULL, DEFAULT false | 完了状態     |
| listId      | String    | FOREIGN KEY, NOT NULL   | 所属リストID |
| list        | List      | relation                | 所属リスト   |
| tags        | ItemTag[] |                         | 関連するタグ |
| completedAt | DateTime? | NULLABLE                | 完了日時     |
| createdAt   | DateTime  | NOT NULL, DEFAULT now() | 作成日時     |
| updatedAt   | DateTime  | NOT NULL, DEFAULT now() | 更新日時     |

**Prisma スキーマ**:

```prisma
model Item {
  id          String    @id @default(cuid())
  title       String
  quantity    Int       @default(1)
  isCompleted Boolean   @default(false)
  listId      String
  list        List      @relation(fields: [listId], references: [id], onDelete: Cascade)
  tags        ItemTag[]
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([listId])
  @@index([isCompleted])
  @@index([completedAt])
}
```

**設計意図**:

- `completedAt` は完了した時刻を保持する
- 30 日経過した完了アイテムを自動削除するため、索引を保持する

---

### 3.6 ItemTag（アイテムとタグの中間テーブル）

1 つのアイテムに複数のタグを付与するための中間テーブル。

| カラム名  | データ型 | 制約                    | 説明           |
| --------- | -------- | ----------------------- | -------------- |
| id        | String   | PRIMARY KEY             | 関連レコードID |
| itemId    | String   | FOREIGN KEY, NOT NULL   | アイテムID     |
| tagId     | String   | FOREIGN KEY, NOT NULL   | タグID         |
| item      | Item     | relation                | 対象アイテム   |
| tag       | Tag      | relation                | 対象タグ       |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 作成日時       |

**Prisma スキーマ**:

```prisma
model ItemTag {
  id        String   @id @default(cuid())
  itemId    String
  tagId     String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([itemId, tagId])
  @@index([itemId])
  @@index([tagId])
}
```

**制約**:

- 同一アイテムに同一タグを重複登録しない
- タグまたはアイテムが削除されると、この中間レコードも削除する

---

## 4. Prisma スキーマ（完全版）

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model List {
  id          String       @id @default(cuid())
  name        String
  createdById String
  createdBy   User         @relation("ListCreator", fields: [createdById], references: [id])
  members     ListMember[]
  tags        Tag[]
  items       Item[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([createdById])
}

model ListMember {
  id       String   @id @default(cuid())
  listId   String
  userId   String
  list     List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())

  @@unique([listId, userId])
  @@index([listId])
  @@index([userId])
}

model User {
  id           String       @id @default(cuid())
  username     String       @unique
  passwordHash String
  createdLists List[]       @relation("ListCreator")
  memberships  ListMember[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([username])
}

model Tag {
  id        String   @id @default(cuid())
  name      String
  listId    String
  list      List     @relation(fields: [listId], references: [id], onDelete: Cascade)
  items     ItemTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([listId, name])
  @@index([listId])
}

model Item {
  id          String    @id @default(cuid())
  title       String
  quantity    Int       @default(1)
  isCompleted Boolean   @default(false)
  listId      String
  list        List      @relation(fields: [listId], references: [id], onDelete: Cascade)
  tags        ItemTag[]
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([listId])
  @@index([isCompleted])
  @@index([completedAt])
}

model ItemTag {
  id        String   @id @default(cuid())
  itemId    String
  tagId     String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([itemId, tagId])
  @@index([itemId])
  @@index([tagId])
}
```

---

## 5. スキーマの特徴

### 5.1 リスト単位でのデータ分離

- `ListMember` でユーザーとリストの所属関係を管理する
- `Tag` と `Item` は `listId` を持ち、同じリストのデータのみ扱う
- これにより、所属していないリストのデータへのアクセスを防止できる
- 同じユーザーが複数リストを利用しても、データをリスト単位で分離できる

### 5.2 カスケード削除

- リストが削除された場合、その配下のメンバー・タグ・アイテムが削除される
- タグが削除された場合、関連する `ItemTag` が自動削除される
- アイテムが削除された場合、関連する `ItemTag` が自動削除される

### 5.3 多対多関係

- `ItemTag` 中間テーブルで実装
- 1 つのアイテムに複数のタグを付与可能
- 1 つのタグが複数のアイテムに付与可能

### 5.4 自動削除バッチ

完了済みアイテムの削除条件は次の通りです。

```sql
DELETE FROM "Item"
WHERE "isCompleted" = true
  AND "completedAt" < NOW() - INTERVAL '30 days';
```

Prisma では以下のように削除できます。

```ts
await prisma.item.deleteMany({
  where: {
    isCompleted: true,
    completedAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
```

---

## 6. インデックス設計

| テーブル   | カラム      | 用途                     |
| ---------- | ----------- | ------------------------ |
| List       | id          | 主要キー                 |
| ListMember | listId      | リストのメンバー取得     |
| ListMember | userId      | ユーザーの所属リスト取得 |
| User       | username    | ログイン検索             |
| Tag        | listId      | リストのタグ一覧取得     |
| Item       | listId      | リストのアイテム一覧取得 |
| Item       | isCompleted | 完了/未完了の選別        |
| Item       | completedAt | 自動削除バッチ           |
| ItemTag    | itemId      | アイテムからタグ取得     |
| ItemTag    | tagId       | タグからアイテム取得     |

---

## 7. 初期化スクリプト

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

本番環境では:

```bash
pnpm prisma migrate deploy
```

---

## 8. サンプルデータ

### List テーブル

| id       | name         | createdById |
| -------- | ------------ | ----------- |
| list_001 | 日常の買い物 | usr_001     |

### ListMember テーブル

| id     | listId   | userId  |
| ------ | -------- | ------- |
| lm_001 | list_001 | usr_001 |
| lm_002 | list_001 | usr_002 |

### User テーブル

| id      | username | passwordHash |
| ------- | -------- | ------------ |
| usr_001 | taro     | $2b$10$...   |
| usr_002 | hanako   | $2b$10$...   |

### Tag テーブル

| id      | name           | listId   |
| ------- | -------------- | -------- |
| tag_001 | スーパー       | list_001 |
| tag_002 | ドラッグストア | list_001 |
| tag_003 | コストコ       | list_001 |

### Item テーブル

| id      | title  | quantity | isCompleted | listId   | completedAt          |
| ------- | ------ | -------- | ----------- | -------- | -------------------- |
| itm_001 | 牛乳   | 1        | false       | list_001 | NULL                 |
| itm_002 | パン   | 2        | true        | list_001 | 2026-08-17T10:00:00Z |
| itm_003 | 風邪薬 | 1        | false       | list_001 | NULL                 |

### ItemTag テーブル

| id       | itemId  | tagId   |
| -------- | ------- | ------- |
| iTag_001 | itm_001 | tag_001 |
| iTag_002 | itm_001 | tag_002 |
| iTag_003 | itm_003 | tag_002 |

---

## 9. 今後の検討項目

- [ ] リスト参加方式（招待コード・招待リンク・ユーザー指定）
- [ ] リスト作成者と一般メンバーの役割管理
- [ ] リスト作成者の退会・削除フロー
- [ ] 通知設定テーブル
- [ ] 監査ログテーブル
- [ ] キャッシング戦略

---

最終更新: 2026年8月17日

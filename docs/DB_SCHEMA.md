# データベーススキーマ設計

## 概要

IRU-MONO のデータベーススキーマ設計です。
PostgreSQL + Prisma ORM を使用した ER 図とテーブル定義を記載しています。

---

## ER 図

```
┌─────────────┐
│   Users     │
├─────────────┤
│ id (PK)     │
│ username    │◄─────────┐
│ password    │          │
│ createdAt   │          │
│ updatedAt   │          │
└─────────────┘          │
                         │ 1:N
                         │
┌─────────────┐          │
│   Tags      │          │
├─────────────┤          │
│ id (PK)     │          │
│ name        │          │
│ userId (FK) ├──────────┘
│ createdAt   │
│ updatedAt   │
└─────────────┘
      ▲
      │ M:N
      │
┌──────────────────┐
│   ItemTags       │
├──────────────────┤
│ id (PK)          │
│ itemId (FK)      │
│ tagId (FK)       │
│ createdAt        │
└──────────────────┘
      ▲
      │
      │ 1:N
      │
┌─────────────┐
│   Items     │
├─────────────┤
│ id (PK)     │
│ title       │
│ quantity    │
│ isCompleted │
│ userId (FK) │
│ completedAt │
│ createdAt   │
│ updatedAt   │
└─────────────┘
      ▲
      │ N:1
      │
      └─────────────┐
                    │
            ┌───────┴────────┐
            │                │
       ユーザーA         ユーザーB
   (複数デバイス)    (複数デバイス)
```

---

## テーブル定義

### 1. Users（ユーザー）

ユーザーアカウント情報を管理するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | UUID | PRIMARY KEY | ユーザーの一意識別子 |
| username | VARCHAR(255) | UNIQUE, NOT NULL | ユーザー名（ログイン時に使用） |
| password | VARCHAR(255) | NOT NULL | bcrypt でハッシュ化されたパスワード |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | 更新日時 |

**Prisma スキーマ**:
```prisma
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  items     Item[]
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**インデックス**:
- `username` — ログイン時の検索高速化

---

### 2. Tags（タグ）

買い物シーンを分類するためのタグ。

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | UUID | PRIMARY KEY | タグの一意識別子 |
| name | VARCHAR(255) | NOT NULL | タグ名（例：「スーパー」「ドラッグストア」） |
| userId | UUID | FOREIGN KEY, NOT NULL | ユーザーID（タグの所有者） |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | 更新日時 |

**Prisma スキーマ**:
```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     ItemTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, name])
}
```

**制約**:
- `(userId, name)` のユニーク制約 — ユーザーごとに重複するタグ名は不可

**インデックス**:
- `userId` — ユーザーのタグ一覧取得時の高速化

---

### 3. Items（アイテム）

買い物リストのアイテム。

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | UUID | PRIMARY KEY | アイテムの一意識別子 |
| title | VARCHAR(255) | NOT NULL | アイテム名（商品名） |
| quantity | INT | NOT NULL, DEFAULT 1 | 数量 |
| isCompleted | BOOLEAN | NOT NULL, DEFAULT false | 完了フラグ（購入済み/未購入） |
| userId | UUID | FOREIGN KEY, NOT NULL | ユーザーID（アイテムの所有者） |
| completedAt | TIMESTAMP | NULLABLE | 完了日時（完了した場合のみ） |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | 更新日時 |

**Prisma スキーマ**:
```prisma
model Item {
  id          String   @id @default(cuid())
  title       String
  quantity    Int      @default(1)
  isCompleted Boolean  @default(false)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags        ItemTag[]
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([isCompleted])
}
```

**インデックス**:
- `userId` — ユーザーのアイテム一覧取得時の高速化
- `isCompleted` — 完了/未完了アイテムの絞り込み時の高速化

---

### 4. ItemTags（アイテム・タグ中間テーブル）

アイテムとタグの多対多（M:N）関係を管理。
1つのアイテムに複数のタグを付与可能。

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | UUID | PRIMARY KEY | 関連付けの一意識別子 |
| itemId | UUID | FOREIGN KEY, NOT NULL | アイテムID |
| tagId | UUID | FOREIGN KEY, NOT NULL | タグID |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | 作成日時 |

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
}
```

**制約**:
- `(itemId, tagId)` のユニーク制約 — 同じアイテムに同じタグは1回のみ

**インデックス**:
- `itemId` — アイテムのタグ取得時の高速化
- `tagId` — タグでアイテムを検索時の高速化

---

## Prisma スキーマファイル（完全版）

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  items     Item[]
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Tag {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items     ItemTag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, name])
  @@index([userId])
}

model Item {
  id          String   @id @default(cuid())
  title       String
  quantity    Int      @default(1)
  isCompleted Boolean  @default(false)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags        ItemTag[]
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
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

## スキーマの特徴

### 1. カスケード削除（Cascade Delete）

- ユーザーが削除されると、そのユーザーに関連する全タグ・アイテムが自動削除
- タグが削除されると、関連する ItemTag レコードが自動削除
- アイテムが削除されると、関連する ItemTag レコードが自動削除

**メリット**: 手動でのクリーンアップが不要、データの一貫性を保証

### 2. 多対多関係の実装

- ItemTag 中間テーブルで実装
- 1つのアイテムに複数のタグを付与可能
- 1つのタグを複数のアイテムに付与可能

**例**：
```
アイテム「牛乳」
├── タグ「スーパー」
└── タグ「コンビニ」

アイテム「風邪薬」
├── タグ「ドラッグストア」
├── タグ「スーパー」
└── タグ「コンビニ」
```

### 3. 完了アイテムの自動削除

`completedAt` カラムで完了日時を記録。
バッチ処理で 30 日以上前のアイテムを削除：

```sql
DELETE FROM "Item"
WHERE "isCompleted" = true
  AND "completedAt" < NOW() - INTERVAL '30 days';
```

または Prisma:
```typescript
await prisma.item.deleteMany({
  where: {
    isCompleted: true,
    completedAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
```

### 4. インデックス設計

クエリの高速化を考慮したインデックスを配置：

| テーブル | カラム | 用途 |
|---------|--------|------|
| User | username | ログイン検索 |
| Tag | userId | ユーザーのタグ一覧 |
| Item | userId | ユーザーのアイテム一覧 |
| Item | isCompleted | 完了/未完了フィルター |
| Item | completedAt | 自動削除バッチ処理 |
| ItemTag | itemId, tagId | タグ検索の高速化 |

---

## 初期化スクリプト（Prisma マイグレーション）

```bash
# マイグレーションファイルを生成
pnpm prisma migrate dev --name init

# 本番環境にマイグレーション適用
pnpm prisma migrate deploy

# Prisma Client を再生成
pnpm prisma generate
```

---

## データ例

### Users テーブル

| id | username | password（ハッシュ） |
|----|---------|----|
| usr_001 | taro | $2b$10$... |
| usr_002 | hanako | $2b$10$... |

### Tags テーブル

| id | name | userId |
|----|------|--------|
| tag_001 | スーパー | usr_001 |
| tag_002 | ドラッグストア | usr_001 |
| tag_003 | コストコ | usr_001 |
| tag_004 | スーパー | usr_002 |

### Items テーブル

| id | title | quantity | isCompleted | userId | completedAt |
|----|-------|----------|-------------|--------|------------|
| itm_001 | 牛乳 | 1 | false | usr_001 | NULL |
| itm_002 | パン | 2 | true | usr_001 | 2026-08-17 |
| itm_003 | 風邪薬 | 1 | false | usr_001 | NULL |
| itm_004 | 米 | 5 | true | usr_002 | 2026-08-16 |

### ItemTags テーブル

| id | itemId | tagId |
|----|--------|-------|
| iTag_001 | itm_001 | tag_001 |
| iTag_002 | itm_001 | tag_002 |
| iTag_003 | itm_003 | tag_002 |

---

## 今後の検討項目

- [ ] 監査ログテーブル（削除・編集履歴）
- [ ] 通知設定テーブル
- [ ] ショッピング履歴テーブル
- [ ] キャッシング戦略

---

最終更新: 2026年8月17日

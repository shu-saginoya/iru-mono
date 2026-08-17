# API 仕様書

## 概要

IRU-MONO の REST API 仕様書です。
Next.js API Routes で実装される全エンドポイントの定義を記載しています。

---

## ベース URL

```
http://localhost:3000/api    (開発環境)
https://iru-mono.vercel.app/api    (本番環境)
```

---

## 認証

### JWT トークン

- **タイプ**: Bearer Token
- **ヘッダー**: `Authorization: Bearer <token>`
- **保存場所**: localStorage または httpOnly Cookie
- **有効期限**: 7 日間

### ログイン後の使用方法

```bash
curl -H "Authorization: Bearer eyJhbGc..." \
  https://iru-mono.vercel.app/api/items
```

---

## エンドポイント一覧

### 認証関連

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| POST | `/auth/signup` | ユーザー登録 |
| POST | `/auth/login` | ログイン |
| POST | `/auth/logout` | ログアウト |
| GET | `/auth/me` | 現在ログイン中のユーザー情報取得 |

### タグ関連

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/tags` | タグ一覧取得 |
| POST | `/tags` | タグ作成 |
| PUT | `/tags/:id` | タグ更新 |
| DELETE | `/tags/:id` | タグ削除 |

### アイテム関連

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/items` | アイテム一覧取得（フィルター対応） |
| POST | `/items` | アイテム作成 |
| PUT | `/items/:id` | アイテム更新 |
| DELETE | `/items/:id` | アイテム削除（手動削除は未実装） |
| PATCH | `/items/:id/toggle` | アイテムの完了/未完了を切り替え |

---

## 詳細仕様

### 認証

#### POST `/auth/signup`

**説明**: 新しいユーザーを作成

**リクエスト**:
```json
{
  "username": "taro",
  "password": "password123"
}
```

**レスポンス (200 OK)**:
```json
{
  "id": "usr_001",
  "username": "taro",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 604800
}
```

**エラーレスポンス (400 Bad Request)**:
```json
{
  "error": "Username already exists"
}
```

**バリデーション**:
- `username`: 3文字以上、255文字以下、半角英数字とアンダースコアのみ
- `password`: 8文字以上、255文字以下

---

#### POST `/auth/login`

**説明**: ユーザーがログイン

**リクエスト**:
```json
{
  "username": "taro",
  "password": "password123"
}
```

**レスポンス (200 OK)**:
```json
{
  "id": "usr_001",
  "username": "taro",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 604800
}
```

**エラーレスポンス (401 Unauthorized)**:
```json
{
  "error": "Invalid credentials"
}
```

---

#### POST `/auth/logout`

**説明**: ログアウト（トークン無効化）

**認証**: 必須（Bearer Token）

**リクエスト**: ボディなし

**レスポンス (200 OK)**:
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET `/auth/me`

**説明**: 現在ログイン中のユーザー情報取得

**認証**: 必須（Bearer Token）

**リクエスト**: ボディなし

**レスポンス (200 OK)**:
```json
{
  "id": "usr_001",
  "username": "taro",
  "createdAt": "2026-08-17T10:00:00Z"
}
```

**エラーレスポンス (401 Unauthorized)**:
```json
{
  "error": "Unauthorized"
}
```

---

### タグ

#### GET `/tags`

**説明**: ログイン中のユーザーのタグ一覧を取得

**認証**: 必須（Bearer Token）

**クエリパラメータ**: なし

**レスポンス (200 OK)**:
```json
{
  "data": [
    {
      "id": "tag_001",
      "name": "スーパー",
      "createdAt": "2026-08-17T10:00:00Z",
      "updatedAt": "2026-08-17T10:00:00Z"
    },
    {
      "id": "tag_002",
      "name": "ドラッグストア",
      "createdAt": "2026-08-17T10:05:00Z",
      "updatedAt": "2026-08-17T10:05:00Z"
    }
  ],
  "total": 2
}
```

---

#### POST `/tags`

**説明**: 新しいタグを作成

**認証**: 必須（Bearer Token）

**リクエスト**:
```json
{
  "name": "コストコ"
}
```

**レスポンス (201 Created)**:
```json
{
  "id": "tag_003",
  "name": "コストコ",
  "userId": "usr_001",
  "createdAt": "2026-08-17T10:10:00Z",
  "updatedAt": "2026-08-17T10:10:00Z"
}
```

**エラーレスポンス (400 Bad Request)**:
```json
{
  "error": "Tag name already exists for this user"
}
```

**バリデーション**:
- `name`: 1文字以上、255文字以下、ユーザー内で一意

---

#### PUT `/tags/:id`

**説明**: タグ名を更新

**認証**: 必須（Bearer Token）

**パラメータ**: `id` — タグID

**リクエスト**:
```json
{
  "name": "百均"
}
```

**レスポンス (200 OK)**:
```json
{
  "id": "tag_001",
  "name": "百均",
  "userId": "usr_001",
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:15:00Z"
}
```

**エラーレスポンス (404 Not Found)**:
```json
{
  "error": "Tag not found"
}
```

---

#### DELETE `/tags/:id`

**説明**: タグを削除（関連する ItemTag も自動削除）

**認証**: 必須（Bearer Token）

**パラメータ**: `id` — タグID

**レスポンス (200 OK)**:
```json
{
  "message": "Tag deleted successfully"
}
```

**エラーレスポンス (404 Not Found)**:
```json
{
  "error": "Tag not found"
}
```

---

### アイテム

#### GET `/items`

**説明**: アイテム一覧取得（フィルター対応）

**認証**: 必須（Bearer Token）

**クエリパラメータ**:
| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|---------|----|
| `status` | string | `pending` | `pending`（未完了）/ `completed`（完了）/ `all`（全て） |
| `tagId` | string | なし | 特定のタグでフィルター（複数指定可：`?tagId=tag_001&tagId=tag_002`） |
| `sort` | string | `createdAt:desc` | ソート（`createdAt:asc`, `createdAt:desc`, `completedAt:desc`） |
| `limit` | number | 50 | 取得件数（最大100） |
| `offset` | number | 0 | オフセット |

**リクエスト例**:
```
GET /items?status=pending&tagId=tag_001&sort=createdAt:desc&limit=20
```

**レスポンス (200 OK)**:
```json
{
  "data": [
    {
      "id": "itm_001",
      "title": "牛乳",
      "quantity": 1,
      "isCompleted": false,
      "userId": "usr_001",
      "completedAt": null,
      "tags": [
        {
          "id": "tag_001",
          "name": "スーパー"
        },
        {
          "id": "tag_002",
          "name": "ドラッグストア"
        }
      ],
      "createdAt": "2026-08-17T10:00:00Z",
      "updatedAt": "2026-08-17T10:00:00Z"
    },
    {
      "id": "itm_003",
      "title": "風邪薬",
      "quantity": 1,
      "isCompleted": false,
      "userId": "usr_001",
      "completedAt": null,
      "tags": [
        {
          "id": "tag_002",
          "name": "ドラッグストア"
        }
      ],
      "createdAt": "2026-08-17T10:05:00Z",
      "updatedAt": "2026-08-17T10:05:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

#### POST `/items`

**説明**: 新しいアイテムを作成

**認証**: 必須（Bearer Token）

**リクエスト**:
```json
{
  "title": "牛乳",
  "quantity": 1,
  "tagIds": ["tag_001", "tag_002"]
}
```

**レスポンス (201 Created)**:
```json
{
  "id": "itm_001",
  "title": "牛乳",
  "quantity": 1,
  "isCompleted": false,
  "userId": "usr_001",
  "completedAt": null,
  "tags": [
    {
      "id": "tag_001",
      "name": "スーパー"
    },
    {
      "id": "tag_002",
      "name": "ドラッグストア"
    }
  ],
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:00:00Z"
}
```

**バリデーション**:
- `title`: 1文字以上、255文字以下、必須
- `quantity`: 1以上の整数、デフォルト 1
- `tagIds`: 配列、0個以上のタグID

---

#### PUT `/items/:id`

**説明**: アイテムを更新

**認証**: 必須（Bearer Token）

**パラメータ**: `id` — アイテムID

**リクエスト**:
```json
{
  "title": "低脂肪牛乳",
  "quantity": 2,
  "tagIds": ["tag_001"]
}
```

**レスポンス (200 OK)**:
```json
{
  "id": "itm_001",
  "title": "低脂肪牛乳",
  "quantity": 2,
  "isCompleted": false,
  "userId": "usr_001",
  "completedAt": null,
  "tags": [
    {
      "id": "tag_001",
      "name": "スーパー"
    }
  ],
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:20:00Z"
}
```

---

#### PATCH `/items/:id/toggle`

**説明**: アイテムの完了状態を切り替え

**認証**: 必須（Bearer Token）

**パラメータ**: `id` — アイテムID

**リクエスト**: ボディなし

**レスポンス (200 OK)**:
```json
{
  "id": "itm_001",
  "title": "牛乳",
  "quantity": 1,
  "isCompleted": true,
  "userId": "usr_001",
  "completedAt": "2026-08-17T10:25:00Z",
  "tags": [
    {
      "id": "tag_001",
      "name": "スーパー"
    }
  ],
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:25:00Z"
}
```

**動作**:
- `isCompleted` が false → true に切り替え、`completedAt` に現在時刻を設定
- `isCompleted` が true → false に切り替え、`completedAt` を NULL に設定

---

#### DELETE `/items/:id`

**説明**: アイテムを削除

**認証**: 必須（Bearer Token）

**パラメータ**: `id` — アイテムID

**リクエスト**: ボディなし

**レスポンス (200 OK)**:
```json
{
  "message": "Item deleted successfully"
}
```

**エラーレスポンス (404 Not Found)**:
```json
{
  "error": "Item not found"
}
```

**注記**: 完了アイテムも削除可能です。ただし、自動削除は 30 日経過後に実行されます。

---

## エラーハンドリング

### 共通エラーレスポンス形式

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP ステータスコード

| ステータス | 説明 |
|-----------|------|
| **200 OK** | リクエスト成功 |
| **201 Created** | リソース作成成功 |
| **400 Bad Request** | リクエストの形式が不正 |
| **401 Unauthorized** | 認証されていない |
| **403 Forbidden** | 権限がない（他ユーザーのリソースへのアクセス） |
| **404 Not Found** | リソースが見つからない |
| **409 Conflict** | リソースが既に存在（重複） |
| **500 Internal Server Error** | サーバーエラー |

---

## レート制限

- **制限なし**（開発段階）
- 本番運用時に必要に応じて実装予定

---

## WebSocket（リアルタイム同期）

### 接続

```javascript
const socket = io('https://iru-mono.vercel.app');

socket.on('connect', () => {
  console.log('Connected to server');
  socket.emit('authenticate', { token: 'JWT_TOKEN' });
});
```

### イベント

#### アイテム更新通知

```javascript
// ユーザーがアイテムを作成・更新・削除したとき
socket.on('item:created', (item) => {
  console.log('New item:', item);
});

socket.on('item:updated', (item) => {
  console.log('Item updated:', item);
});

socket.on('item:deleted', (itemId) => {
  console.log('Item deleted:', itemId);
});
```

#### タグ更新通知

```javascript
socket.on('tag:created', (tag) => {
  console.log('New tag:', tag);
});

socket.on('tag:updated', (tag) => {
  console.log('Tag updated:', tag);
});

socket.on('tag:deleted', (tagId) => {
  console.log('Tag deleted:', tagId);
});
```

---

## cURL サンプル

### ユーザー登録

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "taro",
    "password": "password123"
  }'
```

### ログイン

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "taro",
    "password": "password123"
  }'
```

### タグ一覧取得

```bash
curl -X GET http://localhost:3000/api/tags \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### タグ作成

```bash
curl -X POST http://localhost:3000/api/tags \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "スーパー"
  }'
```

### アイテム作成

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "牛乳",
    "quantity": 1,
    "tagIds": ["tag_001", "tag_002"]
  }'
```

### アイテム一覧取得（フィルター）

```bash
curl -X GET 'http://localhost:3000/api/items?status=pending&tagId=tag_001&sort=createdAt:desc' \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### アイテム完了切り替え

```bash
curl -X PATCH http://localhost:3000/api/items/itm_001/toggle \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 実装ロードマップ

### フェーズ1: 認証 + CRUD

- [ ] `POST /auth/signup`
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `GET /tags`
- [ ] `POST /tags`
- [ ] `PUT /tags/:id`
- [ ] `DELETE /tags/:id`
- [ ] `GET /items`
- [ ] `POST /items`
- [ ] `PUT /items/:id`
- [ ] `PATCH /items/:id/toggle`
- [ ] `DELETE /items/:id`

### フェーズ2: リアルタイム同期

- [ ] WebSocket サーバー統合
- [ ] `item:created` イベント
- [ ] `item:updated` イベント
- [ ] `item:deleted` イベント
- [ ] `tag:created` イベント
- [ ] `tag:updated` イベント
- [ ] `tag:deleted` イベント

### フェーズ3: 運用機能

- [ ] 完了アイテム自動削除バッチ
- [ ] エラーログ・モニタリング
- [ ] レート制限

---

最終更新: 2026年8月17日

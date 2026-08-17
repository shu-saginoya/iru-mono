# API 仕様書（修正版）

## 1. 概要

IRU-MONO の REST API 仕様書です。
Next.js API Routes によって実装されるエンドポイントを定義します。

本仕様では、以下を前提とします。

- ユーザーは個人でアカウントを登録できる
- ユーザーは複数のリストを作成・利用できる
- リスト作成者は他のユーザーを参加させることができる
- タグとアイテムはユーザーではなくリストに所属する
- 同じリストのメンバーがタグとアイテムを共有する
- 認証は JWT + httpOnly Cookie を使用する
- 完了済みアイテムは自動削除のみとし、手動削除は禁止する
- リアルタイム同期はリスト単位で行う

---

## 2. ベース URL

```text
http://localhost:3000/api       (開発環境)
https://iru-mono.vercel.app/api  (本番環境)
```

---

## 3. 認証方式

### 3.1 認証方針

- 認証方式: JWT
- 保存場所: httpOnly Cookie
- 有効期限: 7 日間
- API 呼び出し時は Cookie を自動送信する
- ローカル開発時のみ `Authorization: Bearer <token>` を許容する

### 3.2 認証済みリクエスト

```bash
curl -X GET http://localhost:3000/api/lists \
  --cookie "access_token=YOUR_JWT"
```

### 3.3 認証失敗時

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

## 4. 共通仕様

### 4.1 リソーススコープ

- `User` は個人アカウントとして管理する
- `List` はユーザーが作成する共有リソースである
- `ListMember` に登録されたユーザーだけが、そのリストのデータへアクセスできる
- `Tag` と `Item` は必ず `listId` を持つ
- リスト ID は URL の `:listId` またはリスト作成・取得レスポンスで扱う
- 別のリストに属するタグ・アイテム ID を指定した場合は `403 Forbidden` または `404 Not Found` を返す

### 4.2 共通レスポンス

#### 単一オブジェクト

```json
{
  "id": "list_001",
  "name": "日常の買い物"
}
```

#### コレクション

```json
{
  "data": [
    {
      "id": "list_001",
      "name": "日常の買い物"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 成功メッセージ

```json
{
  "message": "Operation completed successfully"
}
```

### 4.3 共通エラー

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 4.4 HTTP ステータスコード

| ステータス                | 説明                 |
| ------------------------- | -------------------- |
| 200 OK                    | 成功                 |
| 201 Created               | 作成成功             |
| 204 No Content            | 削除成功（本文なし） |
| 400 Bad Request           | リクエスト不正       |
| 401 Unauthorized          | 認証失敗             |
| 403 Forbidden             | 所属外または権限不足 |
| 404 Not Found             | リソース未存在       |
| 409 Conflict              | 重複・状態競合       |
| 422 Unprocessable Entity  | バリデーション失敗   |
| 500 Internal Server Error | サーバーエラー       |

---

## 5. エンドポイント一覧

### 5.1 認証

| メソッド | エンドポイント | 説明                               |
| -------- | -------------- | ---------------------------------- |
| POST     | `/auth/signup` | ユーザー登録                       |
| POST     | `/auth/login`  | ログイン                           |
| POST     | `/auth/logout` | ログアウト                         |
| GET      | `/auth/me`     | 自分のプロフィールと所属リスト取得 |

### 5.2 リスト

| メソッド | エンドポイント                   | 説明                         |
| -------- | -------------------------------- | ---------------------------- |
| GET      | `/lists`                         | 自分が所属するリスト一覧取得 |
| POST     | `/lists`                         | リスト作成                   |
| GET      | `/lists/:listId`                 | リスト情報とメンバー取得     |
| PUT      | `/lists/:listId`                 | リスト名更新                 |
| DELETE   | `/lists/:listId`                 | リスト削除                   |
| POST     | `/lists/:listId/members`         | ユーザーを参加させる         |
| DELETE   | `/lists/:listId/members/:userId` | ユーザーをリストから除外     |
| DELETE   | `/lists/:listId/membership`      | 自分がリストから退会         |

### 5.3 タグ

| メソッド | エンドポイント               | 説明                 |
| -------- | ---------------------------- | -------------------- |
| GET      | `/lists/:listId/tags`        | リストのタグ一覧取得 |
| POST     | `/lists/:listId/tags`        | リストにタグ作成     |
| PUT      | `/lists/:listId/tags/:tagId` | タグ更新             |
| DELETE   | `/lists/:listId/tags/:tagId` | タグ削除             |

### 5.4 アイテム

| メソッド | エンドポイント                        | 説明                     |
| -------- | ------------------------------------- | ------------------------ |
| GET      | `/lists/:listId/items`                | リストのアイテム一覧取得 |
| POST     | `/lists/:listId/items`                | リストにアイテム作成     |
| PUT      | `/lists/:listId/items/:itemId`        | アイテム更新             |
| PATCH    | `/lists/:listId/items/:itemId/toggle` | 完了状態切り替え         |
| DELETE   | `/lists/:listId/items/:itemId`        | 未完了アイテム削除       |

---

## 6. 詳細仕様

### 6.1 POST `/auth/signup`

**説明**: 個人ユーザーを登録する。リストは自動作成しない。

**認証**: 不要

**リクエスト**:

```json
{
  "username": "taro",
  "password": "password123"
}
```

**レスポンス (201 Created)**:

```json
{
  "id": "usr_001",
  "username": "taro",
  "createdAt": "2026-08-17T10:00:00Z"
}
```

**バリデーション**:

- `username`: 3〜20 文字、英数字とアンダースコアのみ
- `password`: 8〜255 文字
- `username` は一意

**Cookie 設定**:

- `access_token=<JWT>`
- `httpOnly: true`
- `sameSite: lax`
- `secure: true`（本番）

### 6.2 POST `/auth/login`

**説明**: ユーザーを認証し、Cookie に JWT を設定する。

**認証**: 不要

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
  "createdAt": "2026-08-17T10:00:00Z"
}
```

**エラー**: `401 INVALID_CREDENTIALS`

### 6.3 POST `/auth/logout`

**説明**: 現在のセッションを終了し、Cookie を削除する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "message": "Logged out successfully"
}
```

### 6.4 GET `/auth/me`

**説明**: 自分のユーザー情報と所属リストを取得する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "id": "usr_001",
  "username": "taro",
  "lists": [
    {
      "id": "list_001",
      "name": "日常の買い物",
      "joinedAt": "2026-08-17T10:00:00Z"
    }
  ],
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:05:00Z"
}
```

---

## 7. リスト API

### 7.1 GET `/lists`

**説明**: 現在のユーザーが所属するリストを取得する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "data": [
    {
      "id": "list_001",
      "name": "日常の買い物",
      "memberCount": 2,
      "joinedAt": "2026-08-17T10:00:00Z"
    },
    {
      "id": "list_002",
      "name": "旅行用品",
      "memberCount": 1,
      "joinedAt": "2026-08-17T10:05:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

### 7.2 POST `/lists`

**説明**: 新しいリストを作成する。作成者は自動的にメンバーになる。

**認証**: 必須

**リクエスト**:

```json
{
  "name": "日常の買い物"
}
```

**レスポンス (201 Created)**:

```json
{
  "id": "list_001",
  "name": "日常の買い物",
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:00:00Z",
  "members": [
    {
      "userId": "usr_001",
      "username": "taro",
      "joinedAt": "2026-08-17T10:00:00Z"
    }
  ]
}
```

**バリデーション**:

- `name`: 1〜100 文字、必須

### 7.3 GET `/lists/:listId`

**説明**: 所属しているリストの情報とメンバーを取得する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "id": "list_001",
  "name": "日常の買い物",
  "members": [
    {
      "userId": "usr_001",
      "username": "taro",
      "joinedAt": "2026-08-17T10:00:00Z"
    }
  ],
  "createdAt": "2026-08-17T10:00:00Z",
  "updatedAt": "2026-08-17T10:00:00Z"
}
```

### 7.4 PUT `/lists/:listId`

**説明**: リスト名を更新する。

**認証**: 必須

**リクエスト**:

```json
{
  "name": "週末の買い物"
}
```

**レスポンス**: 更新後の `List` オブジェクト（`200 OK`）

### 7.5 DELETE `/lists/:listId`

**説明**: リストと所属メンバー、リスト内のタグ・アイテムを削除する。

**認証**: 必須

**レスポンス**: `204 No Content`

**注記**: 作成者の削除権限や、作成者が退会する場合の扱いは今後確定する。

### 7.6 POST `/lists/:listId/members`

**説明**: 指定したユーザーをリストに参加させる。

**認証**: 必須

**リクエスト**:

```json
{
  "userId": "usr_002"
}
```

**レスポンス (201 Created)**:

```json
{
  "listId": "list_001",
  "userId": "usr_002",
  "joinedAt": "2026-08-17T10:10:00Z"
}
```

**エラー**:

- `404 USER_NOT_FOUND`
- `409 MEMBER_ALREADY_EXISTS`
- `403 FORBIDDEN`（参加させる権限がない場合）

### 7.7 DELETE `/lists/:listId/members/:userId`

**説明**: 指定したユーザーをリストから除外する。

**認証**: 必須

**レスポンス**: `204 No Content`

### 7.8 DELETE `/lists/:listId/membership`

**説明**: 自分自身がリストから退会する。

**認証**: 必須

**レスポンス**: `204 No Content`

---

## 8. タグ API

### 8.1 GET `/lists/:listId/tags`

**説明**: リストのタグ一覧を取得する。

**認証**: 対象リストのメンバーであること

**レスポンス例**:

```json
{
  "data": [
    {
      "id": "tag_001",
      "name": "スーパー",
      "listId": "list_001",
      "createdAt": "2026-08-17T10:00:00Z",
      "updatedAt": "2026-08-17T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 8.2 POST `/lists/:listId/tags`

**説明**: リストにタグを作成する。

**リクエスト**:

```json
{
  "name": "スーパー"
}
```

**バリデーション**:

- `name`: 1〜50 文字
- 同じリスト内で重複不可

**エラー**: `409 TAG_ALREADY_EXISTS`

### 8.3 PUT `/lists/:listId/tags/:tagId`

**説明**: リスト内のタグ名を更新する。

**リクエスト**:

```json
{
  "name": "ドラッグストア"
}
```

**レスポンス**: 更新後の `Tag` オブジェクト（`200 OK`）

### 8.4 DELETE `/lists/:listId/tags/:tagId`

**説明**: タグを削除し、関連する `ItemTag` も削除する。

**レスポンス**: `204 No Content`

---

## 9. アイテム API

### 9.1 GET `/lists/:listId/items`

**説明**: リストのアイテム一覧を取得する。

**クエリパラメータ**:

| パラメータ | 型     | デフォルト       | 説明                                                    |
| ---------- | ------ | ---------------- | ------------------------------------------------------- |
| `status`   | string | `pending`        | `pending` / `completed` / `all`                         |
| `tagId`    | string | なし             | タグフィルター。複数指定可                              |
| `sort`     | string | `createdAt:desc` | `createdAt:asc` / `createdAt:desc` / `completedAt:desc` |
| `limit`    | number | `50`             | 最大 100                                                |
| `offset`   | number | `0`              | オフセット                                              |

**レスポンス例**:

```json
{
  "data": [
    {
      "id": "itm_001",
      "title": "牛乳",
      "quantity": 1,
      "isCompleted": false,
      "listId": "list_001",
      "completedAt": null,
      "tags": [
        {
          "id": "tag_001",
          "name": "スーパー"
        }
      ],
      "createdAt": "2026-08-17T10:00:00Z",
      "updatedAt": "2026-08-17T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 9.2 POST `/lists/:listId/items`

**説明**: リストにアイテムを作成する。

**リクエスト**:

```json
{
  "title": "牛乳",
  "quantity": 1,
  "tagIds": ["tag_001"]
}
```

**バリデーション**:

- `title`: 1〜255 文字、必須
- `quantity`: 1〜999 の整数
- `tagIds`: 配列。空配列可
- すべての `tagIds` は対象リストに属している必要がある

**レスポンス**: 作成された `Item` オブジェクト（`201 Created`）

### 9.3 PUT `/lists/:listId/items/:itemId`

**説明**: アイテムの内容とタグを更新する。

**リクエスト**:

```json
{
  "title": "低脂肪牛乳",
  "quantity": 2,
  "tagIds": ["tag_001"]
}
```

**レスポンス**: 更新された `Item` オブジェクト（`200 OK`）

### 9.4 PATCH `/lists/:listId/items/:itemId/toggle`

**説明**: アイテムの完了状態を切り替える。

**リクエスト**: ボディなし

**動作**:

- `false` → `true`: `completedAt` を現在時刻に設定
- `true` → `false`: `completedAt` を `null` に設定
- 完了済みアイテムは 30 日後の自動削除対象となる

**レスポンス**: 更新された `Item` オブジェクト（`200 OK`）

### 9.5 DELETE `/lists/:listId/items/:itemId`

**説明**: 未完了アイテムを削除する。

**制約**:

- `isCompleted === true` のアイテムは手動削除不可

**エラー**: `409 COMPLETED_ITEM_CANNOT_BE_DELETED`

**レスポンス**: `204 No Content`

---

## 10. WebSocket（リアルタイム同期）

### 10.1 接続と認証

```javascript
const socket = io("https://iru-mono.vercel.app", {
  auth: { token: "JWT_TOKEN" }
});
```

- JWT を検証し、ユーザーが所属するリストのルームへ参加させる
- イベントは該当リストのメンバーだけに配信する
- 異なるリストのイベントは配信しない

### 10.2 イベント一覧

イベント名は `list:` プレフィックスで統一する。

```javascript
socket.on("list:item:created", (item) => {
  console.log("Item created:", item);
});

socket.on("list:item:updated", (item) => {
  console.log("Item updated:", item);
});

socket.on("list:item:deleted", (itemId) => {
  console.log("Item deleted:", itemId);
});

socket.on("list:tag:created", (tag) => {
  console.log("Tag created:", tag);
});

socket.on("list:tag:updated", (tag) => {
  console.log("Tag updated:", tag);
});

socket.on("list:tag:deleted", (tagId) => {
  console.log("Tag deleted:", tagId);
});
```

---

## 11. エラーコード一覧

| コード                             | 意味                               |
| ---------------------------------- | ---------------------------------- |
| `UNAUTHORIZED`                     | 認証されていない                   |
| `INVALID_CREDENTIALS`              | ログイン失敗                       |
| `VALIDATION_ERROR`                 | バリデーション失敗                 |
| `NOT_FOUND`                        | 対象が存在しない                   |
| `USER_NOT_FOUND`                   | ユーザーが存在しない               |
| `MEMBER_ALREADY_EXISTS`            | 既にメンバーである                 |
| `TAG_ALREADY_EXISTS`               | リスト内のタグ名が重複している     |
| `COMPLETED_ITEM_CANNOT_BE_DELETED` | 完了済みアイテムは手動削除できない |
| `FORBIDDEN`                        | 所属外または権限不足               |
| `CONFLICT`                         | 競合状態                           |
| `INTERNAL_SERVER_ERROR`            | サーバーエラー                     |

---

## 12. 実装ロードマップ

### フェーズ1: 認証・リスト・メンバー

- [ ] `POST /auth/signup`
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `GET /lists`
- [ ] `POST /lists`
- [ ] `GET /lists/:listId`
- [ ] `PUT /lists/:listId`
- [ ] `POST /lists/:listId/members`
- [ ] `DELETE /lists/:listId/members/:userId`

### フェーズ2: タグ・アイテム

- [ ] タグ CRUD
- [ ] アイテム CRUD
- [ ] 完了切り替え
- [ ] タグフィルター

### フェーズ3: リアルタイム同期

- [ ] Socket.io 接続
- [ ] JWT 認証
- [ ] リストルームへの参加
- [ ] `list:item:*` イベント
- [ ] `list:tag:*` イベント

### フェーズ4: 運用

- [ ] 完了アイテム自動削除バッチ
- [ ] エラーログ・モニタリング
- [ ] レート制限

最終更新: 2026年8月17日

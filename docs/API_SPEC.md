# API 仕様書（修正版）

## 1. 概要

IRU-MONO の API 仕様書です。
認証とセッション管理は Supabase Auth に委譲し、アプリケーション API はリスト、メンバー、タグ、アイテムの操作を提供します。

本仕様では、以下を前提とします。

- ユーザーは Google アカウントで認証する
- アプリケーションは Google のパスワードを扱わない
- Supabase Auth のセッションを Cookie で利用する
- ユーザーは複数のリストを作成・利用できる
- タグとアイテムはユーザーではなくリストに所属する
- 同じリストのメンバーがタグとアイテムを共有する
- リアルタイム同期は Supabase Realtime でリスト単位に行う

---

## 2. ベース URL

```text
http://localhost:3000/api       (開発環境)
https://iru-mono.vercel.app/api  (本番環境)
```

---

## 3. 認証方式

### 3.1 Google OAuth

ログイン開始は Supabase Auth Client から行う。

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${location.origin}/auth/callback`,
  },
});
```

### 3.2 コールバック

`GET /auth/callback` で OAuth の認証コードを Supabase セッションへ交換する。

- 認証コード交換は Supabase SSR クライアントで行う
- セッションは httpOnly Cookie として扱う
- 初回ログイン時にアプリ側の `User` レコードを作成または更新する
- パスワード、Google のアクセストークン、プロバイダー秘密情報をアプリ DB に保存しない

### 3.3 ログアウト

`POST /auth/logout` で Supabase Auth のセッションを終了する。

### 3.4 認証済みリクエスト

```bash
curl -X GET http://localhost:3000/api/lists \
  --cookie "sb-<project-ref>-auth-token=SESSION_COOKIE"
```

API は Supabase セッションから現在のユーザー ID を取得する。クライアントから `userId` や `listId` を受け取って認証対象を決定しない。

### 3.5 認証失敗時

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

## 4. 共通仕様

### 4.1 リソーススコープ

- `User` は Supabase Auth のユーザー ID と対応するアプリ側プロフィールである
- `ListMember` に登録されたユーザーだけが、そのリストのデータへアクセスできる
- `Tag` と `Item` は必ず `listId` を持つ
- リスト ID は URL の `:listId` で扱う
- 所属していないリストへのアクセスは `403 Forbidden` または `404 Not Found` を返す
- API と Supabase Row Level Security の両方で所属確認を行う

### 4.2 共通レスポンス

```json
{
  "data": [],
  "total": 0,
  "limit": 20,
  "offset": 0
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

| メソッド | エンドポイント   | 説明                               |
| -------- | ---------------- | ---------------------------------- |
| GET      | `/auth/callback` | Google OAuth コールバック          |
| POST     | `/auth/logout`   | Supabase Auth セッション終了       |
| GET      | `/auth/me`       | 自分のプロフィールと所属リスト取得 |

Google OAuth の開始処理は Supabase Client の `signInWithOAuth` を使用し、アプリ API の `POST /auth/login` は用意しない。

### 5.2 リスト

| メソッド | エンドポイント                   | 説明                         |
| -------- | -------------------------------- | ---------------------------- |
| GET      | `/lists`                         | 自分が所属するリスト一覧取得 |
| POST     | `/lists`                         | リスト作成。作成者を自動参加 |
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

## 6. 認証 API

### 6.1 GET `/auth/callback`

**説明**: Google OAuth の認証コードを Supabase セッションへ交換する。

**認証**: Supabase OAuth からのリダイレクトのみ

**動作**:

1. `code` クエリパラメータを取得する
2. Supabase SSR クライアントで `exchangeCodeForSession(code)` を実行する
3. セッション Cookie を設定する
4. Supabase Auth のユーザー情報からアプリ側 `User` を作成または更新する
5. アプリ画面へリダイレクトする

### 6.2 POST `/auth/logout`

**説明**: Supabase Auth の現在のセッションを終了する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "message": "Logged out successfully"
}
```

### 6.3 GET `/auth/me`

**説明**: Supabase Auth のユーザー情報とアプリ側プロフィール、所属リストを取得する。

**認証**: 必須

**レスポンス (200 OK)**:

```json
{
  "id": "google-user-uuid",
  "displayName": "Taro",
  "avatarUrl": "https://example.com/avatar.png",
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

### 7.2 POST `/lists`

**説明**: 新しいリストを作成する。作成者は自動的にメンバーになる。

**リクエスト**:

```json
{
  "name": "日常の買い物"
}
```

**バリデーション**: `name` は 1〜100 文字。

**レスポンス**: 作成された `List` と作成者の `ListMember`（`201 Created`）

### 7.3 GET `/lists/:listId`

**説明**: 所属しているリストの情報とメンバーを取得する。

**認証**: 対象リストのメンバーであること

### 7.4 PUT `/lists/:listId`

**説明**: リスト名を更新する。

**リクエスト**:

```json
{
  "name": "週末の買い物"
}
```

### 7.5 DELETE `/lists/:listId`

**説明**: リストと所属メンバー、リスト内のタグ・アイテムを削除する。

**権限**: リスト作成者のみ

**レスポンス**: `204 No Content`

### 7.6 POST `/lists/:listId/members`

**説明**: 指定したアプリ側ユーザーをリストに参加させる。

**権限**: リスト作成者のみ

**リクエスト**:

```json
{
  "userId": "google-user-uuid"
}
```

**エラー**: `404 USER_NOT_FOUND`、`409 MEMBER_ALREADY_EXISTS`、`403 FORBIDDEN`

### 7.7 DELETE `/lists/:listId/members/:userId`

**説明**: 指定したユーザーをリストから除外する。

**権限**: リスト作成者のみ

**レスポンス**: `204 No Content`

### 7.8 DELETE `/lists/:listId/membership`

**説明**: 自分自身がリストから退会する。

**レスポンス**: `204 No Content`

---

## 8. タグ API

### 8.1 GET `/lists/:listId/tags`

リストのメンバーがタグ一覧を取得する。レスポンスには `id`、`name`、`listId`、作成日時、更新日時を含める。

### 8.2 POST `/lists/:listId/tags`

リストのメンバーがタグを作成する。

```json
{
  "name": "スーパー"
}
```

- `name`: 1〜50 文字
- 同じリスト内で重複不可
- 重複時は `409 TAG_ALREADY_EXISTS`

### 8.3 PUT `/lists/:listId/tags/:tagId`

リストのメンバーがタグ名を更新する。

### 8.4 DELETE `/lists/:listId/tags/:tagId`

タグと関連する `ItemTag` を削除する。レスポンスは `204 No Content`。

---

## 9. アイテム API

### 9.1 GET `/lists/:listId/items`

リストのメンバーがアイテム一覧を取得する。

クエリパラメータ:

| パラメータ | 型     | デフォルト       | 説明                             |
| ---------- | ------ | ---------------- | -------------------------------- |
| `status`   | string | `pending`        | `pending` / `completed` / `all`  |
| `tagId`    | string | なし             | タグフィルター。複数指定可       |
| `sort`     | string | `createdAt:desc` | 作成日・更新日・完了日時でソート |
| `limit`    | number | `50`             | 最大 100                         |
| `offset`   | number | `0`              | オフセット                       |

### 9.2 POST `/lists/:listId/items`

リストのメンバーがアイテムを作成する。

```json
{
  "title": "牛乳",
  "quantity": 1,
  "tagIds": ["tag_001"]
}
```

- `title`: 1〜255 文字
- `quantity`: 1〜999 の整数
- `tagIds`: 配列。空配列可
- すべての `tagIds` は対象リストに属している必要がある

### 9.3 PUT `/lists/:listId/items/:itemId`

リストのメンバーがアイテムの内容とタグを更新する。

### 9.4 PATCH `/lists/:listId/items/:itemId/toggle`

リストのメンバーが完了状態を切り替える。

- `false` → `true`: `completedAt` を現在時刻に設定
- `true` → `false`: `completedAt` を `null` に設定

### 9.5 DELETE `/lists/:listId/items/:itemId`

未完了アイテムのみ手動削除できる。完了済みアイテムは `409 COMPLETED_ITEM_CANNOT_BE_DELETED`。

---

## 10. Supabase Realtime

- 対象テーブルは `Tag`、`Item`、`ItemTag` とする
- リスト画面を開いたクライアントは対象 `listId` の変更を購読する
- RLS と購読条件により、所属していないリストの変更を受け取らない
- イベントは `INSERT`、`UPDATE`、`DELETE` を扱う
- Socket.io の独自イベントは使用しない

---

## 11. エラーコード一覧

| コード                             | 意味                               |
| ---------------------------------- | ---------------------------------- |
| `UNAUTHORIZED`                     | Supabase セッションがない          |
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

- [ ] Supabase Google OAuth
- [ ] `/auth/callback`
- [ ] `/auth/logout`
- [ ] `/auth/me`
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

### フェーズ3: リアルタイムと運用

- [ ] Supabase Realtime 購読
- [ ] 完了アイテム自動削除処理
- [ ] エラーログ・モニタリング

最終更新: 2026年8月17日

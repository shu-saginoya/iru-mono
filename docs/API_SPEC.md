# API 仕様書（MVP）

## 1. 共通方針

認証とセッション管理は Supabase Auth に委譲します。Google OAuth の開始は Supabase Client を使い、アプリ API にログイン・パスワード登録処理は実装しません。

- 認証済みユーザーは Supabase SSR のセッションから特定する
- `listId` は URL から受け取るが、アクセス権は必ず `ListMember` で確認する
- 所属していないリストは `403 Forbidden` または `404 Not Found`
- 入力値は Zod で検証する

## 2. 認証

| Method | Path             | 説明                                    |
| ------ | ---------------- | --------------------------------------- |
| GET    | `/auth/callback` | Google OAuth のコードをセッションへ交換 |
| POST   | `/auth/logout`   | Supabase Auth のセッション終了          |
| GET    | `/auth/me`       | 自分のプロフィール取得                  |

Google OAuth の開始:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${origin}/auth/callback` },
});
```

## 3. リスト

| Method | Path                             | 説明                         |
| ------ | -------------------------------- | ---------------------------- |
| GET    | `/lists`                         | 自分が所属するリスト一覧     |
| POST   | `/lists`                         | リスト作成。作成者を自動追加 |
| GET    | `/lists/:listId`                 | リストとメンバー取得         |
| PUT    | `/lists/:listId`                 | リスト名変更                 |
| DELETE | `/lists/:listId`                 | 作成者がリスト削除           |
| POST   | `/lists/:listId/members`         | 作成者がユーザー追加         |
| DELETE | `/lists/:listId/members/:userId` | 作成者がメンバー除外         |
| DELETE | `/lists/:listId/membership`      | 自分が退会                   |

`POST /lists/:listId/members` の初回リクエスト:

```json
{ "userId": "supabase-user-uuid" }
```

## 4. アイテム

| Method | Path                                  | 説明                   |
| ------ | ------------------------------------- | ---------------------- |
| GET    | `/lists/:listId/items`                | アイテム一覧           |
| POST   | `/lists/:listId/items`                | アイテム作成           |
| PUT    | `/lists/:listId/items/:itemId`        | アイテム名・数量の更新 |
| PATCH  | `/lists/:listId/items/:itemId/toggle` | 完了状態の切り替え     |
| DELETE | `/lists/:listId/items/:itemId`        | 未完了アイテムの削除   |

作成リクエスト:

```json
{ "title": "牛乳", "quantity": 1 }
```

クエリパラメータ:

- `status`: `pending`（既定） / `completed` / `all`
- `sort`: `createdAt:desc`（既定） / `updatedAt:desc`
- `limit`: 既定 50、最大 100
- `offset`: 既定 0

## 5. アイテムの状態

- 未完了から完了にすると `completedAt` を現在時刻にする
- 完了から未完了に戻すと `completedAt` を null にする
- 完了済みアイテムの自動削除は MVP では行わない
- 完了済みアイテムを手動削除しようとした場合は `409 COMPLETED_ITEM_CANNOT_BE_DELETED`

## 6. 共通ステータス

`200` 成功、`201` 作成成功、`204` 削除成功、`400` 不正、`401` 未認証、`403` 権限不足、`404` 未存在、`409` 競合、`422` 入力検証失敗。

共通エラー:

```json
{ "error": "Error message", "code": "ERROR_CODE" }
```

## 7. 後から追加する API

- 招待コード・招待リンク
- 検索、タグ、カテゴリ、優先度
- Supabase Realtime 購読
- 完了アイテム自動削除

最終更新: 2026年8月18日

# 技術構成書（MVP）

## 1. 方針

個人開発で早くリリースでき、AI エージェントが扱いやすい構成を優先します。初回リリースでは、機能・依存関係・運用サービスを必要最小限にします。

## 2. 採用技術

| 分野            | 技術                                     | 方針                                  |
| --------------- | ---------------------------------------- | ------------------------------------- |
| フレームワーク  | Next.js（App Router）                    | UI と Route Handler を一つにまとめる  |
| 言語            | TypeScript                               | 型で API と DB の契約を明確にする     |
| UI              | Tailwind CSS                             | 追加設定を少なくする                  |
| 認証            | Supabase Auth（Google OAuth）            | パスワードと OAuth の実装を外部化する |
| DB              | Supabase PostgreSQL                      | DB 運用を外部化する                   |
| DB クライアント | `@supabase/ssr`、`@supabase/supabase-js` | Next.js と Supabase Auth に対応する   |
| 入力検証        | Zod                                      | API 入力を一元検証する                |
| ホスティング    | Vercel                                   | Next.js のデプロイを簡単にする        |
| パッケージ管理  | pnpm                                     | 依存関係を一元管理する                |

## 3. 初回リリースで採用しないもの

- Prisma: Supabase Client と役割が重なるため使わない
- Socket.io / Supabase Realtime: 画面再読み込みで最新状態を取得し、リアルタイムは後回しにする
- Zustand: 標準の React state で足りるため使わない
- OpenAPI: API が安定してから検討する
- 別バックエンドサーバー: Next.js Route Handler に集約する

## 4. 認証

Google OAuth の開始とセッション管理は Supabase に任せます。Next.js は `@supabase/ssr` でセッションを読み取り、API の認可に利用します。Google のパスワードや OAuth の秘密情報をアプリケーションコードで扱いません。

## 5. データアクセス

- `users`、`lists`、`list_members`、`items` のみを初期スキーマとする
- Supabase RLS を有効にする
- API の共通認可処理を `lib/authorization.ts` に集約する
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用にする
- DB 変更は SQL マイグレーションで管理する

## 6. 環境変数

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.local` は Git にコミットしません。

## 7. 実装順序

1. Supabase クライアントと OAuth コールバック
2. `users` 同期
3. リスト作成・一覧・更新
4. RLS とメンバー追加・除外
5. アイテム CRUD と完了切り替え
6. 画面の再読み込みによる状態更新
7. 後から必要性を確認して Realtime、タグ、招待、削除ジョブを追加

## 8. AI エージェント向け開発ルール

- 1 回の変更は一機能に限定する
- 変更後に lint、型チェック、テストを実行する
- DB 変更と RLS 変更を同じ SQL マイグレーションで管理する
- 認証・認可を各 API に重複実装しない
- 不要な抽象化や依存パッケージを追加しない

最終更新: 2026年8月18日

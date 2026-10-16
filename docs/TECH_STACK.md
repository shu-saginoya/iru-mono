# 技術構成（MVP）

## 1. 方針

個人開発で早くリリースでき、AI エージェントが扱いやすい構成を優先する。依存関係と運用サービスは最小限にする。

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
| サーバー状態    | TanStack Query                           | 取得、キャッシュ、更新を一元管理する  |
| ホスティング    | Vercel                                   | Next.js のデプロイを簡単にする        |
| パッケージ管理  | pnpm                                     | 依存関係を一元管理する                |

## 3. 初回リリースで採用しないもの

- Prisma: Supabase Client と役割が重なるため使わない
- Socket.io / Supabase Realtime: 画面内の状態更新で対応し、他ユーザーのリアルタイム同期は後回しにする
- Zustand: 標準の React state で足りるため使わない
- OpenAPI: API が安定してから検討する
- 別バックエンドサーバー: Next.js Route Handler に集約する

## 4. 認証とデータアクセス

Google OAuth の開始とセッション管理は Supabase に委譲する。Next.js は `@supabase/ssr` でセッションを読み取り、API の認可に利用する。認証情報はアプリケーションコードで扱わない。

### データアクセス

- `users`、`lists`、`list_members`、`items`、`list_invitations` を初期スキーマとする
- Supabase RLS を有効にする
- API の共通認可処理は共通モジュールに集約する
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用にする
- DB 変更は SQL マイグレーションで管理する

### クライアントのサーバー状態

- TanStack Query をリスト、リスト詳細、メンバー、招待、アイテムの取得と更新に使用する
- query key はユーザー ID、リスト ID、取得条件を含め、共有モジュールで定義する
- API 呼び出しと query / mutation hook は UI コンポーネントから分離する
- 作成、更新、削除は mutation で楽観的にキャッシュを更新し、失敗時は更新前のキャッシュへ戻す
- mutation の完了後は、影響を受ける query を更新または無効化する
- mutation はオフライン時も実行を試み、通信失敗として UI に通知する
- 他ユーザーの変更は Realtime で受信しない。必要な再取得は mutation 完了後と画面復帰時に限定する
- アイテム query は IndexedDB へ永続化する。キャッシュはユーザー ID ごとに分離し、ログアウト時に削除する
- アイテム一覧は API のページングを吸収して全件をキャッシュする。UI に無限スクロールは追加しない

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
4. RLS と招待リンク発行・承認、メンバー除外
5. アイテム CRUD と完了切り替え
6. TanStack Query による楽観的 UI、キャッシュ、画面内の状態更新
7. 後から必要性を確認して Realtime、タグ、プッシュ通知、削除ジョブを追加

## 8. 開発ルール

- 1 回の変更は一機能に限定する
- 変更後に lint、型チェック、テストを実行する
- DB 変更と RLS 変更を同じ SQL マイグレーションで管理する
- 認証・認可を各 API に重複実装しない
- 不要な抽象化や依存パッケージを追加しない

詳細なテスト手順は [テスト方針](TESTING.md) を参照する。

最終更新: 2026年10月14日

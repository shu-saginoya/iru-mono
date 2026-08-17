# 技術構成書

## 概要

IRU-MONO の技術スタックおよび構成についてのドキュメントです。
個人開発での実装・運用のしやすさと、AI エージェントが一貫して実装できる構成を優先します。

---

## 推奨技術スタック

| 分野             | 選定技術                                  | 採用理由                                                        |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------- |
| フレームワーク   | Next.js（App Router）                     | UI とサーバー処理を一つのプロジェクトで管理できる               |
| 言語             | TypeScript                                | 型情報を共有でき、AI エージェントも実装方針を追いやすい         |
| UI/CSS           | Tailwind CSS                              | 追加設定が少なく、画面実装を速く進められる                      |
| パッケージ管理   | pnpm                                      | 依存関係とスクリプトを一元管理できる                            |
| 認証             | Supabase Auth（Google OAuth）             | パスワード管理・OAuth・セッション管理を外部化できる             |
| データベース     | Supabase PostgreSQL                       | DB の作成・接続・バックアップをサービス側で管理できる           |
| DB クライアント  | `@supabase/ssr` + `@supabase/supabase-js` | Next.js の Server/Client Components と Supabase Auth に対応する |
| 入力検証         | Zod                                       | API とフォームの入力条件を同じスキーマで管理できる              |
| リアルタイム通信 | Supabase Realtime                         | Socket.io 用の常時接続サーバーを別途運用しなくてよい            |
| ホスティング     | Vercel                                    | Next.js と統合しやすく、個人開発の初期運用が軽い                |
| テスト           | Vitest + Testing Library + Playwright     | 単体・コンポーネント・主要画面の動作を分けて検証できる          |
| バージョン管理   | Git / GitHub                              | AI エージェントによる差分確認と復旧がしやすい                   |

### 初期段階で採用しないもの

- Prisma: Supabase Client と役割が重複するため、初期構築では使わない
- Socket.io: Supabase Realtime で代替できるため、専用サーバーを作らない
- Zustand: 状態管理が必要になるまで導入しない
- Swagger/OpenAPI: API が安定してから導入する

---

## システムアーキテクチャ

```text
┌─────────────────────────────────────────────────────────┐
│                 Next.js（Vercel）                        │
│  - App Router                                            │
│  - Server / Client Components                            │
│  - Route Handlers（/app/api/...）                        │
│  - Supabase SSR クライアント                             │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
       Auth         Database      Realtime
          │            │            │
┌─────────▼──────────▼────────────▼───────────────────────┐
│                       Supabase                           │
│  - Google OAuth / セッション管理                         │
│  - PostgreSQL                                            │
│  - Row Level Security                                    │
│  - Realtime                                              │
└──────────────────────────────────────────────────────────┘
```

---

## 認証フロー

1. ユーザーが「Google でログイン」を選択する
2. Supabase Auth が Google OAuth の認証画面へ遷移させる
3. Google の認証成功後、Supabase がセッションを発行する
4. Next.js の Supabase SSR クライアントがセッションを Cookie として扱う
5. Server Components と Route Handlers が Supabase のセッションからユーザーを取得する
6. 初回ログイン時にアプリ側の `User` レコードを作成または更新する

アプリケーションが Google のパスワードを扱うことはありません。

---

## データアクセス方針

- アプリ側のユーザー ID は Supabase Auth のユーザー ID と一致させる
- `ListMember` による所属確認を API とデータベースの両方で行う
- Supabase の Row Level Security を有効にする
- `Tag` と `Item` は `listId` を基準にアクセスする
- API の認可条件を `lib/authorization.ts` などに集約する
- Supabase のサービスロールキーはサーバー専用とし、ブラウザへ渡さない

---

## リアルタイム同期フロー

```text
ユーザーA
  │
  └─ Route Handler → Supabase PostgreSQL 更新
                           │
                    Supabase Realtime
                           │
              同じ listId の購読クライアント
                    ┌──────┴──────┐
                ユーザーA       ユーザーB
                 （UI 更新）     （UI 更新）
```

- リスト画面を開いたとき、対象 `listId` の変更を購読する
- `INSERT`、`UPDATE`、`DELETE` の対象を画面状態へ反映する
- RLS と購読条件により、所属していないリストの変更を受け取らない

---

## 環境変数

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- `NEXT_PUBLIC_*` はクライアントで利用可能な値
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用の秘密情報
- `.env.local` は Git にコミットしない

---

## ローカル開発環境

### 前提条件

- Node.js 最新 LTS
- pnpm
- Supabase プロジェクト
- Google OAuth の開発用設定
- Git

### ローカル実行コマンド（予定）

```bash
pnpm install
pnpm dev
pnpm test
pnpm exec playwright test
```

DB マイグレーションは Supabase SQL Editor または Supabase CLI で管理します。

---

## デプロイフロー

```text
GitHub に push
  ↓
Vercel が Next.js をビルド
  ↓
環境変数を使って Supabase に接続
  ↓
Vercel にデプロイ完了
```

---

## セキュリティ対策

| 対策                     | 実装方法                                              |
| ------------------------ | ----------------------------------------------------- |
| OAuth                    | Supabase Auth と Google OAuth に委譲                  |
| セッション               | Supabase SSR クライアントと Cookie で管理             |
| 認可                     | `ListMember` と Row Level Security で list 単位に制限 |
| 入力検証                 | Zod                                                   |
| SQL インジェクション対策 | Supabase Client のパラメータ化クエリ                  |
| 秘密情報                 | サービスロールキーをサーバー環境変数だけに保存        |
| HTTPS                    | Vercel と Supabase の標準機能を利用                   |
| XSS                      | React の自動エスケープと入力検証                      |
| CSRF                     | Supabase SSR のセッション方式と SameSite Cookie       |

---

## AI エージェント向けの開発方針

- 機能ごとに Route Handler、UI、バリデーション、テストを近い単位で実装する
- DB 変更は SQL マイグレーションとして管理する
- 認証・認可処理は共通ヘルパーを利用し、各 API に重複実装しない
- Supabase の型定義を生成し、DB の型を手書きで重複させない
- 1 回の変更範囲を小さくし、変更後に lint・型チェック・テストを実行する
- 環境変数や OAuth 設定はコードに直接書かない

---

## 実装の優先順位

### フェーズ1: プロジェクトと認証

- [ ] Next.js プロジェクト初期化
- [ ] Supabase プロジェクト接続
- [ ] Google OAuth 設定
- [ ] Supabase Auth によるログイン・ログアウト
- [ ] アプリ側 `User` の同期

### フェーズ2: リストとメンバー

- [ ] `List` と `ListMember` の SQL マイグレーション
- [ ] RLS ポリシー
- [ ] リスト作成・一覧・更新
- [ ] メンバー参加処理

### フェーズ3: タグとアイテム

- [ ] タグ CRUD
- [ ] アイテム CRUD
- [ ] 完了切り替え
- [ ] タグフィルター

### フェーズ4: リアルタイムと運用

- [ ] Supabase Realtime 購読
- [ ] 完了アイテム自動削除処理
- [ ] エラーログ・モニタリング
- [ ] レート制限

---

最終更新: 2026年8月17日

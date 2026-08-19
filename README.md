# IRU MONO

共有買い物リストアプリの MVP です。Google OAuth でログインし、ユーザー間でリストとアイテムを共有できます。

## 1. 概要

IRU MONO は、複数人で買い物リストを共有するためのシンプルな Web アプリです。

主な機能:
- Google アカウントでログイン
- リストの作成と一覧表示
- リストへのメンバー追加
- アイテムの追加・編集・完了切り替え・削除
- 画面再読み込み時に最新状態を取得

## 2. 技術スタック

- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Tailwind CSS
- Zod
- Vitest
- pnpm
- Vercel

## 3. 仕様と設計書

- [docs/SPEC.md](docs/SPEC.md)
- [docs/API_SPEC.md](docs/API_SPEC.md)
- [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)
- [docs/TECH_STACK.md](docs/TECH_STACK.md)

## 4. プロジェクト構成

```text
.
├── docs/                  # 仕様・API・DB 設計書
├── public/                # 静的アセット
├── src/
│   ├── app/               # Next.js App Router
│   ├── lib/               # Supabase と共通ロジック
│   └── proxy.ts           # 既存のプロキシ利用コード
├── .gitignore
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tsconfig.json
├── README.md
└── vitest.config.mts
```

## 5. 前提条件

- Node.js 20 以上推奨
- pnpm
- Supabase アカウント
- Vercel アカウント（デプロイ用）
- Google Cloud Console の OAuth 設定

## 6. ローカル開発

依存関係をインストールします。

```bash
pnpm install
```

開発サーバーを起動します。

```bash
pnpm dev
```

ブラウザで以下を開きます。

- http://localhost:3000

## 7. 環境変数

ローカル開発では `.env.local` を作成し、以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.example` を参考にしてください。

## 8. Supabase 設定

### 8.1 Supabase プロジェクト作成

1. Supabase で新規プロジェクトを作成する
2. プロジェクト URL と anon key を取得する
3. project settings > API から URL / anon key / service role key を確認する

### 8.2 Google OAuth 設定

1. Google Cloud Console で OAuth クライアント ID を作成する
2. Authorized JavaScript origins に `http://localhost:3000` を追加する
3. Authorized redirect URIs に以下を追加する
   - `http://localhost:3000/auth/callback`
   - デプロイ後は `https://<your-domain>/auth/callback`
4. Supabase の Authentication > Providers > Google で Client ID / Secret を設定する

### 8.3 DB 作成

[docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) の SQL を実行して、以下のテーブルを作成します。

- public.users
- public.lists
- public.list_members
- public.items

また、RLS を有効化し、各テーブルに権限ポリシーを設定してください。

## 9. デプロイ準備

### Vercel へのデプロイ

1. GitHub にこのリポジトリを push する
2. Vercel で GitHub リポジトリをインポートする
3. Project Settings で環境変数を設定する
4. ビルドコマンド: `pnpm build`
5. デプロイ後に `NEXT_PUBLIC_APP_URL` を本番 URL に設定する

### 本番環境での必須変数

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

## 10. 実行確認

ローカルまたは本番で以下を確認します。

- サインインができる
- リストを作成できる
- リストにメンバーを追加できる
- アイテムを追加・完了・削除できる
- 画面再読み込み後に状態が維持される

## 11. 今後の拡張候補

- 招待コードと招待リンク
- タグやカテゴリ
- 検索とフィルタ
- 完了アイテムの自動削除
- Realtime 同期

## 12. このアプリで大事な注意点

- Supabase のサービスロールキーはブラウザに直接置かない
- すべての API でリスト所属確認を行う
- 認可は API 側と RLS の両方で守る
- 本番では Google OAuth のコールバック URL を必ず設定する

## 13. あなたがやるべき作業

最初の本番準備では、以下を順番に行います。

1. Supabase プロジェクトを作成する
2. Google OAuth を有効化する
3. `.env.local` に環境変数を設定する
4. [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) の SQL を Supabase に実行する
5. RLS を設定して、一覧・メンバー管理・アイテム管理が動くようにする
6. GitHub に push する
7. Vercel でプロジェクトをインポートする
8. Vercel の環境変数を本番用に設定する
9. 初回デプロイ後にログインとリスト作成をテストする

この README は、デプロイ前の準備に必要な情報が揃う形で整理しています。

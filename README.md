# IRU MONO

共有買い物リストアプリです。家族などで必要なものを登録して買い物の時に一覧で確認できます。

## 概要

IRU MONO は、複数人で買い物リストを共有するためのシンプルな Web アプリです。

主な機能:

- Google アカウントでログイン
- リストの作成と一覧表示
- リストへのメンバー追加
- アイテムの追加・編集・完了切り替え・削除
- 画面再読み込み時に最新状態を取得

## 仕様と設計書

- [仕様書](docs/SPEC.md)
- [API仕様書](docs/API_SPEC.md)
- [DB仕様書](docs/DB_SCHEMA.md)
- [技術スタック](docs/TECH_STACK.md)
- [UI仕様書](docs/UI_SPEC.md)
- [テスト仕様書](docs/TESTING.md)
- [ディレクトリ構成](docs/DIR_SPEC.md)

## セットアップ

依存関係をインストールします。

```bash
pnpm install
```

`.env.example` を参考に `.env.local` を作成します（詳細は「7. 環境変数」を参照）。

開発サーバーを起動します。

```bash
pnpm dev
```

ブラウザで以下を開きます。

- http://localhost:3000

## 環境変数

### 現在使用している変数

| 変数名                          | 用途                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase プロジェクトの URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase クライアント（ブラウザ・サーバー共通）の anon key |

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 未使用の変数（将来用）

以下は `.env.example` に記載していますが、現状のコードからは参照されていません。RLS をバイパスする管理者操作など、`SUPABASE_SERVICE_ROLE_KEY` が必要な機能を実装するまでは設定不要です。誤って公開しないよう、使う予定がない場合はデプロイ先にも登録しないでください。

| 変数名                      | 想定用途                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS を無視するサーバー専用の管理者キー（未実装）                               |
| `NEXT_PUBLIC_APP_URL`       | アプリの公開 URL（未参照。リダイレクト先は `window.location.origin` から生成） |

## Supabase 設定

### Supabase プロジェクト作成

1. Supabase で新規プロジェクトを作成する
2. project settings > API から URL と anon key を取得する

### Google OAuth 設定

1. Google Cloud Console で OAuth クライアント ID を作成する
2. Authorized JavaScript origins にアプリの URL を追加する（例: `http://localhost:3000`、本番 URL）
3. Authorized redirect URIs に **Supabase の callback URL** を追加する
   - `https://<your-project>.supabase.co/auth/v1/callback`
4. Supabase の Authentication > Providers > Google で Client ID / Secret を設定する
5. Supabase の Authentication > URL Configuration で以下を設定する
   - Site URL: アプリの公開 URL
   - Redirect URLs: `<アプリの URL>/auth/callback`（ローカルと本番の両方を登録可能）

### DB 作成

[docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) の SQL を実行して、以下のテーブルを作成します。

- public.users
- public.lists
- public.list_members
- public.items

また、RLS を有効化し、各テーブルに権限ポリシーを設定してください。

## デプロイ

Vercel でホスティングしています。GitHub リポジトリを Vercel にインポートし、Project Settings で「7. 環境変数」の内容を設定すればデプロイできます。ビルドコマンドは `pnpm build` です。

Google ログイン後に意図しない URL へリダイレクトされる場合は、Supabase の Site URL / Redirect URLs と、Google Cloud Console のリダイレクト URI（Supabase の callback URL）の設定を確認してください。

## コマンド

```bash
pnpm dev     # 開発サーバー起動
pnpm build   # 本番ビルド
pnpm start   # 本番ビルドの起動
pnpm lint    # ESLint
pnpm test    # Vitest
```

## 動作確認項目

- サインインができる
- リストを作成できる
- リストにメンバーを追加できる
- アイテムを追加・完了・削除できる
- 画面再読み込み後に状態が維持される

## 今後の拡張候補

- 招待コードと招待リンク
- タグやカテゴリ
- 検索とフィルタ
- 完了アイテムの自動削除
- Realtime 同期

## セキュリティ上の注意点

- Supabase のサービスロールキーはブラウザに直接置かない
- すべての API でリスト所属確認を行う
- 認可は API 側と RLS の両方で守る
- 本番では Google OAuth と Supabase のリダイレクト URL 設定を必ず確認する

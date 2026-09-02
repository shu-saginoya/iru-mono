# IRU MONO

複数人で買い物リストを共有する Web アプリです。

## 概要

主な機能:

- Google アカウントでログイン
- リストの作成と一覧表示
- リストへのメンバー追加
- アイテムの追加・編集・完了切り替え・削除
- 画面内の状態更新

## ドキュメント

要件・設計の責務を分けています。機能要件は仕様書、API は API仕様書、DB は DB仕様書を確認してください。

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

`.env.local` を作成します。必要な変数は [技術構成](docs/TECH_STACK.md) を参照してください。

開発サーバーを起動します。

```bash
pnpm dev
```

ブラウザで以下を開きます。

- http://localhost:3000

## 環境変数

現在の必須変数は `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` です。定義と用途は [技術構成](docs/TECH_STACK.md) を参照してください。

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

[DB仕様書](docs/DB_SCHEMA.md) の SQL と RLS 方針を適用してください。

## デプロイ

Vercel にデプロイします。Project Settings に環境変数を設定し、ビルドコマンド `pnpm build` を実行します。

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

今後の拡張候補とセキュリティ要件は [プロダクト仕様](docs/SPEC.md) に集約しています。

# ディレクトリ構成

実装の責務は次のとおり。構成図は現在の MVP の構成を示す。

```text
src/
├── app/                  # ページ、レイアウト、Route Handler
│   ├── auth/             # OAuth callback、logout、me
│   ├── lists/            # リスト、メンバー、アイテムの API
│   ├── globals.css
│   └── layout.tsx
├── features/             # 機能単位の UI、query、mutation
├── lib/                  # Supabase、API、Query 共通処理
└── proxy.ts              # リクエスト境界の処理
```

## 配置ルール

- Route Handler は `app/**/route.ts` に置く
- 画面固有の UI、query、mutation は `features/` に置く
- Supabase、API、TanStack Query の共通処理は `lib/` に置く
- query key は共通モジュールで定義し、UI コンポーネントに HTTP やキャッシュ更新を持たせない
- 実際の構成とこの文書が異なる場合は、文書を実装に合わせて更新する

最終更新: 2026年10月14日

# ディレクトリ構成

実装の責務は次のとおり。構成図は現在の MVP の構成を示す。

```text
src/
├── app/                  # ページ、レイアウト、Route Handler
│   ├── auth/             # OAuth callback、logout、me
│   ├── lists/            # リスト、メンバー、アイテムの API
│   ├── globals.css
│   └── layout.tsx
├── components/       # 共通 UI
├── features/         # 機能単位の UI とロジック
├── lib/              # Supabase、API 共通処理
└── proxy.ts              # リクエスト境界の処理
```

## 配置ルール

- Route Handler は `app/**/route.ts` に置く
- 画面固有の UI は `features/`、複数機能で使う UI は `components/` に置く
- Supabase や API 共通処理は `lib/` に置く
- 実際の構成とこの文書が異なる場合は、文書を実装に合わせて更新する

# ディレクトリ構成

以下の構成図を参考にする。

```text
src/
├── app/                  # ルーティング定義のみ（ロジックは書かない）
│   ├── (public)/         # LPなど
│   ├── (app)/            # アプリ本体
│   │   ├── dashboard/
│   │   │   └── page.tsx  # Featureを呼び出すだけ
│   │   └── layout.tsx
│   ├── api/              # Route Handlers
│   ├── globals.css
│   └── layout.tsx
│
├── components/           # アプリ全体で使う「汎用」コンポーネント
│   ├── ui/               # shadcn/ui (Button, Input等)
│   ├── layouts/          # Header, Footer, Sidebar
│   └── elements/         # その他汎用パーツ (Loading, Error等)
│
├── features/             # ★ここが主役！機能単位で切る
│   ├── auth/             # 認証機能
│   │   ├── components/   # LoginForm, SignupButton (Specific)
│   │   ├── actions/      # Server Actions (login, logout)
│   │   ├── hooks/        # useAuth
│   │   └── types/        # 認証系型定義
│   │
│   ├── posts/            # 投稿機能
│   │   ├── components/   # PostList, PostCard
│   │   ├── api/          # データ取得関数 (getPosts)
│   │   └── actions/      # createPost, deletePost
│   │
│   └── users/            # ユーザー機能
│
├── lib/                  # 外部ライブラリの設定・ラッパー
│   ├── prisma.ts         # DB接続
│   ├── utils.ts          # shadcn用ユーティリティ
│   └── stripe.ts
│
└── types/                # アプリ全体で使う型（env.d.ts等）
```

[構成図を拝借した記事](https://qiita.com/YushiYamamoto/items/9480b7c5fa5430003cee)

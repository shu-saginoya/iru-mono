# AI エージェント向けガイド

このドキュメントは GitHub Copilot AI エージェントが IRU-MONO プロジェクトで効率的に作業するためのガイドです。

---

## 📖 ドキュメント参照

### 全体理解用
- [SPEC.md](./SPEC.md) — 機能仕様・要件定義
- [TECH_STACK.md](./TECH_STACK.md) — 技術スタック・アーキテクチャ
- [DB_SCHEMA.md](./DB_SCHEMA.md) — データベーススキーマ・Prisma定義
- [API_SPEC.md](./API_SPEC.md) — REST API・WebSocket仕様

**作業開始前に上記4ドキュメントを参照してください。**

---

## 🏗️ プロジェクト構造

```
iru-mono/
├── app/
│   ├── api/
│   │   ├── auth/              # 認証エンドポイント
│   │   ├── tags/              # タグCRUD
│   │   ├── items/             # アイテムCRUD
│   │   └── socket.io.ts       # WebSocket
│   ├── (auth)/
│   │   └── login/             # ログイン画面
│   ├── dashboard/             # メイン画面
│   ├── layout.tsx
│   └── page.tsx
├── components/                # React コンポーネント
├── lib/
│   ├── prisma.ts              # Prismaクライアント
│   ├── auth.ts                # JWT・認証ユーティリティ
│   └── validators.ts          # 入力検証
├── middleware.ts              # Next.js Middleware（JWT検証）
├── prisma/
│   └── schema.prisma          # DB スキーマ
├── __tests__/                 # テストファイル
├── .env.example
└── package.json
```

---

## 🎯 実装の優先順位

### フェーズ1（MVP）
1. 認証（signup/login/logout）
2. タグCRUD
3. アイテムCRUD + チェック機能
4. タグフィルター

### フェーズ2
5. WebSocket リアルタイム同期

### フェーズ3
6. 完了アイテム自動削除バッチ

**参照**: [TECH_STACK.md#実装の優先順位](./TECH_STACK.md#実装の優先順位)

---

## 🔑 重要なコンセプト

### 認証フロー
- JWT トークン（有効期限7日）
- `lib/auth.ts` で統一管理
- Next.js Middleware で全API保護
- **参照**: [API_SPEC.md#認証](./API_SPEC.md#認証)

### ユーザースコープ
- **全データはユーザーIDでフィルター必須**
- タグ・アイテムは userId カラムで所有者管理
- 他ユーザーのデータアクセスは403エラー

### 多対多関係（アイテム ↔ タグ）
- ItemTag 中間テーブルで実装
- 1アイテムに複数タグ対応
- **参照**: [DB_SCHEMA.md#ItemTags](./DB_SCHEMA.md#itemtagsアイテムタグ中間テーブル)

### 完了アイテムの自動削除
- 完了後30日で自動削除（削除ボタンなし）
- `completedAt` カラムで日時記録
- バッチ処理で削除実行
- **参照**: [DB_SCHEMA.md#完了アイテムの自動削除](./DB_SCHEMA.md#完了アイテムの自動削除)

---

## 💾 データベース作業ガイド

### Prisma コマンド

```bash
# スキーマ変更後、マイグレーション生成
pnpm prisma migrate dev --name <migration_name>

# 本番環境にマイグレーション適用
pnpm prisma migrate deploy

# Prisma Client 再生成
pnpm prisma generate

# DBをリセット（開発用）
pnpm prisma migrate reset
```

### よくある作業

| 作業 | コマンド |
|------|---------|
| スキーマ確認 | `cat prisma/schema.prisma` |
| Prisma Studio で DB確認 | `pnpm prisma studio` |
| 最新マイグレーション確認 | `ls prisma/migrations/` |

---

## 🔐 セキュリティ実装チェックリスト

エンドポイント実装時の確認項目：

- [ ] JWT トークン検証（Middleware または エンドポイント内）
- [ ] userId でのデータフィルター（他ユーザーアクセス防止）
- [ ] 入力バリデーション（Zod など）
- [ ] bcrypt パスワードハッシュ化（signup時）
- [ ] パスワード平文保存なし
- [ ] SQL インジェクション対策（Prisma自動対応）

---

## 🧪 テスト戦略

### テストファイルの配置

```
__tests__/
├── api/
│   ├── auth.test.ts
│   ├── tags.test.ts
│   └── items.test.ts
├── lib/
│   ├── auth.test.ts
│   └── validators.test.ts
└── components/
    └── ItemList.test.tsx
```

### テストフレームワーク

- **ユニット・統合テスト**: Jest + React Testing Library
- **E2E**: Playwright（オプション・将来検討）

### テストコマンド

```bash
# テスト実行
pnpm test

# カバレッジ確認
pnpm test --coverage

# 監視モード
pnpm test --watch
```

### テスト例（参考）

```typescript
// __tests__/api/auth.test.ts
describe('POST /api/auth/signup', () => {
  it('新規ユーザーを作成', async () => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'pass123' }),
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('重複ユーザー名でエラー', async () => {
    // 先に作成
    await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'pass123' }),
    });
    // 重複作成
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'pass456' }),
    });
    expect(res.status).toBe(400);
  });
});
```

---

## 🐛 デバッグのヒント

### よくある問題

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| 401 Unauthorized | JWT トークンなし/期限切れ | ログイン → 新規トークン取得 |
| 403 Forbidden | 他ユーザーのデータアクセス | userId フィルター確認 |
| タグが保存されない | Prisma スキーマ未同期 | `pnpm prisma generate` 実行 |
| WebSocket 未接続 | Socket.io 未初期化 | `app/api/socket.io.ts` 確認 |
| パスワード照合失敗 | bcrypt ハッシュ不一致 | bcrypt.compare() 使用確認 |

### ログ確認

```bash
# Next.js ログ
pnpm dev    # ターミナルで出力確認

# Prisma ログ有効化
DEBUG=prisma:* pnpm dev

# DB ログ確認
pnpm prisma studio
```

---

## 📝 実装時のルール

### コード規約

- **言語**: TypeScript（型安全性重視）
- **スタイル**: Tailwind CSS（レスポンシブ優先）
- **命名規則**:
  - ファイル: キャメルケース（`userAuth.ts`）
  - フォルダ: ケバブケース（`api/auth`）
  - 関数: キャメルケース（`getUserItems()`）
  - 型: PascalCase（`User`, `ItemResponse`）

### コミットメッセージ

```
feat: 機能追加
fix: バグ修正
refactor: リファクタリング
test: テスト追加
docs: ドキュメント更新
```

### 環境変数（.env.local）

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 📦 依存関係

主要パッケージ（全バージョンは最新安定版）:

- **フレームワーク**: Next.js, React, TypeScript
- **DB**: Prisma, PostgreSQL
- **認証**: jsonwebtoken, bcrypt
- **UI**: Tailwind CSS
- **バリデーション**: Zod
- **リアルタイム**: Socket.io
- **テスト**: Jest, @testing-library/react

参照: [TECH_STACK.md](./TECH_STACK.md)

---

## 🚀 デプロイ・本番環境

### Vercel へのデプロイ

```bash
# git push で自動デプロイ（GitHub連携時）
git add .
git commit -m "feature: xxx"
git push origin main

# Vercel ダッシュボードで確認
# https://vercel.com/dashboard
```

### 環境変数設定（Vercel）

Vercel Project Settings で以下を設定：
- `DATABASE_URL` → Railway/Supabase の本番DB
- `JWT_SECRET` → 安全なランダムキー

---

## 📞 よくある質問

**Q: 新しい API エンドポイントを追加したい**
A: [API_SPEC.md](./API_SPEC.md) で仕様確認 → `app/api/[endpoint].ts` 実装 → テスト追加

**Q: DB スキーマを変更したい**
A: `prisma/schema.prisma` 編集 → `pnpm prisma migrate dev` → コミット

**Q: UI コンポーネントを作成したい**
A: `components/` に TypeScript + Tailwind CSS で実装 → ストーリーブック検討（将来）

**Q: テストをスキップしたい**
A: しないでください。フェーズ1 終了後は全エンドポイントでテスト必須

---

最終更新: 2026年8月17日

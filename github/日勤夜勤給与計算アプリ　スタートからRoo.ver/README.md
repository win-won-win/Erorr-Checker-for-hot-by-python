# 給与集計アプリ

日勤・夜勤の勤務実績を入力し、月次で給与額を自動計算するアプリケーションです。

## 機能概要

- 勤怠登録：従業員ごとの勤務実績を入力
- 従業員管理：従業員情報の登録・編集・削除
- 日勤集計：日勤の勤務時間・支給額の集計
- 夜勤集計：夜勤の勤務時間・支給額の集計（複合計算ロジック）
- 締め処理：月次の締め処理と解除
- 印刷機能：集計結果のA4印刷対応

## 技術スタック

### フロントエンド
- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React-to-Print

### バックエンド
- Node.js 22
- Fastify
- TypeScript
- Supabase (PostgreSQL + Auth)

## 環境構築

### 前提条件
- Node.js 22以上
- npm 10以上
- Supabaseアカウントとプロジェクト

### インストール手順

1. リポジトリをクローン
```bash
git clone <repository-url>
cd 給与集計アプリ
```

2. 依存パッケージのインストール
```bash
# フロントエンド
npm install

# バックエンド
cd server
npm install
cd ..
```

3. Supabaseの設定
   - [Supabase](https://supabase.com/)でアカウントを作成し、新しいプロジェクトを作成します
   - `docs/supabase-setup.md`の手順に従って、Supabaseプロジェクトを設定します
   - `database/schema.sql`ファイルのSQLをSupabaseのSQLエディタで実行し、必要なテーブルを作成します

4. 環境変数の設定
   - `.env.example`ファイルを`.env`にコピーし、Supabase接続情報を設定します
   - `server/.env.example`ファイルを`server/.env`にコピーし、Supabase接続情報を設定します

5. アプリケーションの起動
```bash
# フロントエンドとバックエンドを同時に起動
npm run start
```

## 使い方

1. ブラウザで http://localhost:3000 にアクセス
2. ログイン画面でログイン（Supabase認証を使用）
3. 従業員管理画面で従業員を登録
4. 勤怠登録画面で勤務実績を入力
5. 日勤集計・夜勤集計画面で結果を確認・印刷
6. 月末に締め処理を実行

## Supabase連携

このアプリケーションは、Supabaseを使用してデータの保存と認証を行います：

- **認証**: Supabase Authを使用してユーザー認証を行います
- **データベース**: PostgreSQLデータベースを使用してデータを保存します
- **Row Level Security (RLS)**: データのアクセス制御を行います
- **リアルタイム更新**: Supabaseのリアルタイム機能を使用して、データの変更をリアルタイムに反映します（将来の拡張）

詳細な設定手順は `docs/supabase-setup.md` を参照してください。

## 開発者向け情報

### ディレクトリ構造

```
/
├── src/                  # フロントエンドソース
│   ├── components/       # 共通コンポーネント
│   ├── pages/            # ページコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── utils/            # ユーティリティ関数
│   ├── types/            # 型定義
│   ├── styles/           # スタイル
│   └── api/              # APIクライアント
│
├── server/               # バックエンドソース
│   ├── src/              # サーバーソース
│   │   ├── api/          # APIエンドポイント
│   │   ├── models/       # データモデル
│   │   ├── services/     # ビジネスロジック
│   │   ├── utils/        # ユーティリティ
│   │   └── types/        # 型定義
│   │
│   └── index.ts          # サーバーエントリーポイント
│
├── database/             # データベース関連
│   └── schema.sql        # データベーススキーマ
│
├── docs/                 # ドキュメント
│   └── supabase-setup.md # Supabase設定ガイド
│
├── public/               # 静的ファイル
└── ...
```

### スクリプト

- `npm run dev`: フロントエンド開発サーバーの起動
- `npm run server`: バックエンド開発サーバーの起動
- `npm run start`: フロントエンドとバックエンドを同時に起動
- `npm run build`: プロダクションビルド
- `npm run preview`: ビルド後のプレビュー

## ライセンス

社内利用向けアプリケーション
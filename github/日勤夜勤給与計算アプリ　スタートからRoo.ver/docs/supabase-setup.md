# Supabase設定ガイド

このドキュメントでは、給与集計アプリをSupabaseと接続するための設定手順を説明します。

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスし、アカウントを作成またはログインします。
2. 「New Project」をクリックして新しいプロジェクトを作成します。
3. プロジェクト名、データベースパスワード、リージョンを設定します。
4. 「Create new project」をクリックしてプロジェクトを作成します。

## 2. データベーススキーマの設定

1. Supabaseダッシュボードの「SQL Editor」を開きます。
2. 「New Query」をクリックして新しいクエリを作成します。
3. `database/schema.sql`ファイルの内容をコピーしてエディタに貼り付けます。
4. 「Run」をクリックしてSQLを実行します。
5. 「Table Editor」で各テーブルが正しく作成されたことを確認します。

## 3. 認証設定

1. Supabaseダッシュボードの「Authentication」→「Providers」を開きます。
2. 「Email」プロバイダーを有効にします。
   - 「Confirm email」のチェックを外すと、メール確認なしでログインできます。
   - または「Confirm email」を有効にして、確認メールを送信するように設定します。
3. 必要に応じて、他の認証プロバイダー（Google、GitHub、Microsoftなど）も設定します。

## 4. 環境変数の設定

1. Supabaseダッシュボードの「Project Settings」→「API」を開きます。
2. 以下の情報をコピーして、環境変数ファイルに設定します：

### フロントエンド（.env）

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:8000
```

### バックエンド（server/.env）

```
PORT=8000
HOST=0.0.0.0
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secure-jwt-secret-key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
```

- `VITE_SUPABASE_URL`と`SUPABASE_URL`には、「Project URL」をコピーします。
- `VITE_SUPABASE_ANON_KEY`には、「anon」「public」キーをコピーします。
- `SUPABASE_SERVICE_KEY`には、「service_role」キーをコピーします。
- `JWT_SECRET`には、安全な文字列を設定します。

## 5. Row Level Security (RLS)の確認

1. Supabaseダッシュボードの「Authentication」→「Policies」を開きます。
2. 各テーブルに対して、適切なRLSポリシーが設定されていることを確認します。
3. 必要に応じて、ポリシーを調整します。

## 6. ストレージの設定（オプション）

1. Supabaseダッシュボードの「Storage」を開きます。
2. 「Create new bucket」をクリックして新しいバケットを作成します。
3. バケット名を設定し、「Public」または「Private」を選択します。
4. RLSポリシーを設定して、適切なアクセス制御を行います。

## 7. アプリケーションの起動

1. フロントエンドとバックエンドの環境変数を設定した後、アプリケーションを起動します：

```bash
# プロジェクトルートディレクトリで実行
npm run start
```

2. ブラウザで http://localhost:3000 にアクセスして、アプリケーションが正常に動作することを確認します。

## トラブルシューティング

### 認証エラー

- 環境変数が正しく設定されているか確認してください。
- Supabaseプロジェクトの認証設定を確認してください。

### データベースエラー

- SQLスクリプトが正常に実行されたか確認してください。
- RLSポリシーが適切に設定されているか確認してください。

### CORS エラー

- バックエンドの`FRONTEND_URL`環境変数が正しく設定されているか確認してください。
- Supabaseダッシュボードの「Authentication」→「URL Configuration」で、正しいサイトURLが設定されているか確認してください。
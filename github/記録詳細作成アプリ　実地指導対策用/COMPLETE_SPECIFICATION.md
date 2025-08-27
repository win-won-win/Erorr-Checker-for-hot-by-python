# 介護サービス提供記録管理システム 完全仕様書

## 1. システム概要

### 1.1 目的
介護サービス提供実績のCSVデータを基に、リアルタイムな記録作成時間を再現しながら、サービス提供記録を効率的に管理するシステム。

### 1.2 技術スタック
- **フロントエンド**: React.js v18.3.1 + TypeScript
- **UI**: Tailwind CSS
- **開発環境**: Vite v5.4.2
- **データベース**: Supabase (PostgreSQL)
- **状態管理**: React hooks
- **フォーム管理**: React Hook Form v7.62.0
- **日付処理**: date-fns v4.1.0
- **CSV処理**: PapaParse v5.5.3
- **アイコン**: Lucide React v0.344.0

### 1.3 アーキテクチャ
- **SPA (Single Page Application)**
- **コンポーネントベース設計**
- **レスポンシブデザイン**
- **PWA対応可能**

## 2. データベース設計

### 2.1 テーブル構成

#### 2.1.1 users（利用者テーブル）
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 利用者名（必須）
  birth_date date,                       -- 生年月日
  user_code text UNIQUE,                 -- 利用者コード
  name_kana text DEFAULT '',             -- 氏名カナ
  care_level text DEFAULT '',            -- 要介護度
  insurance_number text DEFAULT '',      -- 保険者番号
  insured_number text DEFAULT '',        -- 被保険者番号
  address text DEFAULT '',               -- 住所
  phone text DEFAULT '',                 -- 電話番号
  emergency_contact text DEFAULT '',     -- 緊急連絡先
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.1.2 staff（従業員テーブル）
```sql
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 従業員名（必須）
  birth_date date,                       -- 生年月日
  staff_code text UNIQUE,                -- 職員コード
  email text DEFAULT '',                 -- メールアドレス
  phone text DEFAULT '',                 -- 電話番号
  address text DEFAULT '',               -- 住所
  hire_date date,                        -- 入社日
  is_service_manager boolean DEFAULT false, -- サービス提供責任者フラグ
  qualification text DEFAULT '',         -- 資格
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.1.3 facilities（施設テーブル）
```sql
CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- 事業所名（必須）
  address text DEFAULT '',               -- 事業所所在地
  phone text DEFAULT '',                 -- 電話番号
  fax text DEFAULT '',                   -- FAX番号
  email text DEFAULT '',                 -- メールアドレス
  license_number text DEFAULT '',        -- 事業所番号
  manager_name text DEFAULT '',          -- 管理者名
  notes text DEFAULT '',                 -- 備考
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.1.4 service_patterns（パターン保管テーブル）
```sql
CREATE TABLE service_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,            -- パターン名
  user_id uuid REFERENCES users(id),     -- 利用者ID（リレーション）
  start_time time,                       -- 開始時間
  end_time time,                         -- 終了時間
  pattern_details jsonb DEFAULT '{}',    -- パターン詳細（JSON）
  description text DEFAULT '',           -- 説明
  usage_count integer DEFAULT 0,         -- 使用回数
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.1.5 comment_templates（一言コメント定型文テーブル）
```sql
CREATE TABLE comment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_text text NOT NULL,            -- コメント内容
  comment_group text NOT NULL,           -- グループ（体調良好/体調不良/普通/その他）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2.1.6 csv_service_records（CSV取り込み用サービス記録テーブル）
```sql
CREATE TABLE csv_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),              -- 利用者ID（リレーション）
  staff_id uuid REFERENCES staff(id),             -- 従業員ID（リレーション）
  facility_id uuid REFERENCES facilities(id),     -- 施設ID（リレーション）
  pattern_id uuid REFERENCES service_patterns(id), -- パターンID（リレーション）
  comment_template_id uuid REFERENCES comment_templates(id), -- コメントテンプレートID
  
  -- CSV基本データ
  user_name text NOT NULL,               -- 利用者名（CSV由来）
  staff_name text NOT NULL,              -- 担当職員名（CSV由来）
  start_time time NOT NULL,              -- 開始時間
  end_time time NOT NULL,                -- 終了時間
  duration_minutes integer NOT NULL,     -- 実施時間（分）
  service_date date NOT NULL,            -- 西暦日付（YYYY-MM-DD）
  
  -- 自動生成・管理データ
  service_content text DEFAULT '',       -- サービス内容（CSV由来）
  special_notes text DEFAULT '',         -- 特記事項（定型文から自動選択）
  record_created_at timestamptz,         -- 記録作成日時（ランダム生成、手動記録時上書き）
  print_datetime timestamptz,            -- 印刷日時（1週間に1度自動、手動印刷時上書き）
  
  -- 詳細記録データ
  service_details jsonb DEFAULT '{}',    -- サービス詳細（パターンから自動設定）
  
  -- メタデータ
  is_manually_created boolean DEFAULT false, -- 手動作成フラグ
  csv_import_batch_id text,              -- CSV一括取り込みバッチID
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2.2 CSV取り込みロジック

#### 2.2.1 CSVデータ構造（必要カラムのみ抽出）
```csv
利用者名,担当所員,開始時間,終了時間,実施時間,西暦日付
田中 花子,渡邉 由可里,09:00,10:00,60,令和07年07月31日 (木)
山田 次郎,笠間 京子,14:00,15:00,60,令和07年07月31日 (木)
```

#### 2.2.2 名前正規化・マッチングロジック
```javascript
// 名前の正規化処理
function normalizeName(name) {
  return name
    .replace(/\s+/g, ' ')           // 複数スペースを単一スペースに
    .replace(/　/g, ' ')            // 全角スペースを半角に
    .replace(/^〇/, '')             // 先頭の〇マークを除去
    .trim();                       // 前後の空白を除去
}

// 利用者の自動マッチング・作成
async function matchOrCreateUser(userName) {
  const normalizedName = normalizeName(userName);
  
  // 既存利用者を検索
  let user = await supabase
    .from('users')
    .select('*')
    .eq('name', normalizedName)
    .single();
    
  // 存在しない場合は新規作成
  if (!user.data) {
    user = await supabase
      .from('users')
      .insert({ name: normalizedName })
      .select('*')
      .single();
  }
  
  return user.data;
}

// 職員の自動マッチング・作成
async function matchOrCreateStaff(staffName) {
  const normalizedName = normalizeName(staffName);
  
  // 既存職員を検索
  let staff = await supabase
    .from('staff')
    .select('*')
    .eq('name', normalizedName)
    .single();
    
  // 存在しない場合は新規作成
  if (!staff.data) {
    staff = await supabase
      .from('staff')
      .insert({ name: normalizedName })
      .select('*')
      .single();
  }
  
  return staff.data;
}
```

#### 2.2.3 パターン自動紐付けロジック
```javascript
// 同じ利用者・同じ時間帯のパターンを検索（初回は作成が必要）
async function findOrCreatePattern(userId, userName, startTime, endTime) {
  const pattern = await supabase
    .from('service_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('start_time', startTime)
    .eq('end_time', endTime)
    .single();
    
  if (pattern.data) {
    // 既存パターンを使用
    return pattern.data;
  } else {
    // 新規パターン作成が必要
    return null; // フロントエンドでパターン作成画面を表示
  }
}

// パターン学習システム
// 1回目：利用者・時間の組み合わせが初回の場合、パターン作成が必要（時間がかかる）
// 2回目以降：同じ利用者・同じ時間なら既存パターンを自動適用（効率化）
```

#### 2.2.4 ランダム時間生成
```javascript
// 記録作成時間の確率分布
function generateRecordTime(serviceStart, serviceEnd) {
  const random = Math.random() * 100;
  
  if (random <= 15) {
    // 終了1-10分前（15％）
    return randomTimeBetween(serviceEnd - 10分, serviceEnd - 1分);
  } else if (random <= 65) {
    // 前後3分（50％）
    return randomTimeBetween(serviceStart - 3分, serviceEnd + 3分);
  } else if (random <= 95) {
    // 終了後3-15分（30％）
    return randomTimeBetween(serviceEnd + 3分, serviceEnd + 15分);
  } else {
    // 終了後1時間（5％）
    return serviceEnd + 1時間;
  }
}

// 印刷日時の自動生成（1週間に1度）
function generatePrintTime(serviceDate) {
  const baseDate = new Date(serviceDate);
  const daysToAdd = Math.floor(Math.random() * 7) + 1; // 1-7日後
  const printDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  // 営業時間内（9:00-18:00）にランダム設定
  const hour = Math.floor(Math.random() * 9) + 9; // 9-17時
  const minute = Math.floor(Math.random() * 60);
  
  printDate.setHours(hour, minute, 0, 0);
  return printDate;
}
```

#### 2.2.5 一言コメント自動選択
```javascript
// グループ別コメント自動選択
async function selectRandomComment(group = null) {
  let query = supabase.from('comment_templates').select('*');
  
  if (group) {
    query = query.eq('comment_group', group);
  }
  
  const { data: comments } = await query;
  
  if (comments && comments.length > 0) {
    const randomIndex = Math.floor(Math.random() * comments.length);
    return comments[randomIndex];
  }
  
  return null;
}

// 体調グループの確率分布
function selectCommentGroup() {
  const random = Math.random() * 100;
  
  if (random <= 60) return '普通系';      // 60%
  if (random <= 80) return '体調がいい系';   // 20%
  if (random <= 95) return 'その他';     // 15%
  return '体調が悪い系';                    // 5%
}
```

## 3. 機能仕様

### 3.1 メイン機能（表側）- 通常記録アプリ

#### 3.1.1 ダッシュボード (`/src/components/Dashboard.tsx`)
**機能**:
- 本日の予定・記録統計表示
- 利用者・職員数の表示
- 本日の予定一覧（記録済み/未記録の状態表示）

**表示項目**:
- 本日の予定数
- 本日の記録数
- 総利用者数
- 総職員数
- 予定一覧（利用者名、担当職員、時間、サービス種類、記録状態）

#### 3.1.2 マスター管理機能
**利用者管理**:
- 利用者の新規作成・編集・削除
- 基本情報（名前、生年月日、利用者コード等）
- 介護情報（要介護度、保険番号等）

**従業員管理**:
- 従業員の新規作成・編集・削除
- 基本情報（名前、生年月日、職員コード等）
- 職務情報（資格、サービス提供責任者フラグ等）

**施設管理**:
- 施設情報の管理
- 事業所名、所在地、連絡先等

**一言コメント管理**:
- 定型文の作成・編集・削除
- グループ別管理（体調良好/不良/普通/その他）
- 各グループ15件ずつ事前登録

#### 3.1.3 予定管理 (`/src/components/ScheduleManagement.tsx`)
**機能**:
- 週間カレンダー表示
- 予定の作成・編集・削除
- 予定一覧表示

**入力項目**:
- 利用者選択（ドロップダウン）
- 担当職員選択（ドロップダウン）
- サービス日（日付ピッカー）
- 開始時間・終了時間（時間ピッカー）
- サービス種類（身体介護/生活援助/通院介助/その他）
- サービス内容（自由入力）

#### 3.1.4 記録入力 (`/src/components/ServiceRecordForm.tsx`)
**機能**:
- 予定選択からの記録作成
- 詳細なサービス実施記録の入力
- チェックボックス形式の項目選択
- **記録作成時間の上書き**: 手動記録時は`record_created_at`を現在時刻で上書き

**入力項目詳細**:

##### 事前チェック
- ■健康チェック
  - 体温（°C）
  - 血圧（　　　／　　　）
  - 脈拍
- □環境整備
- □相談援助、記録等

##### 排泄介助
- □トイレ
- □ポータブル
- □おむつ交換
- □パッド交換
- □洗浄・清拭
- □排便（　回）
- □排尿（　回）

##### 食事介助
- ■全介助［□完食 □残量（　）］
- □水分補給（　cc）

##### 身体清拭・入浴
- □清拭（□全身 □部分）
- □全身入浴
- ■部分浴（□手・□足）
- □洗髪
- ■洗面
- □整容
- ■口腔ケア

##### 身体整容
- ■爪切り（□手□足）
- □更衣介助

##### 移乗・移動
- ■移乗介助
- ■移動介助
- ■外出介助
- ■体位変換

##### 起床・就寝
- ■起床介助
- □就寝介助

##### 服薬・医療行為
- ■服薬介助
- ■軟膏・湿布・目薬
- □痰吸引

##### 自立支援
- ■共に行う調理
- ■安全の見守り
- ■共に行う家事
- □意欲・関心の引き出し

##### 生活援助
**清掃**:
- □居宅
- □トイレ
- □卓上の掃除
- □ゴミ出し
- □準備・後片付け

**洗濯**:
- ■洗濯乾燥
- □取り入れ・収納
- ■アイロン掛け

**寝具の手入れ**:
- □シーツ交換
- □カバー交換
- □ベッドメイク
- ■布団干し

**衣類**:
- □衣類の整理
- ■衣類の補修

**調理・配下膳**:
- □一般的な調理
- □配下膳
- □後片付け

**買い物等**:
- ■日常品等の買い物
- ■薬の受取り

##### 退出確認
- □火元
- □電気
- □水道
- □戸締まり

##### 特記事項・預り金
- 特記・連絡事項（自由記述）
- 預り金（円）
- 内訳
- 買い物お釣り（円）

#### 3.1.5 記録一覧 (`/src/components/RecordList.tsx`)
**機能**:
- 記録の検索・フィルタリング
- 記録詳細表示
- 印刷プレビュー
- CSVエクスポート
- 記録の編集・削除
- **印刷時間の上書き**: 手動印刷時は`print_datetime`を現在時刻で上書き

**フィルター項目**:
- 日付範囲（開始日〜終了日）
- 利用者名
- 担当職員名
- サービス種類

### 3.2 管理機能（裏側）- CSV一括処理

#### 3.2.1 CSV一括インポート (`/src/components/CSVImport.tsx`)
**機能**:
- CSVファイルのアップロード・解析
- 名前正規化・自動マッチング
- 利用者・職員の自動作成
- パターン自動紐付け
- 記録作成時間のランダム生成
- 印刷時間の自動生成
- 一言コメントの自動選択

**CSVデータ構造（簡略化）**:
```csv
利用者名,担当職員,開始時間,終了時間,実施時間,西暦日付
```

**必要カラム詳細**:
- `利用者名`: 利用者の氏名（正規化処理後マッチング）
- `担当所員`: 担当職員名（〇マーク除去後マッチング）
- `開始時間`: サービス開始時間（HH:mm形式）
- `終了時間`: サービス終了時間（HH:mm形式）
- `実施時間`: サービス実施時間（分単位）
- `西暦日付`: サービス実施日（令和形式対応）

**文字コード対応**:
- Shift-JIS
- UTF-8

**パターン自動紐付け機能**:
- **1回目**: 同じ利用者・同じ時間で初回の場合、パターン作成が必要（時間がかかる）
- **2回目以降**: 既存パターンを自動適用（楽になる）
- パターンマッチング条件: `user_id` + `start_time` + `end_time`

#### 3.2.2 パターン管理 (`/src/components/PatternManagement.tsx`)
**機能**:
- サービスパターンの作成・編集・削除
- パターンのコピー・エクスポート・インポート
- パターンの詳細設定
- 利用者・時間別パターン管理

**パターンデータ構造**:
```typescript
interface ServicePattern {
  id: string;
  pattern_name: string;
  user_id: string;           // 利用者ID（リレーション）
  start_time: string;        // 開始時間
  end_time: string;          // 終了時間
  pattern_details: {
    pre_check: { ... };
    excretion: { ... };
    meal: { ... };
    // ... 全サービス項目
  };
  description: string;
  usage_count: number;       // 使用回数
  created_at: string;
  updated_at: string;
}
```

### 3.3 印刷機能 (`/src/components/PrintPreview.tsx`)
**機能**:
- 実際の帳票形式での印刷プレビュー
- A4横向きサイズ対応
- チェックボックス状態の視覚化
- 印刷専用CSS
- **印刷時間の記録**: 実際に印刷した場合は`print_datetime`を更新

**印刷レイアウト**:
- ヘッダー（事業所名、基本情報）
- サービス項目（チェックボックス形式）
- 特記事項欄
- 預り金管理欄
- 利用者捺印欄
- フッター（印刷日時）

## 4. ユーティリティ・ヘルパー関数

### 4.1 CSV解析 (`/src/utils/csvParser.ts`)
**機能**:
- Shift-JIS/UTF-8対応のCSV解析
- 簡略化されたCSVカラム解析
- データバリデーション
- 名前正規化処理

**主要関数**:
```typescript
export function parseSimplifiedCSV(file: File): Promise<SimplifiedServiceData[]>
export function validateSimplifiedCSVData(data: SimplifiedServiceData[]): { valid: SimplifiedServiceData[], errors: string[] }
export function normalizeName(name: string): string
```

### 4.2 記録時間生成 (`/src/utils/recordTimeGenerator.ts`)
**機能**:
- 確率分布に基づく記録作成時間の生成
- 印刷時間の自動生成

**確率分布**:
- サービス終了時間の10分〜1分前：15％
- サービス提供時間の前後3分：50％
- 終了後3分から15分：30％
- 終了後1時間：5％

**主要関数**:
```typescript
export function generateRecordTime(serviceStart: Date, serviceEnd: Date): Date
export function generatePrintTime(serviceDate: Date): Date
export function timeStringToDate(dateStr: string, timeStr: string): Date
```

### 4.3 Supabase設定 (`/src/lib/supabase.ts`)
**機能**:
- Supabaseクライアントの初期化
- 接続状態の確認
- 型定義

**環境変数**:
- `VITE_SUPABASE_URL`: SupabaseプロジェクトURL
- `VITE_SUPABASE_ANON_KEY`: Supabase匿名キー

## 5. UI/UX仕様

### 5.1 デザインシステム
- **カラーパレット**: Tailwind CSS標準色
- **プライマリカラー**: Indigo (indigo-600)
- **フォント**: システムフォント
- **アイコン**: Lucide React

### 5.2 レスポンシブ対応
- **モバイル**: 320px〜768px
- **タブレット**: 768px〜1024px
- **デスクトップ**: 1024px以上

### 5.3 アクセシビリティ
- **キーボードナビゲーション**対応
- **スクリーンリーダー**対応
- **カラーコントラスト**準拠

## 6. セキュリティ仕様

### 6.1 認証・認可
- **Supabase Auth**による認証
- **Row Level Security (RLS)**によるデータアクセス制御
- **JWT**トークンベース認証

### 6.2 データ保護
- **HTTPS**通信の強制
- **個人情報**の暗号化
- **アクセスログ**の記録

## 7. パフォーマンス仕様

### 7.1 最適化
- **コンポーネント遅延読み込み**
- **画像最適化**
- **バンドルサイズ最適化**

### 7.2 制約
- **CSVファイルサイズ**: 最大10MB
- **同時インポート**: 1件まで
- **データ保持期間**: 3年間

## 8. 開発・デプロイ仕様

### 8.1 開発環境
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

### 8.2 環境変数
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 8.3 ファイル構成
```
src/
├── components/           # Reactコンポーネント
│   ├── Layout.tsx       # レイアウトコンポーネント
│   ├── Dashboard.tsx    # ダッシュボード
│   ├── ScheduleManagement.tsx  # 予定管理
│   ├── ServiceRecordForm.tsx   # 記録入力フォーム
│   ├── RecordList.tsx   # 記録一覧
│   ├── CSVImport.tsx    # CSV一括インポート
│   ├── PatternManagement.tsx   # パターン管理
│   └── PrintPreview.tsx # 印刷プレビュー
├── lib/                 # ライブラリ設定
│   └── supabase.ts     # Supabase設定
├── utils/              # ユーティリティ関数
│   ├── csvParser.ts    # CSV解析
│   └── recordTimeGenerator.ts  # 記録時間生成
├── App.tsx             # メインアプリケーション
├── main.tsx           # エントリーポイント
└── index.css          # グローバルスタイル
```

## 9. 運用仕様

### 9.1 バックアップ
- **Supabase**による自動バックアップ
- **CSVエクスポート**による手動バックアップ

### 9.2 監査
- **操作ログ**の自動記録
- **データ変更履歴**の追跡
- **インポートログ**の保存

### 9.3 メンテナンス
- **定期的なデータクリーンアップ**
- **パフォーマンス監視**
- **セキュリティアップデート**

## 10. 拡張仕様

### 10.1 将来的な機能拡張
- **レポート機能**
- **統計分析機能**
- **モバイルアプリ対応**
- **API連携機能**
- **多言語対応**

### 10.2 システム連携
- **他システムとのAPI連携**
- **クラウドストレージ連携**
- **メール通知機能**

## 11. 重要な仕様変更点

### 11.1 データベース構造の簡略化
- **CSV取り込み専用テーブル**: `csv_service_records`に統合
- **必要最小限のカラム**: 6カラムのみ（利用者名、担当職員、開始時間、終了時間、実施時間、西暦日付）
- **リレーション重視**: 全てのマスターテーブルとの適切な関連付け

### 11.2 自動化機能の強化
- **名前正規化**: 〇マーク除去、スペース統一
- **自動マッチング**: 既存データとの照合、新規作成
- **パターン学習**: 利用者・時間別の自動パターン適用
- **ランダム時間生成**: 記録作成時間・印刷時間の自動設定
- **コメント自動選択**: グループ別定型文の確率的選択

### 11.3 運用効率化
- **1回目**: パターン作成が必要（時間がかかる）
- **2回目以降**: 自動パターン適用（効率化）
- **印刷管理**: 1週間に1度の自動印刷時間設定
- **上書き機能**: 手動操作時の時間更新

---

この仕様書は、介護サービス提供記録管理システムの完全な技術仕様を網羅しており、新しいデータベース構造とCSV取り込みロジックに基づいて設計されています。別のAIや開発者がシステムを理解・再構築するために必要な全ての情報を含んでいます。
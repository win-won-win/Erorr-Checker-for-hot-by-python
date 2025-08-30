# 詳細表示機能 実装計画書

## 1. プロジェクト概要

### 1.1 目的
サービス実態と勤怠履歴の不整合検出結果に対して、詳細情報を提供する機能を実装する。基本情報はCSVに追加し、詳細情報はStreamlitグリッドで別途表示する。

### 1.2 要件
1. **重複の詳細情報**: 重複相手の具体的な情報、重複時間、重複タイプ
2. **勤怠データ照合の詳細情報**: 勤務時間区間、カバー状況、超過時間

### 1.3 アプローチ
- 既存機能の互換性を完全に維持
- 段階的な実装により安全性を確保
- 基本情報（CSV）と詳細情報（UI）の二段階表示

## 2. 実装計画

### 2.1 Phase 1: データ構造とコア関数の実装

#### 2.1.1 新規データクラスの追加 (src.py)

```python
# 既存のIntervalクラスの後に追加
@dataclass
class OverlapInfo:
    """重複情報の詳細"""
    idx1: int
    idx2: int
    facility1: str
    facility2: str
    staff1: str
    staff2: str
    start1: datetime
    end1: datetime
    start2: datetime
    end2: datetime
    overlap_start: datetime
    overlap_end: datetime
    overlap_minutes: int
    overlap_type: str  # "完全重複" | "部分重複"

@dataclass
class CoverageInfo:
    """カバー状況の詳細情報"""
    is_fully_covered: bool
    coverage_status: str  # "完全カバー" | "部分カバー" | "カバー不足"
    total_service_minutes: int
    covered_minutes: int
    uncovered_minutes: int
    work_intervals: List[str]  # 勤務区間の文字列表現
    covered_intervals: List[str]  # カバーされた区間
    uncovered_intervals: List[str]  # カバーされていない区間
    work_interval_count: int
```

#### 2.1.2 新規関数の実装

**ファイル**: `src.py`
**場所**: 既存の関数の後に追加

1. `find_overlaps_with_details()` - 詳細情報付き重複検出
2. `analyze_coverage_details()` - 詳細なカバー分析
3. `calculate_uncovered_intervals()` - 未カバー区間計算
4. `update_overlap_details_in_csv()` - CSV重複詳細更新
5. `update_coverage_details_in_csv()` - CSVカバー詳細更新
6. `generate_detail_id()` - 詳細ID生成

#### 2.1.3 実装順序

1. データクラスの定義
2. ヘルパー関数の実装
3. コア分析関数の実装
4. CSV更新関数の実装

**推定工数**: 2-3日

### 2.2 Phase 2: メイン処理関数の拡張

#### 2.2.1 process_with_details関数の実装

**ファイル**: `src.py`
**場所**: 既存のprocess関数の後に追加

主な変更点:
- 詳細情報を格納する辞書の追加
- 新規詳細カラムの初期化
- 詳細情報付きの重複検出・勤怠照合
- CSVへの詳細情報書き込み

#### 2.2.2 既存process関数の更新

```python
def process(input_dir: Path, prefer_identical: str = 'earlier', alt_delim: str = '/', 
           service_staff_col: str = SERVICE_STAFF_COL, att_name_col: str = ATT_NAME_COL, 
           write_diagnostics: bool = True, use_schedule_when_missing: bool = False) -> None:
    """既存のprocess関数（互換性維持）"""
    facility_details = process_with_details(
        input_dir, prefer_identical, alt_delim, service_staff_col, 
        att_name_col, write_diagnostics, use_schedule_when_missing
    )
    # 詳細情報は破棄（既存の動作を維持）
```

**推定工数**: 3-4日

### 2.3 Phase 3: Streamlitアプリの拡張

#### 2.3.1 グリッドデータ準備関数の拡張

**ファイル**: `streamlit_app.py`
**場所**: 既存のprepare_grid_data関数を置き換え

```python
def prepare_grid_data_with_details(result_paths, detail_data=None):
    """詳細情報を含むグリッドデータを準備"""
    # 新しいカラム（H-N）を追加
    # 詳細情報の統合
```

#### 2.3.2 詳細分析表示機能の追加

**ファイル**: `streamlit_app.py`
**場所**: 既存のビュー選択部分を拡張

新規追加機能:
1. `show_overlap_analysis()` - 重複分析表示
2. `show_attendance_excess_analysis()` - 勤怠超過分析表示
3. `show_row_detail_modal()` - 行詳細情報表示
4. `show_overlap_partners()` - 重複相手詳細表示
5. `show_attendance_details()` - 勤怠詳細表示

#### 2.3.3 UI拡張

- 新しいビュー選択オプション「詳細分析表示」の追加
- 表示カラム選択機能の拡張
- 行選択機能の実装
- 詳細情報モーダル表示

**推定工数**: 4-5日

### 2.4 Phase 4: テストと最適化

#### 2.4.1 単体テスト

**新規テストファイル**: `test_detail_functions.py`

テスト対象:
- `find_overlaps_with_details()`
- `analyze_coverage_details()`
- `calculate_uncovered_intervals()`
- CSV更新関数群

#### 2.4.2 統合テスト

**既存テストファイル**: `test_integration.py`の拡張

- 既存機能との互換性確認
- 詳細情報生成の正確性確認
- パフォーマンステスト

#### 2.4.3 最適化

- 大量データでのパフォーマンス改善
- メモリ使用量の最適化
- エラーハンドリングの強化

**推定工数**: 2-3日

## 3. 具体的な変更点

### 3.1 src.py の変更

#### 3.1.1 新規追加（行数: 約400行）

```python
# 1. データクラス（約50行）
@dataclass
class OverlapInfo: ...
@dataclass  
class CoverageInfo: ...

# 2. 詳細分析関数（約200行）
def find_overlaps_with_details(): ...
def analyze_coverage_details(): ...
def calculate_uncovered_intervals(): ...

# 3. CSV更新関数（約50行）
def update_overlap_details_in_csv(): ...
def update_coverage_details_in_csv(): ...
def generate_detail_id(): ...

# 4. メイン処理関数（約100行）
def process_with_details(): ...
```

#### 3.1.2 既存関数の更新

```python
# process関数を軽微に変更（互換性維持）
def process(): ...  # 内部でprocess_with_detailsを呼び出し

# 既存の関数は変更なし（互換性完全維持）
def find_overlaps(): ...  # 変更なし
def interval_fully_covered(): ...  # 変更なし
```

### 3.2 streamlit_app.py の変更

#### 3.2.1 新規追加（行数: 約300行）

```python
# 1. グリッドデータ準備（約50行）
def prepare_grid_data_with_details(): ...

# 2. 詳細分析表示（約150行）
def show_overlap_analysis(): ...
def show_attendance_excess_analysis(): ...

# 3. 詳細情報表示（約100行）
def show_row_detail_modal(): ...
def show_overlap_partners(): ...
def show_attendance_details(): ...
```

#### 3.2.2 既存部分の更新

```python
# ビュー選択部分の拡張（約20行の変更）
view_type = st.radio(..., options=[..., "詳細分析表示", ...])

# グリッド表示部分の拡張（約50行の変更）
# 新しいカラム表示、行選択機能の追加
```

### 3.3 新規CSVカラム

既存の3列（エラー、カテゴリ、代替職員リスト）に以下8列を追加:

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| 重複時間（分） | int | 重複している時間の合計 |
| 超過時間（分） | int | 勤怠を超過している時間 |
| 重複相手施設 | str | 重複している相手施設名 |
| 重複相手担当者 | str | 重複している相手の担当者名 |
| 重複タイプ | str | 完全重複/部分重複 |
| カバー状況 | str | 完全カバー/部分カバー/カバー不足 |
| 勤務区間数 | int | 該当職員の当日勤務区間数 |
| 詳細ID | str | 詳細情報参照用ID |

## 4. リスク管理

### 4.1 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 既存機能の破綻 | 高 | 段階的実装、十分なテスト |
| パフォーマンス劣化 | 中 | プロファイリング、最適化 |
| メモリ不足 | 中 | 大量データでのテスト |
| UI/UXの複雑化 | 低 | ユーザビリティテスト |

### 4.2 スケジュールリスク

| リスク | 対策 |
|--------|------|
| 実装の遅延 | バッファ期間の確保 |
| テスト不足 | 自動テストの充実 |
| 要件変更 | 柔軟な設計の採用 |

## 5. 品質保証

### 5.1 テスト戦略

1. **単体テスト**: 新規関数の動作確認
2. **統合テスト**: 既存機能との整合性確認
3. **パフォーマンステスト**: 大量データでの動作確認
4. **ユーザビリティテスト**: UI/UXの使いやすさ確認

### 5.2 品質基準

- 既存機能の完全な互換性維持
- 新機能の正確性（手動検証との一致）
- パフォーマンス劣化なし（既存比較）
- UI応答性の維持

## 6. 成果物

### 6.1 コード成果物

1. **src.py** (拡張版)
   - 新規データクラス
   - 詳細分析関数群
   - 拡張されたメイン処理関数

2. **streamlit_app.py** (拡張版)
   - 詳細表示機能
   - 拡張されたグリッド表示
   - インタラクティブ機能

3. **test_detail_functions.py** (新規)
   - 新機能の単体テスト

### 6.2 ドキュメント成果物

1. **detail_design.md** - 全体設計書
2. **csv_columns_design.md** - CSV拡張設計書
3. **streamlit_detail_design.md** - UI設計書
4. **function_extension_design.md** - 関数拡張設計書
5. **implementation_plan.md** - 実装計画書（本書）

## 7. 実装スケジュール

| Phase | 期間 | 主な作業 | 成果物 |
|-------|------|---------|--------|
| Phase 1 | 3日 | データ構造・コア関数実装 | 拡張されたsrc.py |
| Phase 2 | 4日 | メイン処理関数拡張 | 完全なsrc.py |
| Phase 3 | 5日 | Streamlitアプリ拡張 | 拡張されたstreamlit_app.py |
| Phase 4 | 3日 | テスト・最適化 | テストコード、最適化版 |
| **合計** | **15日** | | **完成版システム** |

## 8. 実装後の効果

### 8.1 期待される効果

1. **問題特定の精度向上**: 重複や超過の具体的な内容が明確になる
2. **対応効率の向上**: 詳細情報により適切な対応策を迅速に決定可能
3. **データ品質の向上**: 詳細な分析により根本原因の特定が容易
4. **ユーザビリティの向上**: 段階的な情報表示により使いやすさが向上

### 8.2 定量的な改善指標

- 問題解決時間: 30%短縮（推定）
- データ分析精度: 50%向上（推定）
- ユーザー満足度: 向上（定性的）

この実装計画に従って段階的に開発を進めることで、安全かつ効率的に詳細表示機能を実装できます。
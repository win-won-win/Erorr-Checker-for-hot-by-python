# 詳細表示機能設計書

## 1. 概要
サービス実態と勤怠履歴の不整合検出結果に対して、詳細情報を提供する機能の設計。
基本情報はCSVに追加し、詳細情報はStreamlitグリッドで別途表示する。

## 2. 要件分析

### 2.1 重複の詳細情報
- どの施設・時間帯と重複しているかの詳細
- 重複相手の具体的な情報（施設名、担当者、時間帯）
- 重複時間の長さ（分）
- 重複タイプ（完全重複・部分重複）

### 2.2 勤怠データ照合の詳細情報
- 該当職員の実際の勤務時間区間
- どの勤怠データと照合しているか（同じ日付で複数ある場合は全て）
- カバー状況（どの部分がカバーされ、どの部分が超過しているか）
- 超過時間（分）

## 3. データ構造設計

### 3.1 詳細情報データクラス

```python
@dataclass
class OverlapDetail:
    """重複の詳細情報"""
    overlap_type: str  # "完全重複" | "部分重複"
    overlap_facility: str  # 重複相手の施設名
    overlap_staff: str  # 重複相手の担当者
    overlap_start: str  # 重複相手の開始時間
    overlap_end: str  # 重複相手の終了時間
    overlap_duration_minutes: int  # 重複時間（分）

@dataclass
class AttendanceDetail:
    """勤怠照合の詳細情報"""
    staff_work_intervals: List[str]  # 該当職員の勤務時間区間リスト
    coverage_status: str  # "完全カバー" | "部分カバー" | "カバー不足"
    covered_intervals: List[str]  # カバーされている区間
    uncovered_intervals: List[str]  # カバーされていない区間
    excess_duration_minutes: int  # 超過時間（分）

@dataclass
class DetailInfo:
    """統合詳細情報"""
    row_index: int
    facility: str
    overlap_details: List[OverlapDetail]
    attendance_detail: Optional[AttendanceDetail]
```

### 3.2 CSVへの基本詳細情報カラム追加

既存の3列（エラー、カテゴリ、代替職員リスト）に以下を追加：

| カラム名 | 内容 | 例 |
|---------|------|-----|
| 重複時間（分） | 重複している時間の合計 | "60" |
| 超過時間（分） | 勤怠を超過している時間 | "30" |
| 重複相手施設 | 重複している相手施設名 | "サービス実態B" |
| カバー状況 | 勤怠でのカバー状況 | "部分カバー" |

## 4. 既存関数への拡張設計

### 4.1 find_overlaps関数の拡張

```python
def find_overlaps_with_details(df1: pd.DataFrame, df2: pd.DataFrame, 
                              facility1: str, facility2: str) -> List[Tuple[int, int, OverlapDetail]]:
    """
    重複検出に詳細情報を追加
    戻り値: (idx1, idx2, overlap_detail)のリスト
    """
```

### 4.2 interval_fully_covered関数の拡張

```python
def analyze_coverage_details(target: Interval, covers: List[Interval], 
                           staff_name: str) -> AttendanceDetail:
    """
    勤怠照合の詳細分析
    カバー状況、カバー区間、未カバー区間、超過時間を計算
    """
```

### 4.3 process関数の拡張

```python
def process_with_details(input_dir: Path, ...) -> Tuple[None, Dict[str, List[DetailInfo]]]:
    """
    既存のprocess関数を拡張し、詳細情報も同時に生成
    戻り値: (None, 施設別詳細情報辞書)
    """
```

## 5. Streamlitグリッド表示設計

### 5.1 詳細表示モード

```python
def show_detail_view(detail_info: DetailInfo):
    """
    選択された行の詳細情報を表示
    - 重複詳細: 相手施設、時間帯、重複時間をテーブル表示
    - 勤怠詳細: 勤務区間、カバー状況を視覚的に表示
    """
```

### 5.2 グリッド拡張

```python
def prepare_grid_data_with_details(result_paths, detail_data):
    """
    既存のグリッドデータに詳細情報カラムを追加
    - 重複時間（分）
    - 超過時間（分）
    - 詳細表示ボタン
    """
```

## 6. 実装計画

### Phase 1: データ構造とコア関数の拡張
1. 詳細情報データクラスの実装
2. find_overlaps_with_details関数の実装
3. analyze_coverage_details関数の実装

### Phase 2: CSV出力の拡張
1. 基本詳細情報カラムの追加
2. process関数の拡張
3. CSV出力フォーマットの更新

### Phase 3: Streamlit UI の拡張
1. 詳細表示モードの実装
2. グリッドデータの拡張
3. インタラクティブな詳細表示機能

## 7. 技術的考慮事項

### 7.1 パフォーマンス
- 詳細情報の生成は必要時のみ実行
- 大量データでのメモリ使用量に注意

### 7.2 データ整合性
- 既存の検出ロジックとの整合性を保持
- 詳細情報の正確性を検証

### 7.3 UI/UX
- 詳細情報の可読性を重視
- 段階的な情報開示（概要→詳細）

## 8. 期待される効果

1. **問題の特定精度向上**: 重複や超過の具体的な内容が明確になる
2. **対応効率の向上**: 詳細情報により適切な対応策を迅速に決定可能
3. **データ品質の向上**: 詳細な分析により根本原因の特定が容易
4. **ユーザビリティの向上**: 段階的な情報表示により使いやすさが向上
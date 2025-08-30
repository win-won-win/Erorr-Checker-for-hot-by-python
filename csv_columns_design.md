# CSV基本詳細情報カラム設計

## 1. 現在のCSV構造

### 既存カラム（先頭3列）
1. `エラー` - フラグ（"◯" または空）
2. `カテゴリ` - エラーカテゴリ（"施設間重複", "事業所内重複", "勤怠履歴超過"）
3. `代替職員リスト` - 代替候補職員（"/"区切り）

### 元データカラム
- 西暦日付, 開始時間, 終了時間, 担当所員, 利用者名, サービス内容, 実施時間 等

## 2. 新規追加カラム設計

### 2.1 カラム定義

| カラム名 | データ型 | 内容 | 例 | 備考 |
|---------|---------|------|-----|------|
| `重複時間（分）` | int | 重複している時間の合計（分） | `60` | 重複なしの場合は `0` |
| `超過時間（分）` | int | 勤怠を超過している時間（分） | `30` | 超過なしの場合は `0` |
| `重複相手施設` | str | 重複している相手施設名 | `サービス実態B` | 複数の場合は `，` 区切り |
| `重複相手担当者` | str | 重複している相手の担当者名 | `田中太郎` | 複数の場合は `，` 区切り |
| `重複タイプ` | str | 重複の種類 | `部分重複` | `完全重複`, `部分重複`, または空 |
| `カバー状況` | str | 勤怠でのカバー状況 | `部分カバー` | `完全カバー`, `部分カバー`, `カバー不足` |
| `勤務区間数` | int | 該当職員の当日勤務区間数 | `2` | 勤怠データがない場合は `0` |
| `詳細ID` | str | 詳細情報参照用ID | `A_001_001` | `{施設}_{行番号}_{連番}` |

### 2.2 カラム配置順序

```
[エラー] [カテゴリ] [代替職員リスト] [重複時間（分）] [超過時間（分）] [重複相手施設] [重複相手担当者] [重複タイプ] [カバー状況] [勤務区間数] [詳細ID] [既存の元データカラム...]
```

## 3. データ生成ロジック

### 3.1 重複関連カラムの生成

```python
def calculate_overlap_details(row_index: int, facility: str, df: pd.DataFrame, 
                            all_facilities: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    """
    重複関連の詳細情報を計算
    """
    result = {
        '重複時間（分）': 0,
        '重複相手施設': '',
        '重複相手担当者': '',
        '重複タイプ': ''
    }
    
    current_row = df.loc[row_index]
    if pd.isna(current_row['_開始DT']) or pd.isna(current_row['_終了DT']):
        return result
    
    current_interval = Interval(current_row['_開始DT'], current_row['_終了DT'])
    current_staff = current_row['_担当所員_norm']
    
    overlap_facilities = []
    overlap_staff = []
    total_overlap_minutes = 0
    overlap_types = set()
    
    # 他施設との重複チェック
    for other_facility, other_df in all_facilities.items():
        if other_facility == facility:
            continue
            
        for other_idx, other_row in other_df.iterrows():
            if (other_row['_担当所員_norm'] == current_staff and 
                not pd.isna(other_row['_開始DT']) and 
                not pd.isna(other_row['_終了DT'])):
                
                other_interval = Interval(other_row['_開始DT'], other_row['_終了DT'])
                
                # 重複チェック
                if current_interval.start < other_interval.end and other_interval.start < current_interval.end:
                    overlap_start = max(current_interval.start, other_interval.start)
                    overlap_end = min(current_interval.end, other_interval.end)
                    overlap_minutes = int((overlap_end - overlap_start).total_seconds() / 60)
                    
                    total_overlap_minutes += overlap_minutes
                    overlap_facilities.append(other_facility)
                    overlap_staff.append(other_row['_担当所員'])
                    
                    # 重複タイプの判定
                    if (current_interval.start == other_interval.start and 
                        current_interval.end == other_interval.end):
                        overlap_types.add('完全重複')
                    else:
                        overlap_types.add('部分重複')
    
    # 同一施設内重複チェック
    for other_idx, other_row in df.iterrows():
        if (other_idx != row_index and 
            other_row['_担当所員_norm'] == current_staff and 
            not pd.isna(other_row['_開始DT']) and 
            not pd.isna(other_row['_終了DT'])):
            
            other_interval = Interval(other_row['_開始DT'], other_row['_終了DT'])
            
            if current_interval.start < other_interval.end and other_interval.start < current_interval.end:
                overlap_start = max(current_interval.start, other_interval.start)
                overlap_end = min(current_interval.end, other_interval.end)
                overlap_minutes = int((overlap_end - overlap_start).total_seconds() / 60)
                
                total_overlap_minutes += overlap_minutes
                overlap_facilities.append(facility)  # 同一施設
                overlap_staff.append(other_row['_担当所員'])
                
                if (current_interval.start == other_interval.start and 
                    current_interval.end == other_interval.end):
                    overlap_types.add('完全重複')
                else:
                    overlap_types.add('部分重複')
    
    result['重複時間（分）'] = total_overlap_minutes
    result['重複相手施設'] = '，'.join(sorted(set(overlap_facilities))) if overlap_facilities else ''
    result['重複相手担当者'] = '，'.join(sorted(set(overlap_staff))) if overlap_staff else ''
    result['重複タイプ'] = '，'.join(sorted(overlap_types)) if overlap_types else ''
    
    return result
```

### 3.2 勤怠関連カラムの生成

```python
def calculate_attendance_details(row_index: int, df: pd.DataFrame, 
                               att_map: Dict[str, List[Interval]]) -> Dict[str, Any]:
    """
    勤怠関連の詳細情報を計算
    """
    result = {
        '超過時間（分）': 0,
        'カバー状況': '',
        '勤務区間数': 0
    }
    
    current_row = df.loc[row_index]
    if pd.isna(current_row['_開始DT']) or pd.isna(current_row['_終了DT']):
        result['カバー状況'] = 'データ不正'
        return result
    
    staff_key = current_row['_担当所員_norm']
    work_intervals = att_map.get(staff_key, [])
    result['勤務区間数'] = len(work_intervals)
    
    if not work_intervals:
        result['カバー状況'] = 'カバー不足'
        service_minutes = int((current_row['_終了DT'] - current_row['_開始DT']).total_seconds() / 60)
        result['超過時間（分）'] = service_minutes
        return result
    
    service_interval = Interval(current_row['_開始DT'], current_row['_終了DT'])
    
    # カバー状況の詳細分析
    covered_seconds = 0
    for work_iv in work_intervals:
        overlap_start = max(service_interval.start, work_iv.start)
        overlap_end = min(service_interval.end, work_iv.end)
        if overlap_start < overlap_end:
            covered_seconds += (overlap_end - overlap_start).total_seconds()
    
    service_seconds = (service_interval.end - service_interval.start).total_seconds()
    uncovered_seconds = max(0, service_seconds - covered_seconds)
    
    if uncovered_seconds <= 60:  # 1分以下の誤差は許容
        result['カバー状況'] = '完全カバー'
        result['超過時間（分）'] = 0
    elif covered_seconds > 0:
        result['カバー状況'] = '部分カバー'
        result['超過時間（分）'] = int(uncovered_seconds / 60)
    else:
        result['カバー状況'] = 'カバー不足'
        result['超過時間（分）'] = int(service_seconds / 60)
    
    return result
```

### 3.3 詳細ID生成

```python
def generate_detail_id(facility: str, row_index: int) -> str:
    """
    詳細情報参照用IDを生成
    """
    facility_code = facility.replace('サービス実態', '')  # A, B, C等を抽出
    return f"{facility_code}_{row_index:03d}_{int(time.time()) % 1000:03d}"
```

## 4. 実装における注意点

### 4.1 データ型の統一
- 時間関連は全て分単位の整数で統一
- 文字列の区切り文字は `，`（全角カンマ）で統一
- 空値の場合は空文字列 `''` または `0` を使用

### 4.2 パフォーマンス考慮
- 重複計算は既存の `find_overlaps` 結果を活用
- 勤怠照合は既存の `interval_fully_covered` 結果を活用
- 大量データでの処理時間を考慮した実装

### 4.3 エラーハンドリング
- 不正な時間データの場合の適切な処理
- 存在しない職員名の場合の処理
- 計算エラー時のフォールバック処理

## 5. CSV出力フォーマット例

```csv
エラー,カテゴリ,代替職員リスト,重複時間（分）,超過時間（分）,重複相手施設,重複相手担当者,重複タイプ,カバー状況,勤務区間数,詳細ID,西暦日付,開始時間,終了時間,担当所員,利用者名,サービス内容,実施時間
◯,施設間重複,山田花子/佐藤次郎,60,0,サービス実態B,田中太郎,部分重複,完全カバー,2,A_001_123,2024/01/15,09:00,10:00,田中太郎,利用者A,訪問介護,60
,,,0,30,,,,,カバー不足,0,A_002_124,2024/01/15,14:00,15:00,鈴木一郎,利用者B,訪問介護,60
◯,事業所内重複,,,45,0,サービス実態A,田中太郎,完全重複,完全カバー,2,A_003_125,2024/01/15,16:00,16:45,田中太郎,利用者C,訪問介護,45
```

## 6. 既存コードへの統合

### 6.1 process関数の修正箇所

```python
# 5) 出力（先頭3列: エラー / カテゴリ / 代替職員リスト + 新規詳細カラム）
for fac, df in service_raw.items():
    # 詳細情報カラムを追加
    detail_columns = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者', 
                     '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID']
    
    for col in detail_columns:
        if col not in df.columns:
            df.insert(len([ERR_COL, CAT_COL, ALT_COL]), col, "")
    
    # 各行の詳細情報を計算
    for idx in df.index:
        overlap_details = calculate_overlap_details(idx, fac, df, service_raw)
        attendance_details = calculate_attendance_details(idx, df, att_map)
        detail_id = generate_detail_id(fac, idx)
        
        for col, value in overlap_details.items():
            df.at[idx, col] = value
        for col, value in attendance_details.items():
            df.at[idx, col] = value
        df.at[idx, '詳細ID'] = detail_id
```

この設計により、CSVに基本的な詳細情報が追加され、より詳細な分析が可能になります。
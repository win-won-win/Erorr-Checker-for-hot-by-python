# 既存関数への拡張方法設計

## 1. 拡張対象関数の分析

### 1.1 主要関数の現在の役割
- [`find_overlaps()`](src.py:353-388): 重複検出（インデックスペアのリストを返す）
- [`interval_fully_covered()`](src.py:337-351): 勤怠照合（真偽値を返す）
- [`build_work_intervals()`](src.py:197-295): 勤怠区間構築（職員別区間辞書を返す）
- [`process()`](src.py:477-703): メイン処理（CSV出力まで）

### 1.2 拡張の必要性
現在の関数は基本的な検出機能のみを提供しており、詳細情報（重複時間、相手情報、カバー詳細等）は生成していません。要件を満たすためには、これらの関数を拡張または新規関数を追加する必要があります。

## 2. 関数拡張設計

### 2.1 find_overlaps関数の拡張

#### 2.1.1 新規関数: find_overlaps_with_details

```python
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

def find_overlaps_with_details(df1: pd.DataFrame, df2: pd.DataFrame, 
                              facility1: str, facility2: str) -> List[OverlapInfo]:
    """
    重複検出に詳細情報を追加した版
    
    Args:
        df1, df2: 比較対象のDataFrame
        facility1, facility2: 施設名
    
    Returns:
        OverlapInfoのリスト
    """
    overlaps: List[OverlapInfo] = []
    
    # スタッフごとに分けて重複をチェック
    for staff in df1["_担当所員_norm"].dropna().unique():
        if pd.isna(staff) or staff == "":
            continue
            
        # 該当スタッフのレコードを抽出
        g1 = df1[df1["_担当所員_norm"] == staff].copy()
        g2 = df2[df2["_担当所員_norm"] == staff].copy()
        
        if g1.empty or g2.empty:
            continue
            
        # 有効な時間データのみを対象
        g1 = g1.dropna(subset=["_開始DT", "_終了DT"])
        g2 = g2.dropna(subset=["_開始DT", "_終了DT"])
        
        if g1.empty or g2.empty:
            continue
        
        # 全ペアをチェック
        for idx1, row1 in g1.iterrows():
            for idx2, row2 in g2.iterrows():
                s1, e1 = row1["_開始DT"], row1["_終了DT"]
                s2, e2 = row2["_開始DT"], row2["_終了DT"]
                
                # 時間の重複をチェック
                if s1 < e2 and s2 < e1:  # overlap condition
                    overlap_start = max(s1, s2)
                    overlap_end = min(e1, e2)
                    overlap_minutes = int((overlap_end - overlap_start).total_seconds() / 60)
                    
                    # 重複タイプの判定
                    if s1 == s2 and e1 == e2:
                        overlap_type = "完全重複"
                    else:
                        overlap_type = "部分重複"
                    
                    overlap_info = OverlapInfo(
                        idx1=idx1,
                        idx2=idx2,
                        facility1=facility1,
                        facility2=facility2,
                        staff1=row1["_担当所員"],
                        staff2=row2["_担当所員"],
                        start1=s1,
                        end1=e1,
                        start2=s2,
                        end2=e2,
                        overlap_start=overlap_start,
                        overlap_end=overlap_end,
                        overlap_minutes=overlap_minutes,
                        overlap_type=overlap_type
                    )
                    overlaps.append(overlap_info)
    
    return overlaps
```

#### 2.1.2 既存関数との互換性維持

```python
def find_overlaps(df1: pd.DataFrame, df2: pd.DataFrame) -> List[Tuple[int, int]]:
    """
    既存の関数（互換性維持）
    内部的にfind_overlaps_with_detailsを使用
    """
    facility1 = "facility1"  # ダミー値
    facility2 = "facility2"  # ダミー値
    detailed_overlaps = find_overlaps_with_details(df1, df2, facility1, facility2)
    return [(overlap.idx1, overlap.idx2) for overlap in detailed_overlaps]
```

### 2.2 interval_fully_covered関数の拡張

#### 2.2.1 新規関数: analyze_coverage_details

```python
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

def analyze_coverage_details(target: Interval, covers: List[Interval], 
                           staff_name: str) -> CoverageInfo:
    """
    勤怠照合の詳細分析
    
    Args:
        target: サービス実施区間
        covers: 勤務区間のリスト
        staff_name: 職員名
    
    Returns:
        CoverageInfo: カバー状況の詳細
    """
    if not covers:
        total_minutes = int((target.end - target.start).total_seconds() / 60)
        return CoverageInfo(
            is_fully_covered=False,
            coverage_status="カバー不足",
            total_service_minutes=total_minutes,
            covered_minutes=0,
            uncovered_minutes=total_minutes,
            work_intervals=[],
            covered_intervals=[],
            uncovered_intervals=[f"{target.start.strftime('%H:%M')}-{target.end.strftime('%H:%M')}"],
            work_interval_count=0
        )
    
    # 勤務区間の文字列表現を作成
    work_intervals = [f"{iv.start.strftime('%H:%M')}-{iv.end.strftime('%H:%M')}" for iv in covers]
    
    # カバー状況の詳細計算
    total_seconds = (target.end - target.start).total_seconds()
    covered_seconds = 0.0
    covered_intervals = []
    
    for work_iv in covers:
        overlap_start = max(target.start, work_iv.start)
        overlap_end = min(target.end, work_iv.end)
        if overlap_start < overlap_end:
            overlap_seconds = (overlap_end - overlap_start).total_seconds()
            covered_seconds += overlap_seconds
            covered_intervals.append(f"{overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}")
    
    uncovered_seconds = max(0, total_seconds - covered_seconds)
    
    # カバー状況の判定
    if uncovered_seconds <= 60:  # 1分以下の誤差は許容
        coverage_status = "完全カバー"
        is_fully_covered = True
        uncovered_intervals = []
    elif covered_seconds > 0:
        coverage_status = "部分カバー"
        is_fully_covered = False
        # 未カバー区間の計算（簡略化）
        uncovered_intervals = calculate_uncovered_intervals(target, covers)
    else:
        coverage_status = "カバー不足"
        is_fully_covered = False
        uncovered_intervals = [f"{target.start.strftime('%H:%M')}-{target.end.strftime('%H:%M')}"]
    
    return CoverageInfo(
        is_fully_covered=is_fully_covered,
        coverage_status=coverage_status,
        total_service_minutes=int(total_seconds / 60),
        covered_minutes=int(covered_seconds / 60),
        uncovered_minutes=int(uncovered_seconds / 60),
        work_intervals=work_intervals,
        covered_intervals=covered_intervals,
        uncovered_intervals=uncovered_intervals,
        work_interval_count=len(covers)
    )

def calculate_uncovered_intervals(target: Interval, covers: List[Interval]) -> List[str]:
    """未カバー区間を計算"""
    # 既存のsubtract_many関数を活用
    uncovered = subtract_many(target, covers)
    return [f"{iv.start.strftime('%H:%M')}-{iv.end.strftime('%H:%M')}" for iv in uncovered]
```

#### 2.2.2 既存関数との互換性維持

```python
def interval_fully_covered(target: Interval, covers: List[Interval]) -> bool:
    """
    既存の関数（互換性維持）
    内部的にanalyze_coverage_detailsを使用
    """
    coverage_info = analyze_coverage_details(target, covers, "")
    return coverage_info.is_fully_covered
```

### 2.3 process関数の拡張

#### 2.3.1 詳細情報生成の統合

```python
def process_with_details(input_dir: Path, prefer_identical: str = 'earlier', 
                        alt_delim: str = '/', service_staff_col: str = SERVICE_STAFF_COL, 
                        att_name_col: str = ATT_NAME_COL, write_diagnostics: bool = True, 
                        use_schedule_when_missing: bool = False) -> Dict[str, Dict[str, Any]]:
    """
    詳細情報付きの処理関数
    
    Returns:
        Dict[str, Dict[str, Any]]: 施設別の詳細情報
        {
            "facility_name": {
                "overlap_details": List[OverlapInfo],
                "coverage_details": Dict[int, CoverageInfo],  # 行インデックス -> カバー情報
                "detail_data": Dict[str, DetailInfo]  # 詳細ID -> 詳細情報
            }
        }
    """
    # 既存のprocess関数の処理をベースに拡張
    
    # ファイル探索（既存と同じ）
    service_files: List[Path] = []
    att_file: Optional[Path] = None
    for p in input_dir.glob("*.csv"):
        name = p.name
        if name.startswith("result_") or name.startswith("_result_"):
            continue
        if "勤怠" in name:
            att_file = p
        else:
            service_files.append(p)

    if not service_files:
        raise SystemExit("施設のサービス実態CSVが見つかりません。")
    if not att_file:
        raise SystemExit("勤怠履歴CSVが見つかりません。")

    # 勤怠ロード＆インターバル化（既存と同じ）
    att_df = pd.read_csv(att_file, encoding=ENCODING)
    att_map, att_name_index = build_work_intervals(att_df, name_col=att_name_col, 
                                                  use_schedule_when_missing=use_schedule_when_missing)

    # 施設ごとのデータロード＆インターバル化（既存と同じ）
    service_raw: Dict[str, pd.DataFrame] = {}
    for sf in service_files:
        fac = sf.stem
        df = pd.read_csv(sf, encoding=ENCODING)
        service_raw[fac] = build_service_records(sf, df, fac, staff_col=service_staff_col)

    # 詳細情報を格納する辞書
    facility_details: Dict[str, Dict[str, Any]] = {}
    
    # フラグ列の初期化（既存と同じ）
    for fac, df in service_raw.items():
        if ERR_COL not in df.columns:
            df.insert(0, ALT_COL, "")
            df.insert(0, CAT_COL, "")
            df.insert(0, ERR_COL, "")
        else:
            df[ERR_COL] = ""
            df[CAT_COL] = ""
            df[ALT_COL] = ""
        
        # 新規詳細カラムの初期化
        detail_columns = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者', 
                         '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID']
        
        for col in detail_columns:
            if col not in df.columns:
                df.insert(len([ERR_COL, CAT_COL, ALT_COL]), col, "")
        
        # 施設別詳細情報の初期化
        facility_details[fac] = {
            "overlap_details": [],
            "coverage_details": {},
            "detail_data": {}
        }

    facilities = sorted(service_raw.keys())
    flagged_indices: Dict[str, set] = {fac: set() for fac in facilities}

    # 1) 施設間重複の検出（詳細情報付き）
    for i in range(len(facilities)):
        for j in range(i+1, len(facilities)):
            f1, f2 = facilities[i], facilities[j]
            df1, df2 = service_raw[f1], service_raw[f2]

            # 詳細情報付きの重複検出
            overlap_infos = find_overlaps_with_details(df1, df2, f1, f2)
            
            # 詳細情報を保存
            facility_details[f1]["overlap_details"].extend(overlap_infos)
            facility_details[f2]["overlap_details"].extend(overlap_infos)
            
            for overlap_info in overlap_infos:
                idx1, idx2 = overlap_info.idx1, overlap_info.idx2
                r1 = df1.loc[idx1]
                r2 = df2.loc[idx2]
                
                # フラグ付与の決定（既存ロジック）
                tgt = decide_flag_target(r1, r2, prefer_identical=prefer_identical)
                if tgt == 1:
                    flagged_indices[f1].add(idx1)
                    # 詳細情報をCSVカラムに設定
                    update_overlap_details_in_csv(df1, idx1, overlap_info, f2)
                else:
                    flagged_indices[f2].add(idx2)
                    # 詳細情報をCSVカラムに設定
                    update_overlap_details_in_csv(df2, idx2, overlap_info, f1)

    # 2) 事業所内重複の検出（詳細情報付き）
    for fac, df in service_raw.items():
        internal_overlaps = find_overlaps_with_details(df, df, fac, fac)
        # 自分自身との比較は除外
        internal_overlaps = [overlap for overlap in internal_overlaps if overlap.idx1 != overlap.idx2]
        
        facility_details[fac]["overlap_details"].extend(internal_overlaps)
        
        # 重複ペアを処理（既存ロジック + 詳細情報追加）
        processed_pairs = set()
        for overlap_info in internal_overlaps:
            idx1, idx2 = overlap_info.idx1, overlap_info.idx2
            pair = tuple(sorted([idx1, idx2]))
            if pair in processed_pairs:
                continue
            processed_pairs.add(pair)
            
            r1 = df.loc[idx1]
            r2 = df.loc[idx2]
            
            if r1["_担当所員_norm"] != r2["_担当所員_norm"]:
                continue
                
            tgt = decide_flag_target(r1, r2, prefer_identical=prefer_identical)
            target_idx = idx1 if tgt == 1 else idx2
            
            # エラーフラグとカテゴリの設定（既存ロジック）
            if df.at[target_idx, ERR_COL] == FLAG:
                existing_cat = str(df.at[target_idx, CAT_COL] or "")
                categories = [c.strip() for c in existing_cat.split("，") if c.strip()]
                if "事業所内重複" not in categories:
                    categories.append("事業所内重複")
                    df.at[target_idx, CAT_COL] = "，".join(sorted(categories))
            else:
                df.at[target_idx, ERR_COL] = FLAG
                df.at[target_idx, CAT_COL] = "事業所内重複"
            
            # 詳細情報をCSVカラムに設定
            update_overlap_details_in_csv(df, target_idx, overlap_info, fac)

    # フラグ付け（施設間重複）
    for fac, df in service_raw.items():
        if flagged_indices[fac]:
            df.loc[list(flagged_indices[fac]), ERR_COL] = FLAG
            df.loc[list(flagged_indices[fac]), CAT_COL] = "施設間重複"

    # 3) 勤怠履歴超過の検出（詳細情報付き）
    for fac, df in service_raw.items():
        for idx, r in df.iterrows():
            if pd.isna(r["_開始DT"]) or pd.isna(r["_終了DT"]):
                continue
            
            staff = r["_担当所員_norm"]
            iv = Interval(r["_開始DT"], r["_終了DT"])
            work_ivs = att_map.get(staff, [])
            
            # 詳細なカバー分析
            coverage_info = analyze_coverage_details(iv, work_ivs, staff)
            facility_details[fac]["coverage_details"][idx] = coverage_info
            
            # CSVカラムに詳細情報を設定
            update_coverage_details_in_csv(df, idx, coverage_info)
            
            if not coverage_info.is_fully_covered:
                # エラーフラグとカテゴリの設定（既存ロジック）
                if df.at[idx, ERR_COL] != FLAG:
                    df.at[idx, ERR_COL] = FLAG
                    df.at[idx, CAT_COL] = "勤怠履歴超過"
                else:
                    cat = df.at[idx, CAT_COL]
                    parts = [c for c in [cat, "勤怠履歴超過"] if c]
                    df.at[idx, CAT_COL] = "，".join(sorted(set(parts)))

    # 4) 代替職員リストの生成（既存ロジック）
    busy_map = build_staff_busy_map(service_raw)
    for fac, df in service_raw.items():
        need_rows = df[df[CAT_COL].str.contains("重複|勤怠履歴超過", na=False)]
        for idx, r in need_rows.iterrows():
            iv = Interval(r["_開始DT"], r["_終了DT"])
            staff = r["_担当所員_norm"]
            alts = list_available_staff(iv, att_map, busy_map, exclude=staff, att_name_index=att_name_index)
            
            if alts:
                new = alt_delim.join(alts)
            else:
                new = "ー"
            prev = str(df.at[idx, ALT_COL] or "").strip()
            if prev and prev != "ー":
                merged = sorted(set([p for p in prev.split("/") if p] + alts))
                df.at[idx, ALT_COL] = "/".join(merged) if merged else "ー"
            else:
                df.at[idx, ALT_COL] = new

    # 5) 詳細IDの生成と詳細データの構築
    for fac, df in service_raw.items():
        for idx in df.index:
            detail_id = generate_detail_id(fac, idx)
            df.at[idx, '詳細ID'] = detail_id
            
            # 詳細データの構築
            overlap_details = [overlap for overlap in facility_details[fac]["overlap_details"] 
                             if overlap.idx1 == idx or overlap.idx2 == idx]
            coverage_detail = facility_details[fac]["coverage_details"].get(idx)
            
            facility_details[fac]["detail_data"][detail_id] = {
                "row_index": idx,
                "facility": fac,
                "overlap_details": overlap_details,
                "coverage_detail": coverage_detail
            }

    # 6) 診断情報の出力（既存ロジック）
    if write_diagnostics:
        # 既存の診断情報出力処理
        pass

    # 7) CSV出力（既存ロジック + 詳細カラム）
    for fac, df in service_raw.items():
        # 内部列は落としてから出力
        out_df = df.copy()
        for c in ["_開始DT","_終了DT","_担当所員","施設"]:
            if c in out_df.columns:
                out_df.drop(columns=[c], inplace=True)

        # カラムの並び順を調整
        base_cols = [ERR_COL, CAT_COL, ALT_COL]
        detail_cols = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者', 
                      '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID']
        other_cols = [c for c in out_df.columns if c not in base_cols + detail_cols]
        cols = base_cols + detail_cols + other_cols
        out_df = out_df[cols]

        out_path = input_dir / f"result_{fac}.csv"
        out_df.to_csv(out_path, index=False, encoding=ENCODING)

    return facility_details

def update_overlap_details_in_csv(df: pd.DataFrame, idx: int, overlap_info: OverlapInfo, partner_facility: str):
    """CSVの重複詳細カラムを更新"""
    current_overlap_time = df.at[idx, '重複時間（分）'] or 0
    df.at[idx, '重複時間（分）'] = current_overlap_time + overlap_info.overlap_minutes
    
    current_facilities = str(df.at[idx, '重複相手施設'] or "")
    facilities = [f.strip() for f in current_facilities.split("，") if f.strip()]
    if partner_facility not in facilities:
        facilities.append(partner_facility)
    df.at[idx, '重複相手施設'] = "，".join(sorted(facilities))
    
    current_staff = str(df.at[idx, '重複相手担当者'] or "")
    staff_list = [s.strip() for s in current_staff.split("，") if s.strip()]
    partner_staff = overlap_info.staff2 if overlap_info.idx1 == idx else overlap_info.staff1
    if partner_staff not in staff_list:
        staff_list.append(partner_staff)
    df.at[idx, '重複相手担当者'] = "，".join(sorted(staff_list))
    
    df.at[idx, '重複タイプ'] = overlap_info.overlap_type

def update_coverage_details_in_csv(df: pd.DataFrame, idx: int, coverage_info: CoverageInfo):
    """CSVのカバー詳細カラムを更新"""
    df.at[idx, '超過時間（分）'] = coverage_info.uncovered_minutes
    df.at[idx, 'カバー状況'] = coverage_info.coverage_status
    df.at[idx, '勤務区間数'] = coverage_info.work_interval_count

def generate_detail_id(facility: str, row_index: int) -> str:
    """詳細情報参照用IDを生成"""
    import time
    facility_code = facility.replace('サービス実態', '')
    return f"{facility_code}_{row_index:03d}_{int(time.time()) % 1000:03d}"
```

#### 2.3.2 既存process関数の更新

```python
def process(input_dir: Path, prefer_identical: str = 'earlier', alt_delim: str = '/', 
           service_staff_col: str = SERVICE_STAFF_COL, att_name_col: str = ATT_NAME_COL, 
           write_diagnostics: bool = True, use_schedule_when_missing: bool = False) -> None:
    """
    既存のprocess関数（互換性維持）
    内部的にprocess_with_detailsを使用
    """
    facility_details = process_with_details(
        input_dir, prefer_identical, alt_delim, service_staff_col, 
        att_name_col, write_diagnostics, use_schedule_when_missing
    )
    # 詳細情報は破棄（既存の動作を維持）
```

## 3. 実装における考慮事項

### 3.1 パフォーマンス
- 詳細情報の生成は計算量が増加するため、最適化が必要
- 大量データでのメモリ使用量に注意
- 必要に応じてキャッシュ機能を実装

### 3.2 互換性
- 既存の関数は完全に互換性を維持
- 新しい詳細情報機能はオプション扱い
- 既存のテストケースが通ることを確認

### 3.3 エラーハンドリング
- 不正なデータに対する適切な処理
- 詳細情報生成時のエラーハンドリング
- ログ出力の充実

## 4. 段階的実装アプローチ

### Phase 1: データ構造とコア関数
1. OverlapInfo, CoverageInfoデータクラスの実装
2. find_overlaps_with_details関数の実装
3. analyze_coverage_details関数の実装

### Phase 2: 統合処理
1. process_with_details関数の実装
2. CSV詳細カラム更新関数の実装
3. 詳細ID生成機能の実装

### Phase 3: テストと最適化
1. 既存機能との互換性テスト
2. パフォーマンステスト
3. エラーハンドリングの強化

この設計により、既存の機能を維持しながら詳細情報機能を追加できます。
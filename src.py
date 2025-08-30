#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
サービス実態CSVと勤怠履歴CSVの不整合検出＆補正案作成ツール
Usage:
  python src.py --input /input           # 本番データ
  python src.py --input /test_input      # テストデータ
  python src.py --input /some/dir        # 任意のディレクトリ
出力:
  各施設の元CSVと同じディレクトリに result_元ファイル名.csv を生成
"""
import argparse
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Iterable
import unicodedata
import math

import pandas as pd

ENCODING = "cp932"  # 入出力はWindows-31J想定（添付データ準拠）
SERVICE_DATE_COL = "西暦日付"
SERVICE_START_COL = "開始時間"
SERVICE_END_COL = "終了時間"
SERVICE_STAFF_COL = "担当所員"

ATT_DATE_COL = "*年月日"
ATT_NAME_COL = "名前"
# 実打刻の列名は「出勤n」「退勤n」「休憩n」「復帰n」想定（n=1..10）
WORK_IN_COLS = [f"出勤{i}" for i in range(1, 11)]
WORK_OUT_COLS = [f"退勤{i}" for i in range(1, 11)]
BREAK_START_COLS = [f"休憩{i}" for i in range(1, 11)]
BREAK_END_COLS = [f"復帰{i}" for i in range(1, 11)]

ERR_COL = "エラー"
CAT_COL = "カテゴリ"
ALT_COL = "代替職員リスト"

FLAG = "◯"

from dataclasses import dataclass

@dataclass(frozen=True)
class Interval:
    start: datetime
    end: datetime

    def duration_minutes(self) -> int:
        return int((self.end - self.start).total_seconds() // 60)

    def overlaps(self, other: "Interval") -> bool:
        return self.start < other.end and other.start < self.end

    def is_equal(self, other: "Interval") -> bool:
        return self.start == other.start and self.end == other.end

    def contains(self, other: "Interval") -> bool:
        return self.start <= other.start and self.end >= other.end

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




def normalize_name(s: str) -> str:
    """
    名前正規化（ユーザー提示のJSロジックに準拠）+ 異体字マップ + 先頭丸印除去
    ※ 外部ライブラリ 'regex' は使用せず、標準 're' のみで実装
    """
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""

    # 1) trim
    normalized = str(s).strip()
    if normalized == "":
        return ""

    # 2) control chars & replacement char '�' (U+FFFD)
    import re as _re
    normalized = _re.sub(r"[\x00-\x1F\x7F-\x9F]", "", normalized)
    normalized = normalized.replace("\uFFFD", "")

    # 3) unify spaces to half-width single spaces (temporarily)
    normalized = _re.sub(r"[\u3000\s]+", " ", normalized)

    # 4) remove symbols (spec) and leading circle markers
    normalized = _re.sub(r"[⚪★（）()・]", "", normalized)
    normalized = _re.sub(r"^[\u25EF\u3007\u25CB\u25CF\u25CE\u2B55\u26AA\u26AB\u2605\u2606]+", "", normalized)

    # 5) NFKC
    try:
        normalized = unicodedata.normalize("NFKC", normalized)
    except Exception:
        pass

    # 6) full-width alnum -> half-width alnum
    def fw_to_hw(match):
        ch = match.group(0)
        return chr(ord(ch) - 0xFEE0)
    normalized = _re.sub(r"[Ａ-Ｚａ-ｚ０-９]", fw_to_hw, normalized)

    # 7) collapse spaces and trim
    normalized = _re.sub(r"\s+", " ", normalized).strip()

    # 8) valid char check
    if not _re.search(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFa-zA-Z0-9]", normalized):
        return ""

    # 9) variants + mojibake
    mapping = {
        "﨑": "崎",
        "髙": "高",
        "德": "徳",
        "邊": "辺",
        "廣": "広",
        "澤": "沢",
        "齋": "斎",
        "眞": "真",
        "淸": "清",
        "𠮷": "吉",
    }
    for src, tgt in mapping.items():
        normalized = normalized.replace(src, tgt)
    normalized = normalized.replace("早_", "早崎").replace("早＿", "早崎")

    return normalized


def parse_date_any(s: str) -> datetime:
    """
    'YYYY/M/D' 等を datetime.date に。時刻は 00:00。
    """
    s = str(s).strip()
    # 一応 pandas で吸収
    d = pd.to_datetime(s, errors="coerce")
    if pd.isna(d):
        # 和暦などが来た場合にも備える（ただし添付データは西暦列がある）
        # フォールバック：数字以外をスラッシュに寄せる
        s2 = re.sub(r"[^\d/]", "", s)
        d = pd.to_datetime(s2, errors="coerce")
    if pd.isna(d):
        raise ValueError(f"日付を解釈できません: {s}")
    return datetime(d.year, d.month, d.day)

_TIME_RE = re.compile(r"^\s*(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?\s*$")

def parse_minute_of_day(s: str) -> Optional[int]:
    """
    'HH:MM' or 'H:MM' or '32:00:00' を分に。
    24時超もそのまま分に変換（例: 26:30 -> 1590）。
    """
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    s = str(s).strip()
    if s == "" or s.lower() == "nan":
        return None
    m = _TIME_RE.match(s)
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2) or "0")
    return hh * 60 + mm

def minute_to_datetimetetime(base_date: datetime, minute: int) -> datetime:
    """
    base_date の 00:00 を起点に minute 分後の datetime を返す。
    1440 分（=24h）超も OK。
    """
    days, mins = divmod(minute, 1440)
    return base_date + timedelta(days=days, minutes=mins)

def subtract_interval(base: Interval, cut: Interval) -> List[Interval]:
    """
    base から cut を差し引いた残り区間（0～2個）を返す。
    """
    if not base.overlaps(cut):
        return [base]
    parts: List[Interval] = []
    if base.start < cut.start:
        parts.append(Interval(base.start, min(base.end, cut.start)))
    if cut.end < base.end:
        parts.append(Interval(max(base.start, cut.end), base.end))
    return [p for p in parts if p.start < p.end]

def subtract_many(base: Interval, cuts: Iterable[Interval]) -> List[Interval]:
    segments = [base]
    for c in cuts:
        next_segments: List[Interval] = []
        for seg in segments:
            next_segments.extend(subtract_interval(seg, c))
        segments = next_segments
        if not segments:
            break
    return segments

def build_work_intervals(att_df: pd.DataFrame, name_col: str = ATT_NAME_COL, use_schedule_when_missing: bool = False) -> Tuple[Dict[str, List[Interval]], Dict[str, List[str]]]:
    """
    勤怠（実打刻）から従業員ごとの労働区間を構築。
    - 出勤1 が NaN の日は無視
    - 休憩/復帰は労働時間から差し引き
    - 24時超は翌日へ繰り上げ
    """
    needed_cols = set([name_col, ATT_DATE_COL])
    if not needed_cols.issubset(att_df.columns):
        raise RuntimeError(f"勤怠CSVに必要列が不足しています: {needed_cols - set(att_df.columns)}")

    name_to_intervals: Dict[str, List[Interval]] = {}

    for _, row in att_df.iterrows():
        raw_name = row.get(name_col)
        name = normalize_name(raw_name)
        date_base = parse_date_any(row[ATT_DATE_COL])

        # 出勤1 が空なら非勤務日としてスキップ
        first_in = parse_minute_of_day(row.get("出勤1"))
        if first_in is None:
            if use_schedule_when_missing:
                sin_sched = parse_minute_of_day(row.get("出勤予定時刻"))
                sout_sched = parse_minute_of_day(row.get("退勤予定時刻"))
                if sin_sched is None or sout_sched is None:
                    continue
                # synthesize one shift
                sin_dt = minute_to_datetimetetime(date_base, sin_sched)
                sout_dt = minute_to_datetimetetime(date_base, sout_sched)
                if sin_dt >= sout_dt:
                    continue
                shift_intervals = [Interval(sin_dt, sout_dt)]
            else:
                continue

        # シフト（出勤n～退勤n）を列挙
        shift_intervals: List[Interval] = []
        for i in range(1, 11):
            sin = parse_minute_of_day(row.get(f"出勤{i}"))
            sout = parse_minute_of_day(row.get(f"退勤{i}"))
            if sin is None or sout is None:
                continue
            sin_dt = minute_to_datetimetetime(date_base, sin)
            sout_dt = minute_to_datetimetetime(date_base, sout)
            if sin_dt >= sout_dt:
                # 同刻 or 逆順はスキップ
                continue
            shift_intervals.append(Interval(sin_dt, sout_dt))

        if not shift_intervals:
            continue

        # 休憩を差し引く
        break_intervals: List[Interval] = []
        for j in range(1, 11):
            bstart = parse_minute_of_day(row.get(f"休憩{j}"))
            bend = parse_minute_of_day(row.get(f"復帰{j}"))
            if bstart is None or bend is None:
                continue
            bstart_dt = minute_to_datetimetetime(date_base, bstart)
            bend_dt = minute_to_datetimetetime(date_base, bend)
            if bstart_dt >= bend_dt:
                continue
            break_intervals.append(Interval(bstart_dt, bend_dt))

        # シフトから休憩を引いて労働区間へ
        work_segments: List[Interval] = []
        for sh in shift_intervals:
            work_segments.extend(subtract_many(sh, break_intervals))

        if work_segments:
            name_to_intervals.setdefault(name, []).extend(work_segments)

    # 後処理：各人の区間をソート＆マージ（隣接/重複を結合）
    for name, ivs in list(name_to_intervals.items()):
        ivs.sort(key=lambda x: (x.start, x.end))
        merged: List[Interval] = []
        for iv in ivs:
            if not merged:
                merged.append(iv)
            else:
                last = merged[-1]
                if iv.start <= last.end:  # 隣接/重複
                    merged[-1] = Interval(last.start, max(last.end, iv.end))
                else:
                    merged.append(iv)
        name_to_intervals[name] = merged


    # name index for pretty output (normalized -> list of originals seen)
    name_index: Dict[str, List[str]] = {}
    for _, row in att_df.iterrows():
        raw_name = row.get(name_col)
        key = normalize_name(raw_name)
        if key:
            name_index.setdefault(key, [])
            if str(raw_name) not in name_index[key]:
                name_index[key].append(str(raw_name))
    return name_to_intervals, name_index


def build_service_records(path: Path, df: pd.DataFrame, facility_name: str, staff_col: str = SERVICE_STAFF_COL) -> pd.DataFrame:
    """
    サービスCSVから比較用の補助列（施設、開始DT、終了DT、担当所員（正規化））を付与して返す。
    終了が開始より小さい（=日跨ぎ）の場合は翌日扱いにする。
    """
    for col in [SERVICE_DATE_COL, SERVICE_START_COL, SERVICE_END_COL, staff_col]:
        if col not in df.columns:
            raise RuntimeError(f"{path.name} に必要列が不足しています: {col}")

    out = df.copy()
    out["施設"] = facility_name

    # 文字列時間を分に
    starts = df[SERVICE_START_COL].astype(str).map(parse_minute_of_day)
    ends = df[SERVICE_END_COL].astype(str).map(parse_minute_of_day)
    dates = df[SERVICE_DATE_COL].map(parse_date_any)

    start_dt: List[datetime] = []
    end_dt: List[datetime] = []
    for st_min, ed_min, base in zip(starts, ends, dates):
        if st_min is None or ed_min is None:
            start_dt.append(None)
            end_dt.append(None)
            continue
        st = minute_to_datetimetetime(base, st_min)
        ed = minute_to_datetimetetime(base, ed_min)
        # サービス終了が開始より小さい場合（例: 23:30→00:30）は翌日へ
        if ed < st:
            ed = ed + timedelta(days=1)
        start_dt.append(st)
        end_dt.append(ed)

    out["_開始DT"] = start_dt
    out["_終了DT"] = end_dt
    out["_担当所員"] = out[staff_col].astype(str).str.strip()
    out["_担当所員_norm"] = out["_担当所員"].map(normalize_name)

    return out

def interval_fully_covered(target: Interval, covers: List[Interval]) -> bool:
    """
    既存の関数（互換性維持）
    内部的にanalyze_coverage_detailsを使用
    """
    coverage_info = analyze_coverage_details(target, covers, "")
    return coverage_info.is_fully_covered

def find_overlaps(df1: pd.DataFrame, df2: pd.DataFrame) -> List[Tuple[int, int]]:
    """
    既存の関数（互換性維持）
    内部的にfind_overlaps_with_detailsを使用
    """
    facility1 = "facility1"  # ダミー値
    facility2 = "facility2"  # ダミー値
    detailed_overlaps = find_overlaps_with_details(df1, df2, facility1, facility2)
    return [(overlap.idx1, overlap.idx2) for overlap in detailed_overlaps]

def decide_flag_target(row1: pd.Series, row2: pd.Series, prefer_identical: str = 'earlier') -> int:
    """
    どちらにフラグを立てるかを決定して、1 または 2 を返す。
    ルール：
      1) 開始/終了が完全一致→ 施設名の昇順で早い方にフラグ
      2) そうでない→ 実施時間の短い方にフラグ
      3) 実施時間が同じ→ 施設名の昇順で早い方にフラグ
    """
    iv1 = Interval(row1["_開始DT"], row1["_終了DT"])
    iv2 = Interval(row2["_開始DT"], row2["_終了DT"])
    fac1 = str(row1["施設"])
    fac2 = str(row2["施設"])

    if iv1.is_equal(iv2):
        # prefer_identical: 'earlier' or 'later'
        if prefer_identical == 'later':
            return 1 if fac1 > fac2 else 2
        return 1 if fac1 < fac2 else 2
    d1 = iv1.duration_minutes()
    d2 = iv2.duration_minutes()
    if d1 != d2:
        return 1 if d1 < d2 else 2
    return 1 if fac1 < fac2 else 2

def build_staff_busy_map(service_dfs: Dict[str, pd.DataFrame]) -> Dict[str, List[Interval]]:
    """
    すべての施設のサービス提供区間を従業員ごとにまとめる（他施設の繁忙判定用）
    """
    busy: Dict[str, List[Interval]] = {}
    for fac, df in service_dfs.items():
        for _, r in df.iterrows():
            if pd.isna(r["_開始DT"]) or pd.isna(r["_終了DT"]):
                continue
            staff = r["_担当所員_norm"]
            busy.setdefault(staff, []).append(Interval(r["_開始DT"], r["_終了DT"]))
    # マージ
    for staff, ivs in list(busy.items()):
        ivs.sort(key=lambda x: (x.start, x.end))
        merged: List[Interval] = []
        for iv in ivs:
            if not merged:
                merged.append(iv)
            else:
                last = merged[-1]
                if iv.start <= last.end:
                    merged[-1] = Interval(last.start, max(last.end, iv.end))
                else:
                    merged.append(iv)
        busy[staff] = merged
    return busy

def list_available_staff(target: Interval, att_map: Dict[str, List[Interval]], busy_map: Dict[str, List[Interval]], exclude: str, att_name_index: Optional[Dict[str, List[str]]] = None) -> List[str]:
    """
    指定区間 target において、
      - 勤怠的に target を丸ごとカバーしている
      - かつ他施設含むサービス提供で当該時間に重複していない
      - かつ exclude（現在担当者）ではない
    人の名前一覧（昇順）を返す。
    """
    candidates: List[str] = []
    for name, work_ivs in att_map.items():
        if name == exclude:
            continue
        if not interval_fully_covered(target, work_ivs):
            continue
        # 忙しさチェック（重複が無いこと）
        conflict = False
        for busy_iv in busy_map.get(name, []):
            if target.overlaps(busy_iv):
                conflict = True
                break
        if not conflict:
            # pretty name: first seen original for this normalized key
            if att_name_index and name in att_name_index and att_name_index[name]:
                candidates.append(att_name_index[name][0])
            else:
                candidates.append(name)

    # Filter out normalized keys accidentally: keep only 'pretty' if present (non-ASCII letters likely)
    # Here we just unique while preserving order
    seen=set(); ordered=[]
    for x in candidates:
        if x not in seen:
            seen.add(x); ordered.append(x)
    return ordered

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
    
    # サービス実態の日付に該当する勤務区間のみを抽出
    target_date = target.start.date()
    relevant_covers = []
    for iv in covers:
        # 勤務区間の日付がサービス実態の日付と一致するか、
        # または深夜跨ぎでサービス実態の日付に重複する場合のみ含める
        work_date = iv.start.date()
        work_end_date = iv.end.date()
        
        if (work_date == target_date or
            work_end_date == target_date or
            (work_date < target_date < work_end_date)):
            relevant_covers.append(iv)
    
    # 該当する勤務区間の文字列表現を作成
    work_intervals = [f"{iv.start.strftime('%H:%M')}-{iv.end.strftime('%H:%M')}" for iv in relevant_covers]
    
    # カバー計算には該当する勤務区間のみを使用
    covers = relevant_covers
    
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
    
    current_types = str(df.at[idx, '重複タイプ'] or "")
    types = [t.strip() for t in current_types.split("，") if t.strip()]
    if overlap_info.overlap_type not in types:
        types.append(overlap_info.overlap_type)
    df.at[idx, '重複タイプ'] = "，".join(sorted(types))

def get_representative_work_patterns(work_ivs: List[Interval]) -> List[str]:
    """実際の勤務区間をそのまま文字列として返す（重複除去のみ）"""
    if not work_ivs:
        return []
    
    # 実際の勤務区間を文字列に変換
    interval_strings = []
    for iv in work_ivs:
        start_str = f"{iv.start.hour:02d}:{iv.start.minute:02d}"
        end_str = f"{iv.end.hour:02d}:{iv.end.minute:02d}"
        interval_strings.append(f"{start_str}-{end_str}")
    
    # 重複を除去してユニークな時間帯のみ保持
    unique_intervals = list(dict.fromkeys(interval_strings))
    
    # 時間順にソート
    def parse_time(interval_str):
        start_time = interval_str.split('-')[0]
        hour, minute = map(int, start_time.split(':'))
        return hour * 60 + minute
    
    unique_intervals.sort(key=parse_time)
    return unique_intervals

def get_unique_work_intervals(work_ivs: List[Interval]) -> List[str]:
    """勤務区間から代表的な勤務パターンを抽出（簡略化版）"""
    return get_representative_work_patterns(work_ivs)

def update_coverage_details_in_csv(df: pd.DataFrame, idx: int, coverage_info: CoverageInfo, staff_name: str = "", att_map: Dict = None):
    """CSVのカバー詳細カラムを更新"""
    df.at[idx, '超過時間（分）'] = coverage_info.uncovered_minutes
    df.at[idx, 'カバー状況'] = coverage_info.coverage_status
    df.at[idx, '勤務区間数'] = coverage_info.work_interval_count
    
    # エラー職員の勤務時間詳細（重複除去）
    if coverage_info.work_intervals:
        # 既存のwork_intervalsは文字列のリストなので、そのまま重複除去
        unique_intervals = list(dict.fromkeys(coverage_info.work_intervals))
        df.at[idx, 'エラー職員勤務時間'] = f"{staff_name}: {' , '.join(unique_intervals)}"
    else:
        df.at[idx, 'エラー職員勤務時間'] = f"{staff_name}: 勤務時間なし"
    
    # 代替職員の勤務時間詳細を追加（日付フィルタリング付き）
    alt_staff_list = df.at[idx, ALT_COL] if ALT_COL in df.columns else ""
    if alt_staff_list and alt_staff_list != "ー" and att_map:
        alt_staff_details = []
        alt_staff_names = [name.strip() for name in alt_staff_list.split('/') if name.strip()]
        
        # サービス実態の日付を取得（エラー職員と同じ日付フィルタリングを適用）
        service_start = df.at[idx, '_開始DT'] if '_開始DT' in df.columns else None
        target_date = service_start.date() if service_start else None
        
        for i, alt_staff in enumerate(alt_staff_names, 1):
            # 正規化された名前で勤務時間を検索
            alt_staff_norm = normalize_name(alt_staff)
            alt_work_ivs = att_map.get(alt_staff_norm, [])
            
            if alt_work_ivs and target_date:
                # サービス実態の日付に該当する勤務区間のみを抽出
                relevant_alt_covers = []
                for iv in alt_work_ivs:
                    work_date = iv.start.date()
                    work_end_date = iv.end.date()
                    
                    if (work_date == target_date or
                        work_end_date == target_date or
                        (work_date < target_date < work_end_date)):
                        relevant_alt_covers.append(iv)
                
                if relevant_alt_covers:
                    # 該当する勤務区間の文字列表現を作成
                    alt_intervals = [f"{iv.start.strftime('%H:%M')}-{iv.end.strftime('%H:%M')}" for iv in relevant_alt_covers]
                    unique_alt_intervals = list(dict.fromkeys(alt_intervals))  # 重複除去
                    alt_staff_details.append(f"提案者{i:02d}({alt_staff}): {' , '.join(unique_alt_intervals)}")
                else:
                    alt_staff_details.append(f"提案者{i:02d}({alt_staff}): 該当日勤務なし")
            else:
                alt_staff_details.append(f"提案者{i:02d}({alt_staff}): 勤務時間なし")
        
        df.at[idx, '代替職員勤務時間'] = " | ".join(alt_staff_details)
    else:
        df.at[idx, '代替職員勤務時間'] = "代替職員なし"
    
    # 従来の詳細情報も保持（重複除去）
    unique_work_intervals = list(dict.fromkeys(coverage_info.work_intervals)) if coverage_info.work_intervals else []
    df.at[idx, '勤務時間詳細'] = " | ".join(unique_work_intervals) if unique_work_intervals else "勤務時間なし"
    df.at[idx, 'カバー済み区間'] = " | ".join(coverage_info.covered_intervals) if coverage_info.covered_intervals else "なし"
    df.at[idx, '未カバー区間'] = " | ".join(coverage_info.uncovered_intervals) if coverage_info.uncovered_intervals else "なし"
    
    # 勤務時間外の詳細説明を追加
    if not coverage_info.is_fully_covered:
        if unique_work_intervals:
            work_detail = f"勤務時間: {' | '.join(unique_work_intervals)}"
            if coverage_info.uncovered_intervals:
                work_detail += f" → 未カバー: {' | '.join(coverage_info.uncovered_intervals)}"
        else:
            work_detail = "勤務時間外（勤務データなし）"
        df.at[idx, '勤務時間外詳細'] = work_detail
    else:
        df.at[idx, '勤務時間外詳細'] = "勤務時間内"

def generate_detail_id(facility: str, row_index: int) -> str:
    """詳細情報参照用IDを生成"""
    import time
    facility_code = facility.replace('サービス実態', '')  # A, B, C等を抽出
    return f"{facility_code}_{row_index:03d}_{int(time.time()) % 1000:03d}"


def process(input_dir: Path, prefer_identical: str = 'earlier', alt_delim: str = '/', service_staff_col: str = SERVICE_STAFF_COL, att_name_col: str = ATT_NAME_COL, write_diagnostics: bool = True, use_schedule_when_missing: bool = False, attendance_file: Optional[str] = None) -> None:
    # ファイル探索
    service_files: List[Path] = []
    att_file: Optional[Path] = None
    
    print(f"DEBUG: 入力ディレクトリ: {input_dir}")
    print(f"DEBUG: 指定された勤怠履歴ファイル: {attendance_file}")
    
    # 勤怠履歴CSVファイルが明示的に指定されている場合
    if attendance_file:
        att_file = input_dir / attendance_file
        print(f"DEBUG: 勤怠履歴CSVファイルパス: {att_file}")
        if not att_file.exists():
            print(f"DEBUG: 勤怠履歴CSVファイルが存在しません: {att_file}")
            raise SystemExit(f"指定された勤怠履歴CSVが見つかりません: {att_file}")
        else:
            print(f"DEBUG: 勤怠履歴CSVファイルを確認: {att_file} (存在: {att_file.exists()})")
    
    print(f"DEBUG: ディレクトリ内のCSVファイル一覧:")
    for p in input_dir.glob("*.csv"):
        print(f"DEBUG:   - {p.name} (サイズ: {p.stat().st_size} bytes)")
    
    # 大文字小文字を区別しないCSVファイル検索
    for p in input_dir.glob("*.[Cc][Ss][Vv]"):
        name = p.name
        print(f"DEBUG: 処理中のファイル: {name}")
        
        if name.startswith("result_") or name.startswith("_result_"):
            # 出力 or 想定解は無視
            print(f"DEBUG:   -> 結果ファイルのためスキップ")
            continue
        
        # 勤怠履歴CSVファイルが明示的に指定されている場合はスキップ
        if attendance_file and name == attendance_file:
            print(f"DEBUG:   -> 勤怠履歴CSVファイルのためスキップ")
            continue
        
        # 勤怠履歴CSVファイルが明示的に指定されていない場合の自動検出
        if not attendance_file and ("勤怠" in name or "チェック" in name or "attendance" in name.lower()):
            att_file = p
            print(f"DEBUG:   -> 勤怠履歴CSVファイルとして自動検出")
        elif not (attendance_file and name == attendance_file):
            # 勤怠履歴CSVファイル以外はサービス実態CSVとして扱う
            service_files.append(p)
            print(f"DEBUG:   -> サービス実態CSVファイルとして追加")

    print(f"DEBUG: 検出されたサービス実態CSVファイル数: {len(service_files)}")
    for i, sf in enumerate(service_files):
        print(f"DEBUG:   {i+1}. {sf.name}")
    
    print(f"DEBUG: 検出された勤怠履歴CSVファイル: {att_file.name if att_file else 'なし'}")

    if not service_files:
        print("DEBUG: エラー - サービス実態CSVファイルが見つかりません")
        raise SystemExit("施設のサービス実態CSVが見つかりません。")
    if not att_file:
        print("DEBUG: エラー - 勤怠履歴CSVファイルが見つかりません")
        raise SystemExit("勤怠履歴CSVが見つかりません。")

    # 勤怠ロード＆インターバル化
    att_df = pd.read_csv(att_file, encoding=ENCODING)
    att_map, att_name_index = build_work_intervals(att_df, name_col=att_name_col, use_schedule_when_missing=use_schedule_when_missing)

    # 施設ごとのデータロード＆インターバル化
    service_raw: Dict[str, pd.DataFrame] = {}
    for sf in service_files:
        fac = sf.stem  # 例: サービス実態A
        df = pd.read_csv(sf, encoding=ENCODING)
        service_raw[fac] = build_service_records(sf, df, fac, staff_col=service_staff_col)

    # 1) 施設間重複の検出（ペアごと）
    # フラグ列の初期化
    for fac, df in service_raw.items():
        if ERR_COL not in df.columns:
            df.insert(0, ALT_COL, "")
            df.insert(0, CAT_COL, "")
            df.insert(0, ERR_COL, "")
        else:
            # 既存列がある場合の上書き
            df[ERR_COL] = ""
            df[CAT_COL] = ""
            df[ALT_COL] = ""
        
        # 新規詳細カラムの初期化
        detail_columns = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者',
                         '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID', '勤務時間詳細',
                         'カバー済み区間', '未カバー区間', '勤務時間外詳細']
        
        for col in detail_columns:
            if col not in df.columns:
                df.insert(len([ERR_COL, CAT_COL, ALT_COL]), col, "")
            else:
                df[col] = ""

    facilities = sorted(service_raw.keys())  # 昇順比較ルールに整合
    flagged_indices: Dict[str, set] = {fac: set() for fac in facilities}

    for i in range(len(facilities)):
        for j in range(i+1, len(facilities)):
            f1, f2 = facilities[i], facilities[j]
            df1, df2 = service_raw[f1], service_raw[f2]

            # 詳細情報付きの重複検出
            overlap_infos = find_overlaps_with_details(df1, df2, f1, f2)
            
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

    # フラグ付け（施設間重複）
    for fac, df in service_raw.items():
        if flagged_indices[fac]:
            df.loc[list(flagged_indices[fac]), ERR_COL] = FLAG
            df.loc[list(flagged_indices[fac]), CAT_COL] = "施設間重複"

    # 1.5) 事業所内重複の検出（同一施設内での重複）
    for fac, df in service_raw.items():
        # 詳細情報付きの同一施設内重複検出
        internal_overlaps = find_overlaps_with_details(df, df, fac, fac)
        # 自分自身との比較は除外
        internal_overlaps = [overlap for overlap in internal_overlaps if overlap.idx1 != overlap.idx2]
        
        # 重複ペアを処理（同じペアを2回処理しないよう注意）
        processed_pairs = set()
        for overlap_info in internal_overlaps:
            idx1, idx2 = overlap_info.idx1, overlap_info.idx2
            pair = tuple(sorted([idx1, idx2]))
            if pair in processed_pairs:
                continue
            processed_pairs.add(pair)
            
            r1 = df.loc[idx1]
            r2 = df.loc[idx2]
            
            # 同一担当者の確認
            if r1["_担当所員_norm"] != r2["_担当所員_norm"]:
                continue
                
            # どちらにフラグを立てるか決定
            tgt = decide_flag_target(r1, r2, prefer_identical=prefer_identical)
            target_idx = idx1 if tgt == 1 else idx2
            
            # 既にエラーフラグが立っている場合はカテゴリを追記
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

    # 2) 施設間重複・事業所内重複の補正案（代替職員リスト）
    busy_map = build_staff_busy_map(service_raw)
    for fac, df in service_raw.items():
        # 施設間重複または事業所内重複のレコードを対象
        need_rows = df[df[CAT_COL].str.contains("重複", na=False)]
        for idx, r in need_rows.iterrows():
            iv = Interval(r["_開始DT"], r["_終了DT"])
            staff = r["_担当所員_norm"]
            alts = list_available_staff(iv, att_map, busy_map, exclude=staff, att_name_index=att_name_index)
            df.at[idx, ALT_COL] = alt_delim.join(alts) if alts else "ー"

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
            
            # CSVカラムに詳細情報を設定
            update_coverage_details_in_csv(df, idx, coverage_info, staff, att_map)
            
            if not coverage_info.is_fully_covered:
                # 既にエラーが付いている場合はカテゴリを追記（カンマ連結）
                if df.at[idx, ERR_COL] != FLAG:
                    df.at[idx, ERR_COL] = FLAG
                    df.at[idx, CAT_COL] = "勤怠履歴超過"
                else:
                    cat = df.at[idx, CAT_COL]
                    parts = [c for c in [cat, "勤怠履歴超過"] if c]
                    df.at[idx, CAT_COL] = "，".join(sorted(set(parts)))

    # 4) 勤怠履歴超過の補正案
    busy_map = build_staff_busy_map(service_raw)  # 施設間重複フラグで除外…はせず、現状のまま
    for fac, df in service_raw.items():
        need_rows = df[df[CAT_COL].str.contains("勤怠履歴超過", na=False)]
        for idx, r in need_rows.iterrows():
            iv = Interval(r["_開始DT"], r["_終了DT"])
            staff = r["_担当所員_norm"]
            alts = list_available_staff(iv, att_map, busy_map, exclude=staff, att_name_index=att_name_index)
            # 既存代替リストがあれば統合（施設間重複と両方のケース）
            if alts:
                new = alt_delim.join(alts)
            else:
                new = "ー"
            prev = str(df.at[idx, ALT_COL] or "").strip()
            if prev and prev != "ー":
                # すでにある候補と結合してユニーク化
                merged = sorted(set([p for p in prev.split("/") if p] + alts))
                df.at[idx, ALT_COL] = "/".join(merged) if merged else "ー"
            else:
                df.at[idx, ALT_COL] = new


    if write_diagnostics:
        diag_dir = input_dir / "diagnostics"
        diag_dir.mkdir(exist_ok=True)
        # 01: staff name coverage between services and attendance (normalized)
        svc_names = []
        for fac, df in service_raw.items():
            for n in df["_担当所員_norm"].dropna().unique().tolist():
                svc_names.append({"施設": fac, "担当所員_norm": n})
        # also include raw names for auditing
        svc_raw = []
        for fac, df in service_raw.items():
            for n in df["_担当所員"].dropna().unique().tolist():
                svc_raw.append({"施設": fac, "担当所員_raw": str(n), "担当所員_norm": normalize_name(n)})
        if svc_raw:
            pd.DataFrame(svc_raw).to_csv(diag_dir / "01_staff_name_raw_and_norm.csv", index=False, encoding="utf-8-sig")
        svc_cov = pd.DataFrame(svc_names)
        if not svc_cov.empty:
            svc_cov["勤怠に存在"] = svc_cov["担当所員_norm"].apply(lambda k: "YES" if k in att_map else "NO")
            svc_cov.to_csv(diag_dir / "01_staff_name_coverage.csv", index=False, encoding="utf-8-sig")

        # 02: attendance summary per staff (counts)
        att_rows = []
        for k, ivs in att_map.items():
            att_rows.append({"担当所員_norm": k, "勤務区間数": len(ivs), "総分": sum(i.duration_minutes() for i in ivs)})
        pd.DataFrame(att_rows).to_csv(diag_dir / "02_attendance_summary.csv", index=False, encoding="utf-8-sig")

        # 03: per-facility service detail with reason
        for fac, df in service_raw.items():
            det = []
            for idx, r in df.iterrows():
                if pd.isna(r["_開始DT"]) or pd.isna(r["_終了DT"]):
                    reason = "INVALID_TIME"
                    covered = False
                    has_att = r["_担当所員_norm"] in att_map
                else:
                    staff_key = r["_担当所員_norm"]
                    work_ivs = att_map.get(staff_key, [])
                    has_att = len(work_ivs) > 0
                    covered = interval_fully_covered(Interval(r["_開始DT"], r["_終了DT"]), work_ivs) if has_att else False
                    reason = "OK" if covered else ("STAFF_NOT_FOUND_IN_ATT" if not has_att else "NOT_FULLY_COVERED")
                det.append({
                    "index": idx,
                    "担当所員": r["_担当所員"],
                    "担当所員_norm": r["_担当所員_norm"],
                    "西暦日付": r[SERVICE_DATE_COL],
                    "開始時間": r[SERVICE_START_COL],
                    "終了時間": r[SERVICE_END_COL],
                    "勤怠あり": "YES" if has_att else "NO",
                    "完全包含": "YES" if covered else "NO",
                    "理由": reason,
                })
            pd.DataFrame(det).to_csv(diag_dir / f"03_service_detail_{fac}.csv", index=False, encoding="utf-8-sig")

    # 5) 詳細IDの生成と出力（先頭3列 + 詳細8列 + 元データ）
    for fac, df in service_raw.items():
        # 詳細IDの生成
        for idx in df.index:
            detail_id = generate_detail_id(fac, idx)
            df.at[idx, '詳細ID'] = detail_id
        
        # 内部列は落としてから出力
        out_df = df.copy()
        for c in ["_開始DT","_終了DT","_担当所員","施設"]:
            if c in out_df.columns:
                out_df.drop(columns=[c], inplace=True)

        # カラムの並び順を調整（基本3列 + 詳細8列 + その他）
        base_cols = [ERR_COL, CAT_COL, ALT_COL]
        detail_cols = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者',
                      '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID', '勤務時間詳細',
                      'カバー済み区間', '未カバー区間', '勤務時間外詳細']
        other_cols = [c for c in out_df.columns if c not in base_cols + detail_cols]
        cols = base_cols + detail_cols + other_cols
        out_df = out_df[cols]

        out_path = input_dir / f"result_{fac}.csv"
        # 詳細カラムに日本語が含まれるため、UTF-8で出力
        try:
            out_df.to_csv(out_path, index=False, encoding=ENCODING)
        except UnicodeEncodeError:
            # cp932でエンコードできない場合はUTF-8で出力
            out_df.to_csv(out_path, index=False, encoding="utf-8-sig")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", type=str, default="/input", help="サービス実態CSV群と勤怠履歴.csvがあるフォルダ")
    ap.add_argument("--attendance-file", type=str, help="勤怠履歴CSVファイル名を明示的に指定")
    ap.add_argument("--use-schedule-when-missing", action="store_true", help="実打刻(出勤1)が欠損のときに出勤予定時刻/退勤予定時刻で代用する")
    ap.add_argument("--identical-prefer", choices=["earlier","later"], default="earlier", help="開始/終了が完全一致のとき、どちらにフラグを立てるか（施設名の昇順で earlier/later）")
    ap.add_argument("--alt-delim", type=str, default="/", help="代替職員リストの区切り文字（例: '/' または ', '）")
    ap.add_argument("--service-staff-col", type=str, default="担当所員", help="サービス実態の従業員列名（既定: 担当所員）")
    ap.add_argument("--att-name-col", type=str, default="名前", help="勤怠の従業員列名（既定: 名前）")
    ap.add_argument("--no-diagnostics", action="store_true", help="診断CSVの出力を抑止する")
    args = ap.parse_args()
    input_dir = Path(args.input)
    if not input_dir.exists():
        raise SystemExit(f"入力ディレクトリが存在しません: {input_dir}")

    process(input_dir, prefer_identical=args.identical_prefer, alt_delim=args.alt_delim, service_staff_col=args.service_staff_col, att_name_col=args.att_name_col, write_diagnostics=(not args.no_diagnostics), use_schedule_when_missing=args.use_schedule_when_missing, attendance_file=args.attendance_file)

if __name__ == "__main__":
    main()

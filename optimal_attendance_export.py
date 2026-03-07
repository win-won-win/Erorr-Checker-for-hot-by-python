#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最適勤怠データ出力機能
jinjer形式CSV（194列）を出力する
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import io
import random
from typing import List, Dict, Any, Optional, Tuple
import calendar
import re
from src import normalize_name, parse_date_any, parse_minute_of_day
import os
import glob
from pathlib import Path
import base64
import gzip
import logging


def find_default_attendance_csv() -> Optional[Path]:
    """リポジトリ/カレントディレクトリ配下から勤怠履歴.csvを探索"""
    candidates = [
        Path(__file__).resolve().parent / "input" / "勤怠履歴.csv",
        Path.cwd() / "input" / "勤怠履歴.csv",
    ]
    seen = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except FileNotFoundError:
            resolved = candidate
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.exists():
            return resolved
    return None


BUILTIN_ATTENDANCE_CSV_BASE64 = (
    "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"
)


def _read_attendance_csv(path: Path) -> Optional[pd.DataFrame]:
    """複数エンコーディングを試して勤怠CSVを読み込む"""
    encodings = ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']
    for encoding in encodings:
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    return None


def build_builtin_attendance_dataframe() -> pd.DataFrame:
    """組み込みの勤怠データCSVを読み込んでDataFrameを返す"""
    raw_bytes = gzip.decompress(base64.b64decode(BUILTIN_ATTENDANCE_CSV_BASE64))
    buffer = io.BytesIO(raw_bytes)
    return pd.read_csv(buffer, encoding='cp932')


def get_builtin_attendance_csv_bytes(encoding: str = 'shift_jis') -> bytes:
    """組み込み勤怠データを指定エンコードのCSVバイト列として取得"""
    raw_bytes = gzip.decompress(base64.b64decode(BUILTIN_ATTENDANCE_CSV_BASE64))
    if encoding.lower() in ('cp932', 'shift_jis', 'shift-jis'):  # 元データはCP932
        return raw_bytes
    df = pd.read_csv(io.BytesIO(raw_bytes), encoding='cp932')
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue().encode(encoding, errors='ignore')

def create_jinjer_headers() -> List[str]:
    """jinjer形式CSVのヘッダー（194列）を生成"""
    headers = []
    
    # 基本情報（5列）
    headers.extend([
        '名前', '*従業員ID', '*年月日', '*打刻グループID', '所属グループ名'
    ])
    
    # スケジュール情報（15列）
    headers.extend([
        'スケジュール雛形ID', '出勤予定時刻', '退勤予定時刻',
        '休憩予定時刻1', '復帰予定時刻1', '休憩予定時刻2', '復帰予定時刻2',
        '休憩予定時刻3', '復帰予定時刻3', '休憩予定時刻4', '復帰予定時刻4',
        '休憩予定時刻5', '復帰予定時刻5',
        'スケジュール外休憩予定時刻', 'スケジュール外復帰予定時刻'
    ])
    
    # 休日設定（1列）
    headers.extend([
        '休日（0:法定休日1:所定休日2:法休(振替休出)3:所休(振替休出)4:法休(時間外休出)5:所休(時間外休出)）'
    ])
    
    # 実際の出退勤時刻（20列）- 最大10シフト対応
    headers.extend([
        '出勤1', '退勤1', '出勤2', '退勤2', '出勤3', '退勤3', '出勤4', '退勤4', '出勤5', '退勤5',
        '出勤6', '退勤6', '出勤7', '退勤7', '出勤8', '退勤8', '出勤9', '退勤9', '出勤10', '退勤10'
    ])
    
    # 実際の休憩時刻（20列）- 最大10回休憩対応
    headers.extend([
        '休憩1', '復帰1', '休憩2', '復帰2', '休憩3', '復帰3', '休憩4', '復帰4', '休憩5', '復帰5',
        '休憩6', '復帰6', '休憩7', '復帰7', '休憩8', '復帰8', '休憩9', '復帰9', '休憩10', '復帰10'
    ])
    
    # 食事時間（4列）
    headers.extend([
        '食事1開始', '食事1終了', '食事2開始', '食事2終了'
    ])
    
    # 外出・再入（20列）- 最大10回外出対応
    headers.extend([
        '外出1', '再入1', '外出2', '再入2', '外出3', '再入3', '外出4', '再入4', '外出5', '再入5',
        '外出6', '再入6', '外出7', '再入7', '外出8', '再入8', '外出9', '再入9', '外出10', '再入10'
    ])
    
    # 休日休暇（10列）
    headers.extend([
        '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
        '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由'
    ])
    
    # 管理情報（7列）
    headers.extend([
        '打刻時コメント', '管理者備考',
        '勤務状況（0:未打刻1:欠勤）', '遅刻取消処理の有無（0:無1:有）', '早退取消処理の有無（0:無1:有）',
        '遅刻（0:有1:無）', '早退（0:有1:無）'
    ])
    
    # 直行・直帰（20列）- 最大10シフト対応
    headers.extend([
        '直行1', '直帰1', '直行2', '直帰2', '直行3', '直帰3', '直行4', '直帰4', '直行5', '直帰5',
        '直行6', '直帰6', '直行7', '直帰7', '直行8', '直帰8', '直行9', '直帰9', '直行10', '直帰10'
    ])
    
    # 打刻区分ID（50列）
    for i in range(1, 51):
        headers.append(f'打刻区分ID:{i}')
    
    # 勤務状況フラグ（5列）
    headers.extend(['未打刻', '欠勤', '休日打刻', '休暇打刻', '実績確定状況'])
    
    # 労働時間計算（13列）
    headers.extend([
        '総労働時間', '実労働時間', '休憩時間', '総残業時間',
        '法定内残業時間（スケジュール軸）', '法定内残業時間（労働時間軸）', '法定外残業時間', '深夜時間',
        '不足労働時間数（スケジュール軸）', '不足労働時間数（労働時間軸）',
        '申請承認済総残業時間', '申請承認済法定内残業時間', '申請承認済法定外残業時間'
    ])
    
    # 乖離時間（4列）
    headers.extend([
        '出勤乖離時間（出勤時刻ー入館時刻）', '退勤乖離時間（退館時刻ー退勤時刻）',
        '出勤乖離時間（出勤時刻ーPC起動時刻）', '退勤乖離時間（PC停止時刻ー退勤時刻）'
    ])
    
    return headers


def dataframe_to_jinjer_csv_bytes(
    df: pd.DataFrame,
    encoding: str = 'shift_jis',
    column_order: Optional[List[str]] = None
) -> bytes:
    """
    DataFrameをjinjer形式のヘッダー順に並べ替えてCSVバイト列に変換する。
    指定ヘッダーに含まれない列は削除し、欠損は空文字で埋める。
    
    Args:
        df: CSVに変換するDataFrame。
        encoding: 出力時に使用するエンコーディング。
        column_order: 列順を固定したい場合に使用する列名リスト。
                      未指定の場合はjinjer標準ヘッダー順を使用する。
    """
    normalized_df = df.copy()
    # 出力対象外の列を除外
    drop_targets = [col for col in EXCLUDED_OUTPUT_COLUMNS if col in normalized_df.columns]
    if drop_targets:
        normalized_df = normalized_df.drop(columns=drop_targets)
    
    headers = column_order or create_jinjer_headers()
    headers = [col for col in headers if col not in EXCLUDED_OUTPUT_COLUMNS]
    normalized_df = normalized_df.reindex(columns=headers, fill_value='')
    
    # 指定の列は強制的にブランクにする
    for col in FORCED_EMPTY_COLUMNS:
        if col in normalized_df.columns:
            normalized_df[col] = ''
    
    normalized_df = normalized_df.fillna('')
    
    buffer = io.StringIO()
    normalized_df.to_csv(buffer, index=False)
    return buffer.getvalue().encode(encoding, errors='ignore')

def time_to_minutes(time_str: str, is_end_time: bool = False, reference_start: Optional[str] = None) -> int:
    """時間を分に変換（24時間対応）"""
    if not time_str or time_str == '':
        return 0

    if time_str == '24:00' or (time_str == '0:00' and is_end_time):
        return 24 * 60  # 1440分

    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        total = hours * 60 + minutes

        if is_end_time and reference_start:
            start_minutes = time_to_minutes(reference_start, False)
            if total < start_minutes:
                total += 24 * 60

        return total
    except:
        return 0

def minutes_to_time(minutes: int) -> str:
    """分を時:分形式に変換"""
    if minutes >= 24 * 60:
        return '24:00'
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}:{mins:02d}"


def minutes_to_time_overflow(minutes: int) -> str:
    """24時超えを許容した時刻文字列に変換"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}:{mins:02d}"

def debug_log(message: str) -> None:
    """デバッグ出力を抑止"""
    return

def format_time_for_csv(time_str: str, is_end_time: bool = False, reference_start: Optional[str] = None) -> str:
    """CSV出力用の時間フォーマット"""
    if not time_str or time_str == '':
        return ''

    if not is_end_time or not reference_start:
        return time_str

    end_str = str(time_str).strip()
    start_min = time_to_minutes(reference_start, False)
    end_min = time_to_minutes(end_str, True, reference_start)

    if end_min >= 24 * 60:
        return minutes_to_time_overflow(end_min)

    if end_str in ('0:00', '00:00'):
        return '24:00'

    return end_str

# 追加調整ルール用の定数（分）
DAY_WINDOW_START = 8 * 60   # 08:00
DAY_WINDOW_END = 18 * 60    # 18:00
MIN_DAILY_MINUTES = 9 * 60
MAX_DAILY_MINUTES = 10 * 60
MONTH_MINUTES_TARGET = 160 * 60
COUNTED_DAILY_CAP = 8 * 60

def _shift_minutes(shift: Dict) -> Tuple[int, int]:
    start = time_to_minutes(shift.get('work_start', ''))
    end = time_to_minutes(shift.get('work_end', ''), True, shift.get('work_start', ''))
    return start, end

def _total_minutes(shifts: List[Dict]) -> int:
    total = 0
    for shift in shifts:
        start, end = _shift_minutes(shift)
        total += max(0, end - start)
    return total

def _counted_minutes(shifts: List[Dict]) -> int:
    """月合計集計用（1日最大8時間）"""
    return min(_total_minutes(shifts), COUNTED_DAILY_CAP)

def _normalize_day_shifts(day_shifts: List[Tuple[int, int]]) -> List[List[int]]:
    if not day_shifts:
        return []
    sorted_shifts = sorted(day_shifts, key=lambda s: s[0])
    merged: List[List[int]] = [[sorted_shifts[0][0], sorted_shifts[0][1]]]
    for start, end in sorted_shifts[1:]:
        last = merged[-1]
        if start <= last[1]:
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])
    return merged

def _apply_day_additions(day_shifts: List[Tuple[int, int]], need_add: int) -> Tuple[List[List[int]], int]:
    """日中帯（08-18）で勤務を追加。既存の時間は削らない。"""
    if need_add <= 0:
        return _normalize_day_shifts(day_shifts), 0

    shifts = _normalize_day_shifts(day_shifts)
    added = 0

    if not shifts:
        start = DAY_WINDOW_START
        end = min(DAY_WINDOW_END, start + need_add)
        if end > start:
            return [[start, end]], end - start
        return [], 0

    # 1) 隙間を埋めてシフト数を減らす（必要分だけ）
    i = 0
    while i < len(shifts) - 1 and need_add > 0:
        gap = shifts[i + 1][0] - shifts[i][1]
        if gap > 0:
            fill = min(gap, need_add)
            shifts[i][1] += fill
            added += fill
            need_add -= fill
            if shifts[i][1] >= shifts[i + 1][0]:
                shifts[i][1] = max(shifts[i][1], shifts[i + 1][1])
                del shifts[i + 1]
                continue
        i += 1

    # 2) 末尾を延長（18:00まで）
    if need_add > 0:
        avail = DAY_WINDOW_END - shifts[-1][1]
        if avail > 0:
            add = min(avail, need_add)
            shifts[-1][1] += add
            added += add
            need_add -= add

    # 3) 先頭を前倒し（08:00まで）
    if need_add > 0:
        avail = shifts[0][0] - DAY_WINDOW_START
        if avail > 0:
            add = min(avail, need_add)
            shifts[0][0] -= add
            added += add
            need_add -= add

    return shifts, added

def _adjust_day_shifts(
    shifts: List[Dict],
    target_total_minutes: int
) -> Tuple[List[Dict], int]:
    """1日の合計勤務時間を目標に近づける（追加のみ、日中帯のみ）。"""
    current_total = _total_minutes(shifts)

    # 既に目標以上 or 上限超えの既存日は変更しない
    if current_total >= target_total_minutes or current_total > MAX_DAILY_MINUTES:
        return shifts, 0

    max_add = max(0, MAX_DAILY_MINUTES - current_total)
    need_add = min(target_total_minutes - current_total, max_add)
    if need_add <= 0:
        return shifts, 0

    day_shifts: List[Tuple[int, int]] = []
    fixed_shifts: List[Dict] = []

    for shift in shifts:
        start, end = _shift_minutes(shift)
        if end <= start:
            fixed_shifts.append(shift)
            continue
        # 日中帯のみ対象
        if DAY_WINDOW_START <= start and end <= DAY_WINDOW_END:
            day_shifts.append((start, end))
        else:
            fixed_shifts.append(shift)

    updated_day_shifts, added = _apply_day_additions(day_shifts, need_add)
    if added <= 0:
        return shifts, 0

    # 日中帯シフトを作り直し、他シフトはそのまま
    rebuilt: List[Dict] = []
    for start, end in updated_day_shifts:
        if end > start:
            rebuilt.append({
                'work_start': minutes_to_time(start),
                'work_end': minutes_to_time(end)
            })
    rebuilt.extend(fixed_shifts)

    rebuilt = sorted(rebuilt, key=lambda s: time_to_minutes(s.get('work_start', '0:00')))
    return rebuilt, added

def _would_violate_consecutive(work_flags: List[bool], idx: int) -> bool:
    if work_flags[idx]:
        return False
    left = 0
    i = idx - 1
    while i >= 0 and work_flags[i]:
        left += 1
        i -= 1
    right = 0
    i = idx + 1
    while i < len(work_flags) and work_flags[i]:
        right += 1
        i += 1
    return (left + 1 + right) >= 6

def _make_shuffled_indices(all_dates: List[str], seed_key: str) -> List[int]:
    """人間らしいばらつきを作るため、日付インデックスを固定シードでシャッフル"""
    rng = random.Random(seed_key)
    indices = list(range(len(all_dates)))
    rng.shuffle(indices)
    return indices

def _adjust_monthly_shifts(shifts_by_date: Dict[str, List[Dict]], all_dates: List[str], seed_key: str) -> Dict[str, List[Dict]]:
    """月合計160h未満の場合のみ、日中帯で勤務を追加して調整する。"""
    month_total = sum(_counted_minutes(shifts_by_date.get(date, [])) for date in all_dates)
    # 「160時間を超える」ことが条件
    if month_total > MONTH_MINUTES_TARGET:
        return shifts_by_date

    # 1) 9h未満の勤務日は9hへ
    for date in all_dates:
        shifts = shifts_by_date.get(date, [])
        if not shifts:
            continue
        total = _total_minutes(shifts)
        if 0 < total < MIN_DAILY_MINUTES:
            adjusted, _ = _adjust_day_shifts(shifts, MIN_DAILY_MINUTES)
            shifts_by_date[date] = adjusted

    # 再計算
    month_total = sum(_counted_minutes(shifts_by_date.get(date, [])) for date in all_dates)
    if month_total > MONTH_MINUTES_TARGET:
        return shifts_by_date

    remaining = (MONTH_MINUTES_TARGET + 1) - month_total

    # 2) 既存勤務日に追加（10h上限、集計8h未満のみに限定）
    for idx in _make_shuffled_indices(all_dates, seed_key + "_existing"):
        if remaining <= 0:
            break
        date = all_dates[idx]
        shifts = shifts_by_date.get(date, [])
        if not shifts:
            continue
        if _counted_minutes(shifts) >= COUNTED_DAILY_CAP:
            continue
        total = _total_minutes(shifts)
        if total >= MAX_DAILY_MINUTES:
            continue
        # 8時間集計に届くように追加（ただし1日10時間まで）
        need_for_count = min(COUNTED_DAILY_CAP, total + remaining)
        target = min(MAX_DAILY_MINUTES, max(total, need_for_count))
        adjusted, added = _adjust_day_shifts(shifts, target)
        if added > 0:
            shifts_by_date[date] = adjusted
            month_total = sum(_counted_minutes(shifts_by_date.get(d, [])) for d in all_dates)
            remaining = max(0, (MONTH_MINUTES_TARGET + 1) - month_total)

    if remaining <= 0:
        return shifts_by_date

    # 3) 休みの日に追加（6連勤禁止）
    work_flags = [(_total_minutes(shifts_by_date.get(date, [])) > 0) for date in all_dates]
    for idx in _make_shuffled_indices(all_dates, seed_key + "_new"):
        if remaining <= 0:
            break
        date = all_dates[idx]
        if work_flags[idx]:
            continue
        if _would_violate_consecutive(work_flags, idx):
            continue
        # 新規勤務日は8-18で10h入れる（集計は8h）
        target = MAX_DAILY_MINUTES
        adjusted, added = _adjust_day_shifts([], target)
        if added > 0:
            shifts_by_date[date] = adjusted
            month_total = sum(_counted_minutes(shifts_by_date.get(d, [])) for d in all_dates)
            remaining = max(0, (MONTH_MINUTES_TARGET + 1) - month_total)
            work_flags[idx] = True

    return shifts_by_date

# 休憩時間の列ペア（実績側10枠）
BREAK_COLUMN_PAIRS: List[Tuple[str, str]] = [(f"休憩{i}", f"復帰{i}") for i in range(1, 11)]
FULL_WIDTH_DIGIT_MAP = str.maketrans("０１２３４５６７８９", "0123456789")
COLUMN_REMOVE_CHARS = [' ', '　', '"', "'", '“', '”']
EXCLUDED_OUTPUT_COLUMNS = frozenset()
HOLIDAY_COLUMNS = [
    '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
    '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由'
]
FORCED_EMPTY_COLUMNS = tuple(
    ['スケジュール雛形ID']
    + HOLIDAY_COLUMNS
    + [f'打刻区分ID:{i}' for i in range(1, 51)]
    + [f'直行{i}' for i in range(1, 11)]
    + [f'直帰{i}' for i in range(1, 11)]
)
FORCED_EMPTY_SET = set(FORCED_EMPTY_COLUMNS)


def build_forced_empty_indices(headers: List[str]) -> List[int]:
    """ヘッダーリストから強制ブランク対象列のインデックス一覧を取得"""
    return [idx for idx, name in enumerate(headers) if name in FORCED_EMPTY_SET]


def enforce_forced_empty_fields(row: List[Any], forced_indices: List[int]) -> None:
    """指定インデックスの値を強制的にブランクへ更新"""
    for idx in forced_indices:
        if idx < len(row):
            row[idx] = ''


def normalize_column_name(name: Any) -> str:
    """列名を比較用に正規化（スペース・引用符除去、全角数字→半角）"""
    if name is None:
        return ''
    normalized = str(name)
    for ch in COLUMN_REMOVE_CHARS:
        normalized = normalized.replace(ch, '')
    normalized = normalized.translate(FULL_WIDTH_DIGIT_MAP)
    return normalized


def normalize_break_header(header: str) -> str:
    """休憩/復帰カラム名のスペース・全角数字を正規化"""
    if header is None:
        return ''
    return normalize_column_name(header)


def resolve_column(df: pd.DataFrame, target_name: str, fallback_suffix: str = '') -> Optional[str]:
    """正規化した列名でターゲット列を探索"""
    normalized_map = {normalize_column_name(col): col for col in df.columns}
    normalized_target = normalize_column_name(target_name)
    if normalized_target in normalized_map:
        return normalized_map[normalized_target]
    
    # フォールバック: サフィックス一致などで探索
    if fallback_suffix:
        normalized_suffix = normalize_column_name(fallback_suffix)
        for norm, col in normalized_map.items():
            if norm.endswith(normalized_suffix):
                return col
    else:
        for norm, col in normalized_map.items():
            if normalized_target and normalized_target in norm:
                return col
    return None


def get_break_column_pairs(df: pd.DataFrame) -> List[Tuple[str, str]]:
    """DataFrame内の休憩/復帰カラムを検出し、実際の列名ペアを返す"""
    normalized_map: Dict[str, str] = {}
    for col in df.columns:
        normalized_map.setdefault(normalize_break_header(col), col)
    
    detected_pairs: List[Tuple[str, str]] = []
    for i in range(1, 11):
        start_key = f"休憩{i}"
        end_key = f"復帰{i}"
        start_col = normalized_map.get(start_key)
        end_col = normalized_map.get(end_key)
        if start_col and end_col:
            detected_pairs.append((start_col, end_col))
    
    if detected_pairs:
        return detected_pairs
    return BREAK_COLUMN_PAIRS.copy()


def extract_month_string(date_value: Any) -> str:
    """様々な日付表記から 'YYYY-MM' 形式の月文字列を取得"""
    if pd.isna(date_value):
        return ''
    date_str = str(date_value).strip()
    if not date_str:
        return ''
    
    # 既にISO形式であれば先頭7文字を使用
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str[:7]
    
    # YYYY-M-D のような形式はゼロ埋めして対応
    iso_parts = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', date_str)
    if iso_parts:
        year, month = iso_parts.group(1), int(iso_parts.group(2))
        return f"{year}-{month:02d}"
    
    # スラッシュ区切りなども許容
    slash_parts = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', date_str)
    if slash_parts:
        year, month = int(slash_parts.group(1)), int(slash_parts.group(2))
        return f"{year:04d}-{month:02d}"
    
    # YYYY年MM月 のみが記載されたケース
    jp_month = re.match(r'^(\d{4})年\s*(\d{1,2})月$', date_str)
    if jp_month:
        year, month = int(jp_month.group(1)), int(jp_month.group(2))
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    
    # YYYYMM月 / YYYYMM といった圧縮表記
    compact_month = re.match(r'^(\d{4})(\d{2})月?$', date_str)
    if compact_month:
        year, month = int(compact_month.group(1)), int(compact_month.group(2))
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    
    # YYYY/MM や YYYY-MM の場合
    compact_slash = re.match(r'^(\d{4})/(\d{1,2})$', date_str)
    if compact_slash:
        year, month = int(compact_slash.group(1)), int(compact_slash.group(2))
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    
    compact_dash = re.match(r'^(\d{4})-(\d{1,2})$', date_str)
    if compact_dash:
        year, month = int(compact_dash.group(1)), int(compact_dash.group(2))
        if 1 <= month <= 12:
            return f"{year:04d}-{month:02d}"
    
    try:
        parsed = parse_date_any(date_str)
        return parsed.strftime("%Y-%m")
    except Exception:
        pass
    
    try:
        parsed = pd.to_datetime(date_str, errors='coerce')
        if pd.notna(parsed):
            return f"{parsed.year:04d}-{parsed.month:02d}"
    except Exception:
        pass
    
    return ''


def build_employee_month_mask(
    df: pd.DataFrame,
    selected_employees: List[str],
    target_month: str
) -> pd.Series:
    """選択従業員と対象月に合致する行のマスクを生成"""
    name_col = resolve_column(df, '名前', fallback_suffix='名前')
    date_col = resolve_column(df, '*年月日', fallback_suffix='年月日')
    if not name_col or not date_col:
        return pd.Series([False] * len(df), index=df.index)
    
    normalized_names = df[name_col].astype(str).str.strip()
    normalized_months = df[date_col].apply(extract_month_string)
    employee_set = {normalize_column_name(emp).strip() for emp in selected_employees}
    normalized_employee_names = normalized_names.apply(normalize_column_name)
    
    return normalized_employee_names.isin(employee_set) & (normalized_months == target_month)


def build_month_mask(df: pd.DataFrame, target_month: str) -> pd.Series:
    """対象月に合致する行のみTrueとなるマスクを生成"""
    date_col = resolve_column(df, '*年月日', fallback_suffix='年月日')
    if not date_col:
        return pd.Series([True] * len(df), index=df.index)
    normalized_months = df[date_col].apply(extract_month_string)
    return normalized_months == target_month


def get_unique_employee_names(df: pd.DataFrame) -> List[str]:
    """勤怠データから一意な従業員名一覧を取得"""
    name_col = resolve_column(df, '名前', fallback_suffix='名前')
    if not name_col:
        return []
    names = df[name_col].astype(str).str.strip()
    non_empty = names[names != '']
    unique_names = pd.Series(non_empty).drop_duplicates().tolist()
    unique_names = [name for name in unique_names if name]
    return sorted(unique_names)


def minutes_to_extended_time(minutes: Optional[int]) -> str:
    """分を0埋めなしの時刻文字列に変換（24時超もそのまま保持）"""
    if minutes is None:
        return ''
    hours, mins = divmod(minutes, 60)
    return f"{hours}:{mins:02d}"


def round_to_nearest_half_hour(minutes: int) -> int:
    """分単位の値を30分刻みに四捨五入（15分以上で切り上げ）"""
    return ((minutes + 15) // 30) * 30


def auto_round_break_times(
    attendance_df: pd.DataFrame
) -> Tuple[pd.DataFrame, int, int]:
    """
    勤怠CSV全体の休憩時間を30分単位に近づける。
    
    - 開始・終了ともに30分単位であれば変更しない
    - それ以外は、開始を30分単位に四捨五入し、元の休憩時間（分）は維持したまま終了を調整
    
    Returns:
        (補正後DataFrame, 補正されたレコード数, 補正した休憩枠数)
    """
    df = attendance_df.copy()
    break_pairs = get_break_column_pairs(df)
    
    if not break_pairs:
        return df, 0, 0
    
    updated_rows = 0
    updated_slots = 0
    
    for idx in df.index:
        row_modified = False
        for start_col, end_col in break_pairs:
            start_raw = df.at[idx, start_col] if start_col in df.columns else None
            end_raw = df.at[idx, end_col] if end_col in df.columns else None
            
            start_minutes = parse_minute_of_day(start_raw)
            end_minutes = parse_minute_of_day(end_raw)
            
            if start_minutes is None or end_minutes is None:
                continue
            if end_minutes <= start_minutes:
                continue
            
            duration = end_minutes - start_minutes
            if duration <= 0:
                continue
            
            if start_minutes % 30 == 0 and end_minutes % 30 == 0:
                continue  # 既に30分単位
            
            rounded_start = max(0, round_to_nearest_half_hour(start_minutes))
            new_end_minutes = rounded_start + duration
            
            new_start = minutes_to_extended_time(rounded_start)
            new_end = minutes_to_extended_time(new_end_minutes)
            
            if new_start != str(start_raw) or new_end != str(end_raw):
                df.at[idx, start_col] = new_start
                df.at[idx, end_col] = new_end
                row_modified = True
                updated_slots += 1
        
        if row_modified:
            updated_rows += 1
    
    return df, updated_rows, updated_slots


def bulk_override_break_times(
    attendance_df: pd.DataFrame,
    selected_employees: List[str],
    target_month: str,
    new_start: str,
    new_end: str
) -> Tuple[pd.DataFrame, int, int]:
    """
    対象従業員・対象月の休憩時間（休憩1/復帰1のみ）を指定時刻に一括置換する。
    
    Returns:
        (置換後DataFrame, 更新されたレコード数, 更新した休憩枠数)
    """
    df = attendance_df.copy()
    mask = build_employee_month_mask(df, selected_employees, target_month)
    
    if not mask.any():
        return df, 0, 0
    
    break_pairs = get_break_column_pairs(df)
    updated_rows = 0
    updated_slots = 0
    
    for idx in df[mask].index:
        row_modified = False
        if not break_pairs:
            break
        start_col, end_col = break_pairs[0]
        if start_col not in df.columns or end_col not in df.columns:
            continue
        
        start_val = df.at[idx, start_col]
        end_val = df.at[idx, end_col]
        
        value_exists = False
        if isinstance(start_val, str) and start_val.strip():
            value_exists = True
        elif isinstance(end_val, str) and end_val.strip():
            value_exists = True
        elif not isinstance(start_val, str) and not pd.isna(start_val):
            value_exists = True
        elif not isinstance(end_val, str) and not pd.isna(end_val):
            value_exists = True
        
        if value_exists:
            df.at[idx, start_col] = new_start
            df.at[idx, end_col] = new_end
            row_modified = True
            updated_slots += 1
        
        if row_modified:
            updated_rows += 1
    
    return df, updated_rows, updated_slots

def merge_overlapping_shifts(shifts: List[Dict]) -> List[Dict]:
    """1時間半ルール適用：シフトを結合して最適な勤務時間を算出
    
    1時間半（90分）未満の間隔で区切られたシフトを結合し、
    最小出勤回数かつ最小出勤時間を実現する。
    
    例: 0:00-0:30, 1:00-2:00, 4:00-5:00, 7:00-8:00, 8:00-9:00
    → 0:00-5:00, 7:00-9:00 (2回出勤、5時間+2時間=7時間)
    → 0:00-9:00 (1回出勤、9時間) より2時間短縮
    """
    if not shifts or len(shifts) <= 1:
        return shifts
    
    # 時間順にソート
    sorted_shifts = sorted(shifts, key=lambda x: time_to_minutes(x.get('work_start', '0:00')))
    merged = []
    
    for shift in sorted_shifts:
        if not shift.get('work_start') or not shift.get('work_end'):
            continue
            
        current_start = time_to_minutes(shift['work_start'], False)
        current_end = time_to_minutes(shift['work_end'], True, shift['work_start'])
        
        # 最後に追加されたシフトと重複・連続チェック
        if merged:
            last_shift = merged[-1]
            last_end = time_to_minutes(last_shift['work_end'], True, last_shift['work_start'])
            
            # 1時間半（90分）未満の間隔は連続とみなす
            if current_start - last_end < 90:
                # 結合：終了時間を延長（翌日跨ぎを考慮して元の文字列を維持）
                if current_end > last_end:
                    last_shift['work_end'] = shift['work_end']
                continue
        
        # 新しいシフトとして追加
        merged.append({
            'work_start': shift['work_start'],
            'work_end': shift['work_end']
        })
    
    return merged

def load_employee_id_mapping(attendance_file_path: str = 'input/勤怠履歴.csv') -> Dict[str, str]:
    """勤怠CSVから従業員名と従業員IDのマッピングを作成"""
    df: Optional[pd.DataFrame] = None

    path = Path(attendance_file_path)
    if path.exists():
        df = _read_attendance_csv(path)

    if df is None:
        fallback = find_default_attendance_csv()
        if fallback and fallback.exists():
            df = _read_attendance_csv(fallback)

    if df is None:
        df = build_builtin_attendance_dataframe()

    mapping: Dict[str, str] = {}
    for _, row in df.iterrows():
        name = str(row.get('名前', '')).strip()
        emp_id = str(row.get('*従業員ID', '')).strip()
        
        if name and emp_id and name != 'nan' and emp_id != 'nan':
            normalized_name = normalize_name(name)
            if normalized_name:
                mapping[normalized_name] = emp_id
                mapping[name] = emp_id
    
    return mapping

def convert_japanese_date_to_iso(japanese_date: str) -> str:
    """和暦日付を西暦ISO形式に変換
    
    例: '令和07年06月01日 (日)' -> '2025-06-01'
    """
    if not japanese_date or japanese_date.strip() == '':
        return ''
    
    try:
        # 和暦パターンをマッチ
        pattern = r'令和(\d+)年(\d+)月(\d+)日'
        match = re.search(pattern, japanese_date)
        
        if match:
            reiwa_year = int(match.group(1))
            month = int(match.group(2))
            day = int(match.group(3))
            
            # 令和元年は2019年、令和2年は2020年...
            western_year = 2018 + reiwa_year
            
            return f"{western_year:04d}-{month:02d}-{day:02d}"
        
        # 既に西暦形式の場合はそのまま返す
        if re.match(r'\d{4}-\d{2}-\d{2}', japanese_date):
            return japanese_date
        
        # その他の形式は空文字を返す
        return ''
        
    except Exception as e:
        print(f"日付変換エラー: {japanese_date} -> {str(e)}")
        return ''

def get_employee_id(employee_name: str, attendance_file_path: str = 'input/勤怠履歴.csv') -> str:
    """勤怠CSVから従業員IDを正しく取得"""
    # 勤怠CSVから従業員IDマッピングを取得
    mapping = load_employee_id_mapping(attendance_file_path)
    
    if not mapping:
        # フォールバック: 従来の固定マッピング
        employee_ids = {
            '利光 梨絵': 'EMP001',
            '大宮 浩子': 'EMP002',
            '早崎 友音': 'EMP003',
            '早崎 琴絵': 'EMP004',
            '萩原 真理子': 'EMP005'
        }
        return employee_ids.get(employee_name, f'EMP{hash(employee_name) % 1000:03d}')
    
    # まず元の名前で検索
    if employee_name in mapping:
        return mapping[employee_name]
    
    # 正規化した名前で検索
    normalized_name = normalize_name(employee_name)
    if normalized_name in mapping:
        return mapping[normalized_name]
    
    # 見つからない場合は、勤怠CSVに存在する従業員名を表示してエラー
    available_names = [name for name in mapping.keys() if not name.startswith('EMP')]
    print(f"警告: 従業員 '{employee_name}' (正規化後: '{normalized_name}') が勤怠CSVに見つかりません")
    print(f"利用可能な従業員名: {available_names[:10]}...")  # 最初の10名を表示
    
    # フォールバック: ハッシュベースのID生成
    return f'EMP{hash(employee_name) % 1000:03d}'

def load_service_data_from_session() -> pd.DataFrame:
    """Streamlitセッション状態からサービス実績データを読み込み、複数CSVを統合"""
    service_data = []
    
    # セッション状態からサービス実績データを取得
    if 'service_data_list' in st.session_state and st.session_state.service_data_list:
        for service_df in st.session_state.service_data_list:
            if service_df is not None and not service_df.empty:
                # サービス実績データを抽出
                for _, row in service_df.iterrows():
                    # 様々なカラム名に対応
                    employee = ''
                    date = ''
                    start_time = ''
                    end_time = ''
                    
                    # 担当者名の取得（複数のカラム名に対応）
                    for col in ['担当所員', '担当者', '職員名', '従業員名', '名前']:
                        if col in row and str(row[col]).strip():
                            employee = str(row[col]).strip()
                            break
                    
                    # 日付の取得（複数のカラム名に対応）
                    for col in ['日付', 'サービス提供日', '実施日', '年月日']:
                        if col in row and str(row[col]).strip():
                            date = str(row[col]).strip()
                            break
                    
                    # 開始時間の取得（複数のカラム名に対応）
                    for col in ['開始時間', 'サービス開始時間', '開始', '開始時刻']:
                        if col in row and str(row[col]).strip():
                            start_time = str(row[col]).strip()
                            break
                    
                    # 終了時間の取得（複数のカラム名に対応）
                    for col in ['終了時間', 'サービス終了時間', '終了', '終了時刻']:
                        if col in row and str(row[col]).strip():
                            end_time = str(row[col]).strip()
                            break
                    
                    if employee and date and start_time and end_time:
                        # 従業員名を正規化
                        normalized_employee = normalize_name(employee)
                        
                        # 日付を西暦形式に変換
                        iso_date = convert_japanese_date_to_iso(date)
                        if not iso_date:
                            iso_date = date  # 変換できない場合は元の日付を使用
                        
                        # デバッグ情報: 日付変換（コンソール出力）
                        if date != iso_date:
                            debug_log(f"    📅 日付変換: '{date}' -> '{iso_date}'")
                        
                        service_data.append({
                            'employee': employee,  # 元の名前
                            'employee_normalized': normalized_employee,  # 正規化した名前
                            'date': iso_date,  # 西暦形式に変換した日付
                            'original_date': date,  # 元の日付形式
                            'start_time': start_time,
                            'end_time': end_time,
                            'service_content': str(row.get('サービス内容', row.get('内容', ''))).strip(),
                            'implementation_time': str(row.get('実施時間', row.get('時間', ''))).strip()
                        })
    
    # 統合されたDataFrameを返す
    result_df = pd.DataFrame(service_data)
    
    # デバッグ情報（コンソールのみに出力）
    debug_log("🔍 セッション状態確認:")
    debug_log(f"  - service_data_list存在: {'service_data_list' in st.session_state}")
    if 'service_data_list' in st.session_state:
        debug_log(f"  - service_data_listの長さ: {len(st.session_state.service_data_list) if st.session_state.service_data_list else 0}")
    
    debug_log(f"🔍 統合されたサービス実績データ: {len(result_df)}行")
    if not result_df.empty:
        unique_employees = result_df['employee'].nunique()
        unique_dates = result_df['date'].nunique()
        debug_log(f"  従業員数: {unique_employees}, 日付数: {unique_dates}")
        debug_log(f"  サンプルデータ（最初の5行）: {result_df.head().to_dict(orient='records')}")
    else:
        debug_log("⚠️ サービス実績データが空です")
    
    return result_df

def load_service_data_from_input_dir(workdir: str = None) -> pd.DataFrame:
    """inputディレクトリから直接サービス実績CSVを読み込み"""
    service_data = []
    
    # inputディレクトリのパスを決定
    if workdir and os.path.exists(workdir):
        input_dir = os.path.join(workdir, "input")
    else:
        input_dir = "input"
    
    if not os.path.exists(input_dir):
        return pd.DataFrame(service_data)
    
    # inputディレクトリ内のCSVファイルを取得（勤怠履歴以外）
    csv_files = [f for f in os.listdir(input_dir) if f.endswith('.csv')]
    service_files = [f for f in csv_files if '勤怠' not in f and 'attendance' not in f.lower()]
    
    # デバッグ情報
    debug_log(f"🔍 inputディレクトリ: {input_dir}")
    debug_log(f"  全CSVファイル: {csv_files}")
    debug_log(f"  サービス実績ファイル: {service_files}")
    
    for service_file in service_files:
        file_path = os.path.join(input_dir, service_file)
        try:
            # 複数のエンコーディングを試行
            df = None
            for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                continue
            
            # デバッグ情報
            debug_log(f"✅ {service_file}を読み込み: {len(df)}行")
            debug_log(f"  カラム: {df.columns.tolist()}")
            
            # サービス実績データを抽出
            for _, row in df.iterrows():
                # 様々なカラム名に対応
                employee = ''
                date = ''
                start_time = ''
                end_time = ''
                
                # 担当者名の取得（複数のカラム名に対応）
                for col in ['担当所員', '担当者', '職員名', '従業員名', '名前']:
                    if col in row and str(row[col]).strip():
                        employee = str(row[col]).strip()
                        break
                
                # 日付の取得（複数のカラム名に対応）
                for col in ['日付', 'サービス提供日', '実施日', '年月日']:
                    if col in row and str(row[col]).strip():
                        date = str(row[col]).strip()
                        break
                
                # 開始時間の取得（複数のカラム名に対応）
                for col in ['開始時間', 'サービス開始時間', '開始', '開始時刻']:
                    if col in row and str(row[col]).strip():
                        start_time = str(row[col]).strip()
                        break
                
                # 終了時間の取得（複数のカラム名に対応）
                for col in ['終了時間', 'サービス終了時間', '終了', '終了時刻']:
                    if col in row and str(row[col]).strip():
                        end_time = str(row[col]).strip()
                        break
                
                if employee and date and start_time and end_time:
                    # 従業員名を正規化
                    normalized_employee = normalize_name(employee)
                    
                    # 日付を西暦形式に変換
                    iso_date = convert_japanese_date_to_iso(date)
                    if not iso_date:
                        iso_date = date  # 変換できない場合は元の日付を使用
                    
                    service_data.append({
                        'employee': employee,  # 元の名前
                        'employee_normalized': normalized_employee,  # 正規化した名前
                        'date': iso_date,  # 西暦形式に変換した日付
                        'original_date': date,  # 元の日付形式
                        'start_time': start_time,
                        'end_time': end_time,
                        'service_content': str(row.get('サービス内容', row.get('内容', ''))).strip(),
                        'implementation_time': str(row.get('実施時間', row.get('時間', ''))).strip()
                    })
        
        except Exception as e:
            debug_log(f"❌ {service_file}の読み込みエラー: {str(e)}")
    
    result_df = pd.DataFrame(service_data)
    
    # デバッグ情報
    debug_log(f"🔍 inputディレクトリから統合されたサービス実績データ: {len(result_df)}行")
    if not result_df.empty:
        unique_employees = result_df['employee'].nunique()
        unique_dates = result_df['date'].nunique()
        debug_log(f"  従業員数: {unique_employees}, 日付数: {unique_dates}")
        debug_log(f"  サンプルデータ（最初の5行）: {result_df.head().to_dict(orient='records')}")
    
    return result_df

def load_service_data_from_results(workdir: str = None) -> pd.DataFrame:
    """エラーチェック結果からサービス実績データを読み込み（フォールバック用）"""
    service_data = []
    
    if workdir and os.path.exists(workdir):
        # 作業ディレクトリからresult_*.csvファイルを探す
        result_files = glob.glob(os.path.join(workdir, "result_*.csv"))
    else:
        # カレントディレクトリからresult_*.csvファイルを探す
        result_files = glob.glob("result_*.csv")
    
    for file_path in result_files:
        try:
            df = pd.read_csv(file_path, encoding="utf-8-sig")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file_path, encoding="cp932")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="utf-8")
        
        # サービス実績データを抽出
        for _, row in df.iterrows():
            employee = str(row.get('担当所員', '')).strip()
            date = str(row.get('日付', '')).strip()
            start_time = str(row.get('開始時間', '')).strip()
            end_time = str(row.get('終了時間', '')).strip()
            
            if employee and date and start_time and end_time:
                # 従業員名を正規化
                normalized_employee = normalize_name(employee)
                
                # 日付を西暦形式に変換
                iso_date = convert_japanese_date_to_iso(date)
                if not iso_date:
                    iso_date = date  # 変換できない場合は元の日付を使用
                
                service_data.append({
                    'employee': employee,
                    'employee_normalized': normalized_employee,
                    'date': iso_date,
                    'original_date': date,
                    'start_time': start_time,
                    'end_time': end_time,
                    'service_content': str(row.get('サービス内容', '')).strip(),
                    'implementation_time': str(row.get('実施時間', '')).strip()
                })
    
    return pd.DataFrame(service_data)

def aggregate_daily_service_times(service_df: pd.DataFrame, employee: str, target_date: str) -> List[Dict]:
    """指定従業員・日付のサービス時間を集計してシフトリストを作成"""
    # サービスデータが空の場合は空のリストを返す
    if service_df.empty or 'employee' not in service_df.columns:
        return []
    
    # 従業員名を正規化
    normalized_employee = normalize_name(employee)
    
    # 指定従業員・日付のサービスデータを抽出（複数パターンで照合）
    try:
        daily_services = pd.DataFrame()
        
        # パターン1: 元の名前で検索
        daily_services = service_df[
            (service_df['employee'] == employee) &
            (service_df['date'] == target_date)
        ].copy()
        
        # パターン2: 正規化した名前で検索（employee_normalizedカラムを使用）
        if daily_services.empty and 'employee_normalized' in service_df.columns:
            daily_services = service_df[
                (service_df['employee_normalized'] == normalized_employee) &
                (service_df['date'] == target_date)
            ].copy()
        
        # パターン3: サービスデータの従業員名を動的に正規化して比較
        if daily_services.empty:
            matching_rows = []
            target_date_data = service_df[service_df['date'] == target_date]
            
            # デバッグ情報: パターン3開始
            debug_log(f"    🔄 パターン3開始: 対象日のデータ数={len(target_date_data)}")
            
            for _, row in target_date_data.iterrows():
                service_employee = str(row['employee']).strip()
                service_normalized = normalize_name(service_employee)
                
                # デバッグ情報: 各行の照合状況
                debug_log(f"    照合中: '{service_employee}' -> 正規化: '{service_normalized}'")
                
                # 4つのパターンで照合
                match_found = False
                if service_employee == employee:
                    match_found = True
                    debug_log("      ✅ パターン1マッチ: 元の名前同士")
                elif service_normalized == normalized_employee:
                    match_found = True
                    debug_log("      ✅ パターン2マッチ: 正規化した名前同士")
                elif service_normalized == employee:
                    match_found = True
                    debug_log("      ✅ パターン3マッチ: 正規化 vs 元")
                elif service_employee == normalized_employee:
                    match_found = True
                    debug_log("      ✅ パターン4マッチ: 元 vs 正規化")
                
                if match_found:
                    matching_rows.append(row)
            
            if matching_rows:
                daily_services = pd.DataFrame(matching_rows)
        
        # デバッグ情報
        debug_log(f"  🔍 従業員名照合: '{employee}' -> 正規化: '{normalized_employee}'")
        if not daily_services.empty:
            debug_log(f"    ✅ マッチしたサービス: {len(daily_services)}件")
            # マッチした従業員名を表示
            matched_names = daily_services['employee'].unique()
            debug_log(f"    マッチした名前: {list(matched_names)}")
        else:
            # 利用可能な従業員名を表示
            available_employees = service_df['employee'].unique()[:10]  # 最初の10名
            available_normalized = [normalize_name(name) for name in available_employees]
            debug_log("    ❌ マッチなし。利用可能な従業員名（最初の10名）:")
            for orig, norm in zip(available_employees, available_normalized):
                debug_log(f"      '{orig}' -> 正規化: '{norm}'")
                
    except KeyError as e:
        print(f"カラムアクセスエラー: {e}")
        print(f"利用可能なカラム: {service_df.columns.tolist()}")
        return []
    
    if daily_services.empty:
        return []
    
    shifts = []
    for _, service in daily_services.iterrows():
        start_time = service.get('start_time', '')
        end_time = service.get('end_time', '')
        
        if start_time and end_time and start_time != 'nan' and end_time != 'nan':
            shifts.append({
                'work_start': start_time,
                'work_end': end_time
            })
    
    return shifts

def get_attendance_shifts(attendance_data: pd.DataFrame, employee: str, target_date: str) -> List[Dict]:
    """勤怠履歴データから指定従業員・日付の出勤・退勤時間を取得"""
    shifts = []
    
    # 勤怠データから該当従業員・日付のデータを取得
    employee_data = attendance_data[
        (attendance_data['名前'].str.strip() == employee.strip()) &
        (attendance_data['*年月日'].astype(str) == target_date)
    ]
    
    if employee_data.empty:
        return []
    
    row = employee_data.iloc[0]
    
    # 出勤・退勤時間のペアを取得（最大10ペア）
    for i in range(1, 11):
        start_col = f'出勤{i}' if i > 1 else '出勤1'
        end_col = f'退勤{i}' if i > 1 else '退勤1'
        
        start_time = str(row.get(start_col, '')).strip()
        end_time = str(row.get(end_col, '')).strip()
        
        if start_time and end_time and start_time != 'nan' and end_time != 'nan':
            shifts.append({
                'work_start': start_time,
                'work_end': end_time
            })
    
    return shifts

def generate_jinjer_csv(selected_employees: List[str], target_month: str, attendance_data: pd.DataFrame, workdir: str = None) -> str:
    """jinjer形式CSVを生成（サービス実績データベースの最適勤務時間）
    
    1. セッション状態のサービス実績データを優先使用
    2. フォールバック1: エラーチェック結果のサービス実績データ
    3. フォールバック2: 勤怠履歴データの出勤・退勤時間
    
    1時間半ルールを適用してシフトを最適化し、
    打刻区分IDや勤務状況フラグを適切に設定する。
    """
    headers = create_jinjer_headers()
    work_start_base = headers.index('出勤1')
    stamp_start_index = headers.index('打刻区分ID:1')
    stamp_count = sum(1 for col in headers if col.startswith('打刻区分ID:'))
    status_columns = ['未打刻', '欠勤', '休日打刻', '休暇打刻', '実績確定状況']
    status_indices = [headers.index(col) for col in status_columns]
    labor_indices = {
        'total': headers.index('総労働時間'),
        'actual': headers.index('実労働時間'),
        'break': headers.index('休憩時間'),
        'overtime_total': headers.index('総残業時間'),
        'overtime_external': headers.index('法定外残業時間'),
    }
    forced_empty_indices = build_forced_empty_indices(headers)
    csv_content = ','.join(headers) + '\n'
    
    # サービス実績データを読み込み（優先順位順）
    service_df = load_service_data_from_session()
    
    # セッション状態にデータがない場合はinputディレクトリから直接読み込み
    if service_df.empty:
        service_df = load_service_data_from_input_dir(workdir)
    
    # それでもデータがない場合はresult_*.csvから読み込み
    if service_df.empty:
        service_df = load_service_data_from_results(workdir)
    
    # デバッグ情報: サービス実績データの状況（コンソール出力）
    debug_log("📊 サービス実績データ読み込み結果:")
    debug_log(f"  データフレーム形状: {service_df.shape}")
    if not service_df.empty:
        debug_log(f"  カラム: {service_df.columns.tolist()}")
        if 'employee' in service_df.columns:
            unique_employees = service_df['employee'].unique()
            debug_log(f"  従業員数: {len(unique_employees)}")
            debug_log(f"  従業員名（最初の10名）: {list(unique_employees[:10])}")
        else:
            debug_log("❌ 'employee'カラムが見つかりません")
        
        # 日付形式の確認
        if 'date' in service_df.columns:
            unique_dates = service_df['date'].unique()
            debug_log(f"  日付数: {len(unique_dates)}")
            debug_log(f"  日付形式サンプル（最初の10件）: {list(unique_dates[:10])}")
            
            # 大宮浩子のデータがある日付を確認
            omiya_data = service_df[service_df['employee_normalized'] == '大宮 浩子']
            if not omiya_data.empty:
                omiya_dates = omiya_data['date'].unique()
                debug_log(f"  大宮浩子のサービス実績がある日付: {list(omiya_dates[:5])}")
            else:
                debug_log("  大宮浩子のサービス実績データなし")
            
            # 月別データ分布を確認
            service_df_temp = service_df.copy()
            service_df_temp['year_month'] = service_df_temp['date'].str[:7]  # YYYY-MM部分を抽出
            month_counts = service_df_temp['year_month'].value_counts().sort_index()
            debug_log(f"  📅 月別データ分布: {dict(month_counts)}")
    else:
        debug_log("❌ サービス実績データが空です")
    
    # 対象月の全日付を生成
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    # サービス実績が一件でもあれば勤怠のシフトは使わずサービス実績のみで判定
    prefer_service_only = not service_df.empty

    for employee in selected_employees:
        # 従業員IDを勤怠データから取得
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        
        employee_id = ''
        if not employee_data.empty:
            employee_id = str(employee_data.iloc[0].get('*従業員ID', '')).strip()
        
        # 勤怠データにない場合はフォールバック関数を使用
        if not employee_id or employee_id == 'nan':
            employee_id = get_employee_id(employee)

        # まず全日分のシフトを構築
        shifts_by_date: Dict[str, List[Dict]] = {}
        for date in all_dates:
            # サービス実績データからその日のシフトを取得
            shifts = aggregate_daily_service_times(service_df, employee, date)
            data_source = "service_data" if shifts else "no_data"
            
            # サービス実績が全く無い場合のみ勤怠データをフォールバックで利用
            if not shifts and not prefer_service_only:
                shifts = get_attendance_shifts(attendance_data, employee, date)
                data_source = "attendance_data" if shifts else "no_data"
            
            # デバッグ情報はコンソールに出力
            debug_log(f"🔍 {employee} {date}: データソース={data_source}, シフト数={len(shifts)}")
            if shifts:
                for i, shift in enumerate(shifts):
                    debug_log(f"  元シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            
            if shifts:
                # シフトがある場合、1時間半ルールで最適化
                merged_shifts = merge_overlapping_shifts(shifts)
                
                # デバッグ情報: 最適化結果（常に表示）
                debug_log(f"  最適化前: {len(shifts)}シフト -> 最適化後: {len(merged_shifts)}シフト")
                for i, shift in enumerate(merged_shifts):
                    debug_log(f"    最適化シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            else:
                # どちらのデータからもシフトが取得できない場合は空のシフト
                merged_shifts = []
                debug_log(f"⚠️ {employee} {date}: シフトデータが見つかりません")
            shifts_by_date[date] = merged_shifts

        # 月合計が160h未満の場合のみ、日中帯で追加調整
        seed_key = f"{employee}|{target_month}"
        shifts_by_date = _adjust_monthly_shifts(shifts_by_date, all_dates, seed_key)

        for date in all_dates:
            row = [''] * len(headers)

            # 基本情報の設定
            row[0] = employee  # 名前
            row[1] = employee_id  # *従業員ID
            row[2] = date  # *年月日
            row[3] = '1'  # *打刻グループID
            row[4] = '株式会社hot'  # 所属グループ名

            merged_shifts = shifts_by_date.get(date, [])

            # 出勤・退勤枠を初期化
            for shift_idx in range(0, 10):
                start_index = work_start_base + (shift_idx * 2)
                end_index = start_index + 1
                if start_index < len(headers):
                    row[start_index] = ''
                if end_index < len(headers):
                    row[end_index] = ''

            if merged_shifts:
                # 最適化後のシフトを出力（最大10枠）
                for shift_idx, shift in enumerate(merged_shifts[:10]):
                    start_index = work_start_base + (shift_idx * 2)
                    end_index = start_index + 1
                    if start_index < len(headers):
                        row[start_index] = format_time_for_csv(shift['work_start'])
                    if end_index < len(headers):
                        row[end_index] = format_time_for_csv(
                            shift['work_end'],
                            is_end_time=True,
                            reference_start=shift['work_start']
                        )

                # 労働時間をシフト合計から計算
                total_minutes = 0
                for shift in merged_shifts:
                    start_min = time_to_minutes(shift['work_start'])
                    end_min = time_to_minutes(shift['work_end'], True, shift['work_start'])
                    total_minutes += max(0, end_min - start_min)

                total_time = minutes_to_time(total_minutes)
                row[labor_indices['total']] = total_time
                row[labor_indices['actual']] = total_time
                row[labor_indices['break']] = '0:00'
                row[labor_indices['overtime_total']] = '0:00'
                row[labor_indices['overtime_external']] = '0:00'
            else:
                # サービス記録が無い日は空欄のまま出力
                row[labor_indices['total']] = ''
                row[labor_indices['actual']] = ''
                row[labor_indices['break']] = ''
                row[labor_indices['overtime_total']] = ''
                row[labor_indices['overtime_external']] = ''
            
            # 管理情報の設定（勤務状況、遅刻取消処理等）- 空欄のまま
            # row[95-99]は既に''で初期化されているので何もしない
            
            # 直行・直帰の設定 - 空欄のまま
            # row[100-119]は既に''で初期化されているので何もしない
            
            # 打刻区分ID（全50列）はブランクのままにする
            for i in range(stamp_count):
                idx = stamp_start_index + i
                if idx < len(headers):
                    row[idx] = ''
            
            # 勤務状況フラグ（未打刻、欠勤、休日打刻、休暇打刻、実績確定状況）を空欄に設定
            for idx in status_indices:
                if idx < len(headers):
                    row[idx] = ''
            
            # CSVの1行として追加
            enforce_forced_empty_fields(row, forced_empty_indices)
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content

def generate_0_24_jinjer_csv(selected_employees: List[str], target_month: str, attendance_data: pd.DataFrame) -> str:
    """0-24データ用jinjer形式CSVを生成（出勤1=0:00、退勤1=24:00）
    
    全日程で0:00-24:00の勤務として設定し、
    打刻区分IDや勤務状況フラグを適切に設定する。
    """
    headers = create_jinjer_headers()
    work_start_base = headers.index('出勤1')
    stamp_start_index = headers.index('打刻区分ID:1')
    stamp_count = sum(1 for col in headers if col.startswith('打刻区分ID:'))
    status_columns = ['未打刻', '欠勤', '休日打刻', '休暇打刻', '実績確定状況']
    status_indices = [headers.index(col) for col in status_columns]
    labor_indices = {
        'total': headers.index('総労働時間'),
        'actual': headers.index('実労働時間'),
        'break': headers.index('休憩時間'),
        'overtime_total': headers.index('総残業時間'),
        'overtime_external': headers.index('法定外残業時間'),
    }
    forced_empty_indices = build_forced_empty_indices(headers)
    csv_content = ','.join(headers) + '\n'
    
    # 対象月の全日付を生成
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    for employee in selected_employees:
        # 従業員IDを勤怠データから取得
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        
        employee_id = ''
        if not employee_data.empty:
            employee_id = str(employee_data.iloc[0].get('*従業員ID', '')).strip()
        
        # 勤怠データにない場合はフォールバック関数を使用
        if not employee_id or employee_id == 'nan':
            employee_id = get_employee_id(employee)
        
        for date in all_dates:
            row = [''] * len(headers)
            
            # 基本情報の設定
            row[0] = employee  # 名前
            row[1] = employee_id  # *従業員ID
            row[2] = date  # *年月日
            row[3] = '1'  # *打刻グループID
            row[4] = '株式会社hot'  # 所属グループ名
            
            # 0-24データの設定（出勤1/退勤1のみ使用）
            if work_start_base < len(headers):
                row[work_start_base] = '0:00'
            if work_start_base + 1 < len(headers):
                row[work_start_base + 1] = '24:00'
            for shift_idx in range(1, 10):
                start_index = work_start_base + (shift_idx * 2)
                end_index = start_index + 1
                if start_index < len(headers):
                    row[start_index] = ''
                if end_index < len(headers):
                    row[end_index] = ''
            
            # 打刻区分ID（全50列）はブランクのままにする
            for i in range(stamp_count):
                idx = stamp_start_index + i
                if idx < len(headers):
                    row[idx] = ''
            
            # 勤務状況フラグを空欄に設定
            for idx in status_indices:
                if idx < len(headers):
                    row[idx] = ''
            
            # 労働時間の設定（24時間勤務）
            row[labor_indices['total']] = '24:00'
            row[labor_indices['actual']] = '23:00'
            row[labor_indices['break']] = '1:00'
            row[labor_indices['overtime_total']] = '16:00'
            row[labor_indices['overtime_external']] = '16:00'
            
            # CSVの1行として追加
            enforce_forced_empty_fields(row, forced_empty_indices)
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content


def generate_delete_attendance_csv(
    selected_employees: List[str],
    target_month: str,
    attendance_data: pd.DataFrame
) -> str:
    """元データに存在する出勤・退勤カラムのみ'Null'でクリアするCSVを生成"""
    headers = create_jinjer_headers()
    work_start_base = headers.index('出勤1')
    forced_empty_indices = build_forced_empty_indices(headers)
    csv_content = ','.join(headers) + '\n'
    
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    for employee in selected_employees:
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        name_col = resolve_column(employee_data, '名前', fallback_suffix='名前')
        date_col = resolve_column(employee_data, '*年月日', fallback_suffix='年月日')
        start_cols = []
        end_cols = []
        for i in range(1, 11):
            start_cols.append(resolve_column(employee_data, f'出勤{i}', fallback_suffix=f'出勤{i}') or f'出勤{i}')
            end_cols.append(resolve_column(employee_data, f'退勤{i}', fallback_suffix=f'退勤{i}') or f'退勤{i}')
        
        employee_id = ''
        if not employee_data.empty:
            employee_id = str(employee_data.iloc[0].get('*従業員ID', '')).strip()
        if not employee_id or employee_id == 'nan':
            employee_id = get_employee_id(employee)
        
        for date in all_dates:
            row = [''] * len(headers)
            row[0] = employee
            row[1] = employee_id
            row[2] = date
            row[3] = '1'
            row[4] = '株式会社hot'
            
            source_row = None
            if not employee_data.empty and name_col and date_col:
                date_mask = employee_data[date_col].astype(str) == date
                if date_mask.any():
                    source_row = employee_data[date_mask].iloc[0]
            
            # 元データに値が入っていた出勤・退勤カラムのみNullにする
            for shift_idx in range(0, 10):
                start_index = work_start_base + (shift_idx * 2)
                end_index = start_index + 1
                start_has_value = False
                end_has_value = False
                
                if source_row is not None:
                    start_src_col = start_cols[shift_idx]
                    end_src_col = end_cols[shift_idx]
                    
                    if start_src_col in source_row.index:
                        start_val = source_row[start_src_col]
                        if isinstance(start_val, str):
                            start_has_value = start_val.strip() != ''
                        else:
                            start_has_value = pd.notna(start_val)
                    if end_src_col in source_row.index:
                        end_val = source_row[end_src_col]
                        if isinstance(end_val, str):
                            end_has_value = end_val.strip() != ''
                        else:
                            end_has_value = pd.notna(end_val)
                
                if start_index < len(headers):
                    row[start_index] = 'Null' if start_has_value or end_has_value else ''
                if end_index < len(headers):
                    row[end_index] = 'Null' if start_has_value or end_has_value else ''
            
            # 労働時間系は空欄にする
            enforce_forced_empty_fields(row, forced_empty_indices)
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content

def show_optimal_attendance_export():
    """最適勤怠データ出力UI"""
    
    # デバッグモードの設定
    if "debug_mode" not in st.session_state:
        st.session_state.debug_mode = False  # 初期状態はオフ
    debug_mode = st.checkbox(
        "🔍 デバッグモードを有効にする",
        value=st.session_state.debug_mode,
        help="データソースや最適化処理の詳細情報を表示します"
    )
    st.session_state.debug_mode = debug_mode
    
    # 勤怠データの読み込み確認
    try:
        attendance_df = None
        attendance_source: Optional[str] = None
        uploaded_attendance = False
        
        if hasattr(st, 'session_state'):
            if st.session_state.get('attendance_df') is not None:
                attendance_df = st.session_state.attendance_df.copy()
                attendance_source = "アップロード済み勤怠CSV（セッション）"
                uploaded_attendance = True
            else:
                session_att_path = st.session_state.get('attendance_file_path')
                if session_att_path and os.path.exists(session_att_path):
                    for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                        try:
                            attendance_df = pd.read_csv(session_att_path, encoding=encoding)
                            attendance_source = session_att_path
                            uploaded_attendance = True
                            break
                        except UnicodeDecodeError:
                            continue
        
        if attendance_df is None:
            # セッションに無い場合は既定のinputフォルダを参照
            default_path = find_default_attendance_csv()
            if default_path:
                attendance_file_path = str(default_path)
                attendance_source = attendance_file_path
                for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                    try:
                        attendance_df = pd.read_csv(attendance_file_path, encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
        
        if attendance_df is None:
            attendance_df = build_builtin_attendance_dataframe()
            attendance_source = "組み込みデフォルト"
        
        total_employees = get_unique_employee_names(attendance_df)
        if not total_employees:
            st.error("勤怠データから従業員情報を取得できませんでした。")
            return
        
        source_label = attendance_source or "不明"
        st.success(f"勤怠データを読み込みました（ソース: {source_label}）。登録従業員: {len(total_employees)}名")
        
        available_months: List[str] = []
        # 利用可能な年月を表示
        try:
            name_col = resolve_column(attendance_df, '名前', fallback_suffix='名前')
            date_col = resolve_column(attendance_df, '*年月日', fallback_suffix='年月日')
            if name_col and date_col:
                normalized_dates = attendance_df[date_col].apply(extract_month_string)
                month_counts = normalized_dates.value_counts().sort_index()
                available_months = [month for month in month_counts.index if isinstance(month, str) and month]
                if not month_counts.empty:
                    month_info = ', '.join([f"{month} ({count}件)" for month, count in month_counts.items()])
                    st.info(f"利用可能な年月: {month_info}")
        except Exception:
            pass
        
        latest_available_month = max(available_months) if available_months else None
        now = datetime.now()
        if now.month == 1:
            prev_year = now.year - 1
            prev_month = 12
        else:
            prev_year = now.year
            prev_month = now.month - 1
        previous_month_str = f"{prev_year:04d}-{prev_month:02d}"

        if uploaded_attendance and latest_available_month:
            default_month_str = latest_available_month
        elif uploaded_attendance:
            default_month_str = f"{now.year:04d}-{now.month:02d}"
        else:
            default_month_str = previous_month_str

        try:
            default_year = int(default_month_str.split('-')[0])
            default_month = int(default_month_str.split('-')[1])
        except (ValueError, IndexError):
            default_year = now.year
            default_month = now.month
            default_month_str = f"{default_year:04d}-{default_month:02d}"

        year_candidates = {
            default_year,
            now.year,
            now.year - 1,
            now.year + 1,
        }
        year_candidates.update(
            int(month.split('-')[0]) for month in available_months if isinstance(month, str) and '-' in month
        )
        year_options = sorted({year for year in year_candidates if year >= 1900})

        month_options = list(range(1, 13))
        default_month_index = month_options.index(default_month) if default_month in month_options else now.month - 1

        # 対象月の選択
        col1, col2 = st.columns(2)
        with col1:
            target_year = st.selectbox("対象年", year_options, index=year_options.index(default_year))
        with col2:
            target_month = st.selectbox(
                "対象月",
                month_options,
                index=default_month_index,
                format_func=lambda m: f"{m:02d}月"
            )
        
        target_month_str = f"{target_year}-{target_month:02d}"
        
        # 対象月の勤怠データを抽出
        month_mask = build_month_mask(attendance_df, target_month_str)
        month_attendance_df = attendance_df[month_mask].copy() if len(attendance_df) else attendance_df.copy()
        
        if month_attendance_df.empty:
            st.warning(f"{target_month_str} の勤怠データが見つかりませんでした。別の月を選択してください。")
            if 'selected_employees_export' in st.session_state:
                st.session_state.selected_employees_export = []
            st.stop()
        
        available_employees = get_unique_employee_names(month_attendance_df)
        if not available_employees:
            st.warning(f"{target_month_str} の勤怠データに従業員情報がありません。")
            if 'selected_employees_export' in st.session_state:
                st.session_state.selected_employees_export = []
            st.stop()
        
        st.caption(f"{target_month_str} の対象従業員: {len(available_employees)}名")
        
        # 従業員選択
        st.markdown("### 👥 出力対象従業員の選択")
        
        if 'selected_employees_export' not in st.session_state:
            st.session_state.selected_employees_export = []
        else:
            st.session_state.selected_employees_export = [
                emp for emp in st.session_state.selected_employees_export
                if emp in available_employees
            ]
        
        # 全選択・全解除ボタン
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            if st.button("全員選択", key="select_all_export"):
                st.session_state.selected_employees_export = available_employees.copy()
                st.rerun()
        with col2:
            if st.button("選択解除", key="clear_all_export"):
                st.session_state.selected_employees_export = []
                st.rerun()
        
        # 従業員チェックボックス
        st.markdown("#### チェックボックスで従業員を選択してください")
        
        # 3列レイアウトでチェックボックスを表示
        cols = st.columns(3)
        for i, employee in enumerate(sorted(available_employees)):
            with cols[i % 3]:
                is_selected = employee in st.session_state.selected_employees_export
                if st.checkbox(employee, value=is_selected, key=f"emp_check_{i}"):
                    if employee not in st.session_state.selected_employees_export:
                        st.session_state.selected_employees_export.append(employee)
                else:
                    if employee in st.session_state.selected_employees_export:
                        st.session_state.selected_employees_export.remove(employee)
        
        # 選択された従業員の表示
        if st.session_state.selected_employees_export:
            st.info(f"選択された従業員: {len(st.session_state.selected_employees_export)}名")
            with st.expander("選択された従業員一覧"):
                for i, emp in enumerate(st.session_state.selected_employees_export, 1):
                    st.write(f"{i}. {emp}")
        
        st.markdown("### 📥 CSV出力")
        
        st.markdown("#### 🎯 最適勤怠データCSV")
        st.caption("選択した従業員の勤怠データをjinjer形式でまとめてダウンロードします。")
        if st.session_state.selected_employees_export:
            if st.button("🎯 最適勤怠データをCSV出力", type="primary", key="export_csv"):
                with st.spinner("CSV生成中..."):
                    try:
                        csv_content = generate_jinjer_csv(
                            st.session_state.selected_employees_export,
                            target_month_str,
                            month_attendance_df,
                            None
                        )
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"最適勤怠データ_{target_month_str}_{timestamp}.csv"
                        st.download_button(
                            label="📥 CSVファイルをダウンロード",
                            data=csv_content.encode('shift_jis', errors='ignore'),
                            file_name=filename,
                            mime="text/csv",
                            help="jinjer形式（194列）の最適勤怠データCSVファイル"
                        )
                        st.success(f"✅ CSV生成完了！{len(st.session_state.selected_employees_export)}名の勤怠データを出力しました。")
                        lines = csv_content.count('\n') - 1
                        st.info(f"📊 出力詳細: {lines}行のデータ（ヘッダー含む{lines + 1}行）")
                    except Exception as e:
                        st.error(f"CSV生成エラー: {str(e)}")
        else:
            st.info("従業員を選択すると、個別の最適勤怠データCSVを生成できます。")

        st.write("")

        st.markdown("#### 🕑 最適休憩時間CSV")
        st.caption("勤怠CSV全体の休憩枠を30分刻みに近づけ、合計休憩時間は変えずに出力します。")
        if st.button("🕑 最適休憩時間CSVを生成", key="export_break_auto"):
            with st.spinner("休憩時間を補正しています..."):
                try:
                    adjusted_df, rounded_rows, rounded_slots = auto_round_break_times(month_attendance_df)
                    csv_bytes = dataframe_to_jinjer_csv_bytes(
                        adjusted_df,
                        column_order=list(month_attendance_df.columns)
                    )
                    
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"最適休憩時間_{target_month_str}_{timestamp}.csv"
                    
                    st.download_button(
                        label="📥 CSVファイルをダウンロード",
                        data=csv_bytes,
                        file_name=filename,
                        mime="text/csv",
                        help="全従業員の休憩時刻を30分刻みで補正した勤怠CSV",
                        key="download_break_auto"
                    )
                    
                    if rounded_rows > 0:
                        st.success(f"✅ {rounded_rows}件のレコードで休憩枠（{rounded_slots}枠）を補正しました。全従業員に適用しています。")
                    else:
                        st.info("補正対象の休憩時間が見つかりませんでした。元の値のまま出力します。")
                    
                    if debug_mode:
                        name_col = resolve_column(adjusted_df, '名前', fallback_suffix='名前')
                        date_col = resolve_column(adjusted_df, '*年月日', fallback_suffix='年月日')
                        preview_pairs = get_break_column_pairs(adjusted_df)[:3]
                        preview_cols = [
                            col for col in [name_col, date_col] if col and col in adjusted_df.columns
                        ]
                        preview_cols += [
                            col for pair in preview_pairs for col in pair if col in adjusted_df.columns
                        ]
                        st.dataframe(adjusted_df.loc[:, preview_cols].head(), use_container_width=True)
                except Exception as e:
                    st.error(f"休憩時間補正中にエラーが発生しました: {str(e)}")

        st.write("")

        st.markdown("#### 🔁 休憩時間一括変更CSV")
        st.caption("選択した従業員・対象月の休憩枠を指定した時間帯にまとめて置き換えます。")
        col_start, col_end = st.columns(2)
        with col_start:
            bulk_start_input = st.text_input(
                "休憩開始時刻（例: 14:00 または 26:30）",
                key="bulk_break_start"
            )
        with col_end:
            bulk_end_input = st.text_input(
                "休憩終了時刻（例: 15:00 または 27:30）",
                key="bulk_break_end"
            )
        
        if st.button("🔁 指定休憩時間でCSV出力", key="export_break_bulk"):
            if not st.session_state.selected_employees_export:
                st.error("先に従業員を選択してください。")
            else:
                start_minutes = parse_minute_of_day(bulk_start_input)
                end_minutes = parse_minute_of_day(bulk_end_input)
                
                if start_minutes is None or end_minutes is None:
                    st.error("時刻の形式が正しくありません。'HH:MM'形式で入力してください。")
                elif end_minutes <= start_minutes:
                    st.error("終了時刻は開始時刻より後になるように設定してください。")
                else:
                    with st.spinner("休憩時間を一括変更しています..."):
                        try:
                            new_start_formatted = minutes_to_extended_time(start_minutes)
                            new_end_formatted = minutes_to_extended_time(end_minutes)
                            
                            target_mask = build_employee_month_mask(
                                month_attendance_df,
                                st.session_state.selected_employees_export,
                                target_month_str
                            )
                            matching_rows = month_attendance_df[target_mask]
                            
                            break_pairs = get_break_column_pairs(month_attendance_df)
                            existing_count = 0
                            if break_pairs:
                                start_col, end_col = break_pairs[0]
                                if start_col in month_attendance_df.columns and end_col in month_attendance_df.columns:
                                    def has_time(val):
                                        if isinstance(val, str):
                                            return val.strip() != ''
                                        return pd.notna(val)
                                    existing_mask = matching_rows[start_col].apply(has_time) | matching_rows[end_col].apply(has_time)
                                    existing_count = int(existing_mask.sum())
                            
                            st.info(f"対象レコード: {len(matching_rows)}件 / 休憩1・復帰1が設定済み: {existing_count}件")
                            
                            overridden_df, overridden_rows, overridden_slots = bulk_override_break_times(
                                month_attendance_df,
                                st.session_state.selected_employees_export,
                                target_month_str,
                                new_start_formatted,
                                new_end_formatted
                            )
                            
                            download_df = overridden_df[
                                build_employee_month_mask(
                                    overridden_df,
                                    st.session_state.selected_employees_export,
                                    target_month_str
                                )
                            ].copy()
                            
                            if download_df.empty:
                                st.warning("指定された従業員に該当するデータがありませんでした。空のCSVを出力します。")
                            csv_bytes = dataframe_to_jinjer_csv_bytes(
                                download_df,
                                column_order=list(month_attendance_df.columns)
                            )
                            
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            filename = f"休憩時間一括変更_{target_month_str}_{timestamp}.csv"
                            
                            st.download_button(
                                label="📥 CSVファイルをダウンロード",
                                data=csv_bytes,
                                file_name=filename,
                                mime="text/csv",
                                help=f"休憩時間を{new_start_formatted}〜{new_end_formatted}に統一した勤怠CSV",
                                key="download_break_bulk"
                            )
                            
                            if overridden_rows > 0:
                                st.success(f"✅ {overridden_rows}件のレコードで休憩枠（{overridden_slots}枠）を{new_start_formatted}〜{new_end_formatted}に変更しました。ダウンロードでは選択した従業員のみを出力しています。")
                            else:
                                st.info("変更対象の休憩1/復帰1が見つかりませんでした。元の値のまま出力します。")
                            
                            if debug_mode:
                                mask = build_employee_month_mask(
                                    overridden_df,
                                    st.session_state.selected_employees_export,
                                    target_month_str
                                )
                                if mask.any():
                                    name_col = resolve_column(overridden_df, '名前', fallback_suffix='名前')
                                    date_col = resolve_column(overridden_df, '*年月日', fallback_suffix='年月日')
                                    preview_pairs = get_break_column_pairs(overridden_df)[:3]
                                    preview_cols = [
                                        col for col in [name_col, date_col] if col and col in overridden_df.columns
                                    ]
                                    preview_cols += [
                                        col for pair in preview_pairs for col in pair if col in overridden_df.columns
                                    ]
                                    st.dataframe(overridden_df.loc[mask, preview_cols].head(), use_container_width=True)
                        except Exception as e:
                            st.error(f"休憩時間一括変更中にエラーが発生しました: {str(e)}")

        st.write("")

        st.markdown("#### 🕛 24時間データCSV")
        st.caption("選択した従業員・対象月の全シフトを0:00〜24:00として出力します。")
        if st.button("🕛 24時間データCSVを生成", key="export_full_day"):
            if not st.session_state.selected_employees_export:
                st.error("先に従業員を選択してください。")
            else:
                with st.spinner("24時間データCSVを生成しています..."):
                    try:
                        csv_content = generate_0_24_jinjer_csv(
                            st.session_state.selected_employees_export,
                            target_month_str,
                            month_attendance_df
                        )
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"24時間データ_{target_month_str}_{timestamp}.csv"
                        st.download_button(
                            label="📥 CSVファイルをダウンロード",
                            data=csv_content.encode('shift_jis', errors='ignore'),
                            file_name=filename,
                            mime="text/csv",
                            help="全日0:00〜24:00の勤怠データCSV",
                            key="download_full_day"
                        )
                        st.success(f"✅ {len(st.session_state.selected_employees_export)}名分の24時間データCSVを生成しました。")
                        lines = csv_content.count('\n') - 1
                        st.info(f"📊 出力詳細: {lines}行のデータ（ヘッダー含む{lines + 1}行）")
                    except Exception as e:
                        st.error(f"24時間データCSV生成中にエラーが発生しました: {str(e)}")
        
        # 一括削除CSVセクション
        st.write("")
        st.markdown("#### 🗑️ 一括削除CSV")
        st.caption("選択した従業員・対象月の出勤/退勤カラムをすべて Null で出力します。操作前に必ず確認してください。")
        
        if 'delete_confirm_emps' not in st.session_state:
            st.session_state.delete_confirm_emps = []
        if 'delete_csv_bytes' not in st.session_state:
            st.session_state.delete_csv_bytes = None
        if 'delete_csv_filename' not in st.session_state:
            st.session_state.delete_csv_filename = ''
        
        # 選択外の従業員が含まれている場合はリセット
        if st.session_state.delete_confirm_emps:
            current_set = set(st.session_state.selected_employees_export)
            if not current_set.issuperset(st.session_state.delete_confirm_emps):
                st.session_state.delete_confirm_emps = []
                st.session_state.delete_csv_bytes = None
                st.session_state.delete_csv_filename = ''
        
        if st.button("🗑️ 一括削除CSVの確認に進む", key="prepare_delete_csv"):
            if not st.session_state.selected_employees_export:
                st.error("先に従業員を選択してください。")
            else:
                st.session_state.delete_confirm_emps = list(st.session_state.selected_employees_export)
                st.session_state.delete_csv_bytes = None
                st.session_state.delete_csv_filename = ''
        
        if st.session_state.delete_confirm_emps:
            st.warning("下記の従業員で出勤/退勤を Null にします。必ず確認してください。")
            for emp in st.session_state.delete_confirm_emps:
                st.write(f"- {emp}")
            
            col_confirm, col_cancel = st.columns([1, 1])
            with col_confirm:
                if st.button("✅ 上記の従業員でCSV生成", key="confirm_delete_csv"):
                    try:
                        csv_content = generate_delete_attendance_csv(
                            st.session_state.delete_confirm_emps,
                            target_month_str,
                            month_attendance_df
                        )
                        st.session_state.delete_csv_bytes = csv_content.encode('shift_jis', errors='ignore')
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        st.session_state.delete_csv_filename = f"勤怠一括削除_{target_month_str}_{timestamp}.csv"
                        st.success("✅ CSVを生成しました。ダウンロードボタンから保存できます。")
                    except Exception as e:
                        st.error(f"一括削除CSV生成中にエラーが発生しました: {str(e)}")
            with col_cancel:
                if st.button("キャンセル", key="cancel_delete_csv"):
                    st.session_state.delete_confirm_emps = []
                    st.session_state.delete_csv_bytes = None
                    st.session_state.delete_csv_filename = ''
                    st.info("一括削除の操作をキャンセルしました。")
            
            if st.session_state.delete_csv_bytes:
                st.download_button(
                    label="📥 一括削除CSVをダウンロード",
                    data=st.session_state.delete_csv_bytes,
                    file_name=st.session_state.delete_csv_filename or "勤怠一括削除.csv",
                    mime="text/csv",
                    key="download_delete_csv"
                )
        
        elif st.session_state.delete_csv_bytes:
            # 状態がリセットされた場合の安全対策
            st.session_state.delete_csv_bytes = None
            st.session_state.delete_csv_filename = ''
            
    except FileNotFoundError:
        st.error("勤怠履歴.csvファイルが見つかりません。inputフォルダに配置してください。")
    except Exception as e:
        st.error(f"データ読み込みエラー: {str(e)}")

if __name__ == "__main__":
    show_optimal_attendance_export()

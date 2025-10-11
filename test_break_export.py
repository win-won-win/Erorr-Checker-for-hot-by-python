#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import io
import pandas as pd

from optimal_attendance_export import (
    auto_round_break_times,
    dataframe_to_jinjer_csv_bytes,
    generate_0_24_jinjer_csv,
    generate_delete_attendance_csv,
)


def test_break_export_preserves_non_break_columns():
    original_columns = [
        '名前', '*年月日', 'スケジュール雛形ID',
        '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
        '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由',
        '出勤1', '退勤1',
        '休憩1', '復帰1', '直行1', '直帰1', '打刻区分ID:1', 'メモ'
    ]
    source_df = pd.DataFrame(
        [{
            '名前': 'テスト太郎',
            '*年月日': '2024-05-01',
            'スケジュール雛形ID': 'TMP-01',
            '休日休暇名1': '休暇A',
            '休日休暇名1：種別': '有給',
            '休日休暇名1：開始時間': '09:00',
            '休日休暇名1：終了時間': '18:00',
            '休日休暇名1：理由': 'テスト理由1',
            '休日休暇名2': '休暇B',
            '休日休暇名2：種別': '代休',
            '休日休暇名2：開始時間': '09:00',
            '休日休暇名2：終了時間': '18:00',
            '休日休暇名2：理由': 'テスト理由2',
            '出勤1': '9:00',
            '退勤1': '18:00',
            '休憩1': '12:10',
            '復帰1': '12:40',
            '直行1': '10:00',
            '直帰1': '19:00',
            '打刻区分ID:1': 'TRUE',
            'メモ': 'そのまま',
        }],
        columns=original_columns,
    )

    adjusted_df, rounded_rows, rounded_slots = auto_round_break_times(source_df)

    assert rounded_rows == 1
    assert rounded_slots == 1
    # 元のDataFrameは変更されない
    assert source_df.at[0, '休憩1'] == '12:10'
    assert source_df.at[0, '復帰1'] == '12:40'

    csv_bytes = dataframe_to_jinjer_csv_bytes(
        adjusted_df,
        column_order=original_columns,
    )

    exported_df = pd.read_csv(io.BytesIO(csv_bytes), encoding='shift_jis', keep_default_na=False)

    assert list(exported_df.columns) == original_columns
    for col in ['名前', '*年月日', '出勤1', '退勤1', 'メモ']:
        assert exported_df.at[0, col] == source_df.at[0, col]

    assert exported_df.at[0, 'スケジュール雛形ID'] == ''
    holiday_cols = [
        '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
        '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由',
    ]
    for col in holiday_cols:
        assert exported_df.at[0, col] == ''
    assert exported_df.at[0, '休憩1'] == '12:00'
    assert exported_df.at[0, '復帰1'] == '12:30'
    assert exported_df.at[0, '直行1'] == ''
    assert exported_df.at[0, '直帰1'] == ''
    assert exported_df.at[0, '打刻区分ID:1'] == ''


def test_zero_twentyfour_csv_blanks_extra_shifts():
    attendance_df = pd.DataFrame({
        '名前': ['テスト太郎'],
        '*従業員ID': ['E001'],
        '*年月日': ['2025-01-01'],
        '出勤1': ['8:00'],
        '退勤1': ['17:00'],
        '出勤2': ['18:00'],
        '退勤2': ['20:00'],
    })

    csv_content = generate_0_24_jinjer_csv(['テスト太郎'], '2025-01', attendance_df)
    lines = csv_content.strip().split('\n')
    assert len(lines) >= 2
    headers = lines[0].split(',')
    row = lines[1].split(',')

    start_idx = headers.index('出勤1')
    assert row[start_idx] == '0:00'
    assert row[start_idx + 1] == '24:00'
    for shift_idx in range(1, 10):
        base = start_idx + shift_idx * 2
        if base < len(row):
            assert row[base] == ''
        if base + 1 < len(row):
            assert row[base + 1] == ''


def test_delete_csv_sets_all_null():
    attendance_df = pd.DataFrame({
        '名前': ['テスト太郎', 'テスト太郎'],
        '*従業員ID': ['E001', 'E001'],
        '*年月日': ['2025-01-01', '2025-01-02'],
        '出勤1': ['8:00', ''],
        '退勤1': ['17:00', ''],
        '出勤2': ['18:00', ''],
        '退勤2': ['20:00', ''],
        '出勤3': ['', ''],
        '退勤3': ['', ''],
    })

    csv_content = generate_delete_attendance_csv(['テスト太郎'], '2025-01', attendance_df)
    df = pd.read_csv(io.StringIO(csv_content), keep_default_na=False)

    row1 = df[df['*年月日'] == '2025-01-01'].iloc[0]
    assert row1['出勤1'] == 'Null'
    assert row1['退勤1'] == 'Null'
    assert row1['出勤2'] == 'Null'
    assert row1['退勤2'] == 'Null'
    assert row1['出勤3'] == ''
    assert row1['退勤3'] == ''

    row2 = df[df['*年月日'] == '2025-01-02'].iloc[0]
    assert row2['出勤1'] == ''
    assert row2['退勤1'] == ''
    assert row2['出勤2'] == ''
    assert row2['退勤2'] == ''

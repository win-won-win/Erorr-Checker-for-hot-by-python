#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最適勤怠データ出力機能のテスト
修正された機能をテストする
"""

import pandas as pd
from datetime import datetime
import os
import sys

# optimal_attendance_export.pyの機能をインポート
from optimal_attendance_export import (
    merge_overlapping_shifts,
    get_attendance_shifts,
    load_service_data_from_session,
    aggregate_daily_service_times,
    time_to_minutes,
    minutes_to_time
)

def test_merge_overlapping_shifts():
    """1時間半ルールのテスト"""
    print("=== 1時間半ルール（merge_overlapping_shifts）のテスト ===")
    
    # テストケース1: READMEの例
    shifts1 = [
        {'work_start': '0:00', 'work_end': '0:30'},
        {'work_start': '1:00', 'work_end': '2:00'},
        {'work_start': '4:00', 'work_end': '5:00'},
        {'work_start': '7:00', 'work_end': '8:00'},
        {'work_start': '8:00', 'work_end': '9:00'}
    ]
    
    result1 = merge_overlapping_shifts(shifts1)
    print(f"入力: {shifts1}")
    print(f"出力: {result1}")
    expected1 = [{'work_start': '0:00', 'work_end': '5:00'}, {'work_start': '7:00', 'work_end': '9:00'}]
    print(f"期待値: {expected1}")
    
    # テストケース2: 1時間半未満の間隔
    shifts2 = [
        {'work_start': '9:00', 'work_end': '10:00'},
        {'work_start': '10:30', 'work_end': '11:30'}  # 30分間隔（90分未満）
    ]
    
    result2 = merge_overlapping_shifts(shifts2)
    print(f"\n入力: {shifts2}")
    print(f"出力: {result2}")
    expected2 = [{'work_start': '9:00', 'work_end': '11:30'}]
    print(f"期待値: {expected2} (結合される)")
    
    # テストケース3: 1時間半以上の間隔
    shifts3 = [
        {'work_start': '9:00', 'work_end': '10:00'},
        {'work_start': '12:00', 'work_end': '13:00'}  # 2時間間隔（90分以上）
    ]
    
    result3 = merge_overlapping_shifts(shifts3)
    print(f"\n入力: {shifts3}")
    print(f"出力: {result3}")
    expected3 = [{'work_start': '9:00', 'work_end': '10:00'}, {'work_start': '12:00', 'work_end': '13:00'}]
    print(f"期待値: {expected3} (結合されない)")

def test_time_conversion():
    """時間変換関数のテスト"""
    print("\n=== 時間変換関数のテスト ===")
    
    test_cases = [
        ('0:00', 0),
        ('1:30', 90),
        ('24:00', 1440),
        ('8:15', 495)
    ]
    
    for time_str, expected_minutes in test_cases:
        result = time_to_minutes(time_str)
        print(f"{time_str} -> {result}分 (期待値: {expected_minutes}分)")

    overnight_end = time_to_minutes('1:00', True, '23:30')
    print(f"23:30-1:00 の退勤 -> {overnight_end}分 (期待値: 1500分)")
        
    # 逆変換テスト
    for time_str, minutes in test_cases:
        result = minutes_to_time(minutes)
        print(f"{minutes}分 -> {result} (期待値: {time_str})")

def test_attendance_shifts():
    """勤怠履歴からのシフト取得テスト"""
    print("\n=== 勤怠履歴からのシフト取得テスト ===")
    
    # サンプル勤怠データを作成
    attendance_data = pd.DataFrame({
        '名前': ['テスト太郎', 'テスト太郎', 'テスト花子'],
        '*年月日': ['2024-01-01', '2024-01-02', '2024-01-01'],
        '出勤1': ['9:00', '8:30', '10:00'],
        '退勤1': ['17:00', '16:30', '18:00'],
        '出勤2': ['', '19:00', ''],
        '退勤2': ['', '21:00', '']
    })
    
    # テスト太郎の2024-01-01のシフト取得
    shifts1 = get_attendance_shifts(attendance_data, 'テスト太郎', '2024-01-01')
    print(f"テスト太郎 2024-01-01: {shifts1}")
    
    # テスト太郎の2024-01-02のシフト取得（2シフト）
    shifts2 = get_attendance_shifts(attendance_data, 'テスト太郎', '2024-01-02')
    print(f"テスト太郎 2024-01-02: {shifts2}")
    
    # 存在しない従業員・日付
    shifts3 = get_attendance_shifts(attendance_data, '存在しない', '2024-01-01')
    print(f"存在しない従業員: {shifts3}")

def main():
    """メインテスト関数"""
    print("最適勤怠データ出力機能のテスト開始")
    print("=" * 50)
    
    try:
        test_time_conversion()
        test_merge_overlapping_shifts()
        test_attendance_shifts()
        
        print("\n" + "=" * 50)
        print("✅ 全てのテストが完了しました")
        
    except Exception as e:
        print(f"\n❌ テスト中にエラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

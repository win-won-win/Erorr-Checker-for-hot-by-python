#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
サービス実績データからの最適化機能をテストするスクリプト
"""

import pandas as pd
import os
import tempfile
from datetime import datetime
from optimal_attendance_export import (
    load_service_data_from_results,
    aggregate_daily_service_times,
    merge_overlapping_shifts,
    generate_jinjer_csv
)

def create_test_result_csv(workdir: str):
    """テスト用のresult_*.csvファイルを作成"""
    test_data = [
        {
            'エラー': '',
            'カテゴリ': '',
            '担当所員': 'テスト太郎',
            '利用者名': '利用者A',
            '日付': '2025-01-15',
            '開始時間': '9:00',
            '終了時間': '10:00',
            'サービス内容': '身体介護',
            '実施時間': '60分'
        },
        {
            'エラー': '',
            'カテゴリ': '',
            '担当所員': 'テスト太郎',
            '利用者名': '利用者B',
            '日付': '2025-01-15',
            '開始時間': '10:30',
            '終了時間': '12:00',
            'サービス内容': '生活援助',
            '実施時間': '90分'
        },
        {
            'エラー': '',
            'カテゴリ': '',
            '担当所員': 'テスト太郎',
            '利用者名': '利用者C',
            '日付': '2025-01-15',
            '開始時間': '14:00',
            '終了時間': '15:30',
            'サービス内容': '身体介護',
            '実施時間': '90分'
        },
        {
            'エラー': '',
            'カテゴリ': '',
            '担当所員': 'テスト花子',
            '利用者名': '利用者D',
            '日付': '2025-01-15',
            '開始時間': '8:00',
            '終了時間': '9:00',
            'サービス内容': '身体介護',
            '実施時間': '60分'
        }
    ]
    
    df = pd.DataFrame(test_data)
    result_file = os.path.join(workdir, 'result_test_facility.csv')
    df.to_csv(result_file, index=False, encoding='utf-8-sig')
    return result_file

def create_test_attendance_csv():
    """テスト用の勤怠データを作成"""
    test_attendance = pd.DataFrame({
        '名前': ['テスト太郎', 'テスト花子'],
        '*従業員ID': ['EMP001', 'EMP002']
    })
    return test_attendance

def test_service_data_loading():
    """サービス実績データ読み込みのテスト"""
    print("=== サービス実績データ読み込みテスト ===")
    
    # 一時ディレクトリを作成
    with tempfile.TemporaryDirectory() as temp_dir:
        # テスト用CSVファイルを作成
        result_file = create_test_result_csv(temp_dir)
        print(f"テスト用CSVファイル作成: {result_file}")
        
        # サービス実績データを読み込み
        service_df = load_service_data_from_results(temp_dir)
        
        print(f"読み込まれたサービス実績数: {len(service_df)}")
        print("サービス実績データ:")
        for _, row in service_df.iterrows():
            print(f"  {row['employee']} - {row['date']} {row['start_time']}-{row['end_time']}")
        
        # 期待される結果の確認
        expected_count = 4  # テスト太郎3件 + テスト花子1件
        if len(service_df) == expected_count:
            print("✅ サービス実績データ読み込み成功")
        else:
            print(f"❌ サービス実績データ読み込み失敗: 期待{expected_count}件、実際{len(service_df)}件")
    
    print()

def test_daily_service_aggregation():
    """日別サービス時間集計のテスト"""
    print("=== 日別サービス時間集計テスト ===")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        create_test_result_csv(temp_dir)
        service_df = load_service_data_from_results(temp_dir)
        
        # テスト太郎の2025-01-15のサービス時間を集計
        shifts = aggregate_daily_service_times(service_df, 'テスト太郎', '2025-01-15')
        
        print("テスト太郎の2025-01-15のサービス時間:")
        for i, shift in enumerate(shifts, 1):
            print(f"  シフト{i}: {shift['work_start']} - {shift['work_end']}")
        
        # 期待される結果: 3つのシフト
        expected_shifts = [
            {'work_start': '9:00', 'work_end': '10:00'},
            {'work_start': '10:30', 'work_end': '12:00'},
            {'work_start': '14:00', 'work_end': '15:30'}
        ]
        
        if len(shifts) == len(expected_shifts):
            print("✅ 日別サービス時間集計成功")
        else:
            print(f"❌ 日別サービス時間集計失敗: 期待{len(expected_shifts)}件、実際{len(shifts)}件")
    
    print()

def test_service_optimization():
    """サービス時間最適化のテスト"""
    print("=== サービス時間最適化テスト ===")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        create_test_result_csv(temp_dir)
        service_df = load_service_data_from_results(temp_dir)
        
        # テスト太郎の2025-01-15のサービス時間を集計
        shifts = aggregate_daily_service_times(service_df, 'テスト太郎', '2025-01-15')
        
        print("最適化前のシフト:")
        for i, shift in enumerate(shifts, 1):
            print(f"  シフト{i}: {shift['work_start']} - {shift['work_end']}")
        
        # 1時間半ルールで最適化
        optimized_shifts = merge_overlapping_shifts(shifts)
        
        print("最適化後のシフト:")
        for i, shift in enumerate(optimized_shifts, 1):
            print(f"  シフト{i}: {shift['work_start']} - {shift['work_end']}")
        
        # 期待される結果: 9:00-12:00（30分間隔で結合）, 14:00-15:30（独立）
        print("期待結果: 9:00-12:00, 14:00-15:30 (2つのシフト)")
        
        if len(optimized_shifts) == 2:
            print("✅ サービス時間最適化成功")
        else:
            print(f"❌ サービス時間最適化失敗: 期待2件、実際{len(optimized_shifts)}件")
    
    print()

def test_csv_generation_with_service_data():
    """サービス実績データベースのCSV生成テスト"""
    print("=== サービス実績データベースCSV生成テスト ===")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        create_test_result_csv(temp_dir)
        attendance_df = create_test_attendance_csv()
        
        try:
            # サービス実績データベースのCSV生成
            csv_content = generate_jinjer_csv(
                ['テスト太郎'],
                '2025-01',
                attendance_df,
                temp_dir
            )
            
            lines = csv_content.split('\n')
            print(f"生成されたCSV行数: {len(lines) - 1}")  # 最後の空行を除く
            
            # ヘッダー確認
            headers = lines[0].split(',')
            print(f"ヘッダー数: {len(headers)}")
            
            # サンプル行の確認（2025-01-15のデータ）
            sample_found = False
            for line in lines[1:]:
                if '2025-01-15' in line:
                    sample_row = line.split(',')
                    print(f"2025-01-15のデータ:")
                    print(f"  出勤1: {sample_row[21] if len(sample_row) > 21 else 'N/A'}")
                    print(f"  退勤1: {sample_row[22] if len(sample_row) > 22 else 'N/A'}")
                    print(f"  出勤2: {sample_row[23] if len(sample_row) > 23 else 'N/A'}")
                    print(f"  退勤2: {sample_row[24] if len(sample_row) > 24 else 'N/A'}")
                    sample_found = True
                    break
            
            if sample_found:
                print("✅ サービス実績データベースCSV生成成功")
            else:
                print("❌ 2025-01-15のデータが見つかりません")
                
        except Exception as e:
            print(f"❌ CSV生成エラー: {e}")
    
    print()

def main():
    """メインテスト実行"""
    print("🧪 サービス実績データからの最適化機能テスト")
    print("=" * 60)
    
    test_service_data_loading()
    test_daily_service_aggregation()
    test_service_optimization()
    test_csv_generation_with_service_data()
    
    print("=" * 60)
    print("✅ テスト完了")
    print("\n新機能:")
    print("1. エラーチェック結果からサービス実績データを抽出")
    print("2. 従業員ごと・日別のサービス時間を集計")
    print("3. 1時間半ルールでサービス時間を最適化")
    print("4. 最適化されたサービス時間でjinjer形式CSV生成")

if __name__ == "__main__":
    main()
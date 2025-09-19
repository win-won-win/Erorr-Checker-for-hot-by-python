#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重複サービス時間機能のテスト
"""
import pandas as pd
from datetime import datetime
from src import OverlapInfo, update_overlap_details_in_csv

def test_overlap_service_time():
    """重複サービス時間の記録機能をテスト"""
    
    # テスト用のDataFrameを作成
    df = pd.DataFrame({
        '重複時間（分）': [0],
        '重複相手施設': [''],
        '重複相手担当者': [''],
        '重複タイプ': [''],
        '重複サービス時間': ['']
    })
    
    # テスト用のOverlapInfoを作成
    overlap_info1 = OverlapInfo(
        idx1=0,
        idx2=1,
        facility1="施設A",
        facility2="施設B",
        staff1="田中太郎",
        staff2="佐藤花子",
        start1=datetime(2024, 1, 1, 8, 0),
        end1=datetime(2024, 1, 1, 10, 0),
        start2=datetime(2024, 1, 1, 9, 0),
        end2=datetime(2024, 1, 1, 11, 0),
        overlap_start=datetime(2024, 1, 1, 9, 0),
        overlap_end=datetime(2024, 1, 1, 10, 0),
        overlap_minutes=60,
        overlap_type="部分重複"
    )
    
    # 最初の重複を記録
    update_overlap_details_in_csv(df, 0, overlap_info1, "施設B")
    
    print("1回目の重複記録後:")
    print(f"重複サービス時間: {df.at[0, '重複サービス時間']}")
    
    # 2つ目の重複を作成（異なる時間帯）
    overlap_info2 = OverlapInfo(
        idx1=0,
        idx2=2,
        facility1="施設A",
        facility2="施設C",
        staff1="田中太郎",
        staff2="山田次郎",
        start1=datetime(2024, 1, 1, 14, 0),
        end1=datetime(2024, 1, 1, 16, 0),
        start2=datetime(2024, 1, 1, 15, 30),
        end2=datetime(2024, 1, 1, 17, 0),
        overlap_start=datetime(2024, 1, 1, 15, 30),
        overlap_end=datetime(2024, 1, 1, 16, 0),
        overlap_minutes=30,
        overlap_type="部分重複"
    )
    
    # 2つ目の重複を記録
    update_overlap_details_in_csv(df, 0, overlap_info2, "施設C")
    
    print("2回目の重複記録後:")
    print(f"重複サービス時間: {df.at[0, '重複サービス時間']}")
    
    # 期待される結果をチェック
    expected_times = "09:00-10:00｜15:30-16:00"
    actual_times = df.at[0, '重複サービス時間']
    
    print(f"\n期待値: {expected_times}")
    print(f"実際値: {actual_times}")
    
    if actual_times == expected_times:
        print("✅ テスト成功: 重複サービス時間が正しく記録されました")
        return True
    else:
        print("❌ テスト失敗: 重複サービス時間の記録に問題があります")
        return False

if __name__ == "__main__":
    test_overlap_service_time()
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
サービス実績データ統合処理のテスト
複数のサービス実績CSVからの統合処理をテストする
"""

import pandas as pd
import streamlit as st
from datetime import datetime
import sys
import os

# optimal_attendance_export.pyの機能をインポート
from optimal_attendance_export import (
    load_service_data_from_session,
    aggregate_daily_service_times,
    merge_overlapping_shifts
)

def create_test_service_data():
    """テスト用のサービス実績データを作成"""
    # サービス実績データA（施設A）
    service_a = pd.DataFrame({
        '担当所員': ['田中太郎', '田中太郎', '佐藤花子'],
        '日付': ['2024-01-01', '2024-01-01', '2024-01-01'],
        '開始時間': ['9:00', '14:00', '10:00'],
        '終了時間': ['12:00', '16:00', '15:00'],
        'サービス内容': ['訪問介護', '訪問介護', '訪問介護']
    })
    
    # サービス実績データB（施設B）
    service_b = pd.DataFrame({
        '担当者': ['田中太郎', '田中太郎', '山田次郎'],
        'サービス提供日': ['2024-01-01', '2024-01-01', '2024-01-01'],
        'サービス開始時間': ['13:00', '17:00', '8:00'],
        'サービス終了時間': ['13:30', '19:00', '12:00'],
        '内容': ['デイサービス', 'デイサービス', 'デイサービス']
    })
    
    return [service_a, service_b]

def test_service_integration():
    """サービス実績データ統合のテスト"""
    print("=== サービス実績データ統合テスト ===")
    
    # テストデータを作成
    test_data = create_test_service_data()
    
    # セッション状態をシミュレート
    class MockSessionState:
        def __init__(self):
            self.service_data_list = test_data
            self.debug_mode = True
        
        def get(self, key, default=None):
            return getattr(self, key, default)
    
    # Streamlitのセッション状態をモック
    if not hasattr(st, 'session_state'):
        st.session_state = MockSessionState()
    else:
        st.session_state.service_data_list = test_data
        st.session_state.debug_mode = True
    
    # 統合処理をテスト
    try:
        integrated_df = load_service_data_from_session()
        print(f"統合されたデータ: {len(integrated_df)}行")
        print(f"カラム: {integrated_df.columns.tolist()}")
        
        if not integrated_df.empty:
            print("\n統合データの内容:")
            for _, row in integrated_df.iterrows():
                print(f"  {row['employee']} {row['date']} {row['start_time']}-{row['end_time']}")
            
            # 田中太郎の2024-01-01のシフトを取得
            shifts = aggregate_daily_service_times(integrated_df, '田中太郎', '2024-01-01')
            print(f"\n田中太郎 2024-01-01のシフト: {len(shifts)}個")
            for i, shift in enumerate(shifts):
                print(f"  シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            
            # 1時間半ルールで最適化
            optimized_shifts = merge_overlapping_shifts(shifts)
            print(f"\n最適化後のシフト: {len(optimized_shifts)}個")
            for i, shift in enumerate(optimized_shifts):
                print(f"  最適化シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            
            # 期待される結果の確認
            expected_shifts = [
                {'work_start': '9:00', 'work_end': '16:00'},  # 9:00-12:00 + 13:00-13:30 + 14:00-16:00 が結合
                {'work_start': '17:00', 'work_end': '19:00'}  # 17:00-19:00 は独立
            ]
            
            print(f"\n期待される結果: {expected_shifts}")
            
            # 結果の検証
            if len(optimized_shifts) == len(expected_shifts):
                print("✅ シフト数が期待値と一致")
            else:
                print(f"❌ シフト数が期待値と不一致: 実際={len(optimized_shifts)}, 期待={len(expected_shifts)}")
        
        else:
            print("❌ 統合データが空です")
            
    except Exception as e:
        print(f"❌ エラーが発生しました: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    """メインテスト関数"""
    print("サービス実績データ統合処理のテスト開始")
    print("=" * 50)
    
    test_service_integration()
    
    print("\n" + "=" * 50)
    print("テスト完了")

if __name__ == "__main__":
    main()
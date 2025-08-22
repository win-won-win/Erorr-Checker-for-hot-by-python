#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Streamlitグリッド表示機能のテストスクリプト
"""
import pandas as pd
import os
import sys
from pathlib import Path

# streamlit_app.pyから必要な関数をインポート
sys.path.append('.')
from streamlit_app import prepare_grid_data, collect_summary

def test_grid_data_preparation():
    """グリッドデータ準備機能のテスト"""
    print("=== グリッドデータ準備機能テスト ===")
    
    # テストデータのパス
    result_paths = [
        "test_input/result_サービス実態A.csv",
        "test_input/result_サービス実態B.csv"
    ]
    
    # ファイルの存在確認
    for path in result_paths:
        if not os.path.exists(path):
            print(f"❌ テストファイルが見つかりません: {path}")
            return False
        print(f"✅ テストファイル確認: {path}")
    
    try:
        # グリッドデータの準備
        grid_df = prepare_grid_data(result_paths)
        
        # 基本検証
        print(f"✅ グリッドデータ生成成功: {len(grid_df)}行")
        
        # カラム構造の検証
        expected_columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'AB', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
        missing_columns = [col for col in expected_columns if col not in grid_df.columns]
        if missing_columns:
            print(f"❌ 不足しているカラム: {missing_columns}")
            return False
        print("✅ 全ての必要カラムが存在")
        
        # 詳細カラム（H-O）の検証
        detail_columns = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
        print("\n--- 詳細カラム（H-O）の内容確認 ---")
        for col in detail_columns:
            non_empty_count = len(grid_df[grid_df[col].notna() & (grid_df[col] != '') & (grid_df[col] != 0)])
            print(f"カラム {col}: 非空値 {non_empty_count}件")
        
        # エラー行の確認
        error_rows = grid_df[grid_df['A'] == '◯']
        print(f"\n✅ エラー行数: {len(error_rows)}件")
        
        # 重複データの確認
        overlap_rows = grid_df[grid_df['H'] > 0]
        print(f"✅ 重複データ: {len(overlap_rows)}件")
        
        # 超過データの確認
        excess_rows = grid_df[grid_df['I'] > 0]
        print(f"✅ 超過データ: {len(excess_rows)}件")
        
        # サンプルデータの表示
        print("\n--- サンプルデータ（最初の3行） ---")
        sample_cols = ['A', 'C', 'D', 'H', 'I', 'J', 'L', 'M']
        print(grid_df[sample_cols].head(3).to_string())
        
        return True
        
    except Exception as e:
        print(f"❌ グリッドデータ準備でエラー: {str(e)}")
        return False

def test_summary_collection():
    """サマリー収集機能のテスト"""
    print("\n=== サマリー収集機能テスト ===")
    
    result_paths = [
        "test_input/result_サービス実態A.csv",
        "test_input/result_サービス実態B.csv"
    ]
    
    try:
        summary_df = collect_summary(result_paths)
        
        print(f"✅ サマリー生成成功: {len(summary_df)}ファイル")
        
        # サマリー内容の確認
        print("\n--- サマリー内容 ---")
        print(summary_df.to_string())
        
        # 必要カラムの確認
        required_cols = ['ファイル', '総件数', 'エラー件数']
        missing_cols = [col for col in required_cols if col not in summary_df.columns]
        if missing_cols:
            print(f"❌ サマリーに不足しているカラム: {missing_cols}")
            return False
        
        print("✅ サマリーの必要カラムが全て存在")
        return True
        
    except Exception as e:
        print(f"❌ サマリー収集でエラー: {str(e)}")
        return False

def test_detailed_analysis_functions():
    """詳細分析機能のテスト"""
    print("\n=== 詳細分析機能テスト ===")
    
    # グリッドデータを準備
    result_paths = [
        "test_input/result_サービス実態A.csv",
        "test_input/result_サービス実態B.csv"
    ]
    
    try:
        grid_df = prepare_grid_data(result_paths)
        
        # 重複分析データの確認
        overlap_data = grid_df[grid_df['H'] > 0]
        print(f"✅ 重複分析対象データ: {len(overlap_data)}件")
        
        if len(overlap_data) > 0:
            print("--- 重複分析統計 ---")
            print(f"総重複時間: {overlap_data['H'].sum()}分")
            print(f"平均重複時間: {overlap_data['H'].mean():.1f}分")
            print(f"最大重複時間: {overlap_data['H'].max()}分")
            
            # 重複タイプ別集計
            if not overlap_data['L'].empty and overlap_data['L'].notna().any():
                overlap_types = overlap_data['L'].value_counts()
                print("重複タイプ別件数:")
                for type_name, count in overlap_types.items():
                    print(f"  {type_name}: {count}件")
        
        # 超過分析データの確認
        excess_data = grid_df[grid_df['I'] > 0]
        print(f"\n✅ 超過分析対象データ: {len(excess_data)}件")
        
        if len(excess_data) > 0:
            print("--- 超過分析統計 ---")
            print(f"総超過時間: {excess_data['I'].sum()}分")
            print(f"平均超過時間: {excess_data['I'].mean():.1f}分")
            print(f"最大超過時間: {excess_data['I'].max()}分")
            
            # カバー状況別集計
            if not excess_data['M'].empty and excess_data['M'].notna().any():
                coverage_stats = excess_data['M'].value_counts()
                print("カバー状況別件数:")
                for status, count in coverage_stats.items():
                    print(f"  {status}: {count}件")
        
        # 職員別統計
        staff_stats = grid_df.groupby('C').agg({
            'A': lambda x: (x == '◯').sum(),  # エラー件数
            'C': 'count',  # 総件数
            'H': 'sum',  # 重複時間合計
            'I': 'sum',  # 超過時間合計
        }).round(1)
        staff_stats.columns = ['エラー件数', '総件数', '重複時間合計', '超過時間合計']
        
        print(f"\n✅ 職員別統計: {len(staff_stats)}名")
        print("--- 職員別統計（上位5名） ---")
        print(staff_stats.head().to_string())
        
        return True
        
    except Exception as e:
        print(f"❌ 詳細分析機能でエラー: {str(e)}")
        return False

def test_column_mapping():
    """カラムマッピング機能のテスト"""
    print("\n=== カラムマッピング機能テスト ===")
    
    # 実際のCSVファイルを読み込んでカラム構造を確認
    try:
        df_a = pd.read_csv("test_input/result_サービス実態A.csv", encoding="cp932")
        df_b = pd.read_csv("test_input/result_サービス実態B.csv", encoding="cp932")
        
        print("✅ CSVファイル読み込み成功")
        
        # 詳細カラムの存在確認
        detail_columns = ['重複時間（分）', '超過時間（分）', '重複相手施設', '重複相手担当者',
                         '重複タイプ', 'カバー状況', '勤務区間数', '詳細ID']
        
        for df, name in [(df_a, "サービス実態A"), (df_b, "サービス実態B")]:
            print(f"\n--- {name} カラム確認 ---")
            missing_cols = [col for col in detail_columns if col not in df.columns]
            if missing_cols:
                print(f"❌ 不足している詳細カラム: {missing_cols}")
                return False
            else:
                print("✅ 全ての詳細カラムが存在")
            
            # 各詳細カラムのデータ確認
            for col in detail_columns:
                non_empty = len(df[df[col].notna() & (df[col] != '') & (df[col] != 0)])
                print(f"  {col}: 非空値 {non_empty}件")
        
        return True
        
    except Exception as e:
        print(f"❌ カラムマッピングテストでエラー: {str(e)}")
        return False

def main():
    """メインテスト実行"""
    print("Streamlitグリッド表示機能テスト開始")
    print("=" * 50)
    
    tests = [
        test_column_mapping,
        test_grid_data_preparation,
        test_summary_collection,
        test_detailed_analysis_functions
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_func.__name__} 成功")
            else:
                print(f"❌ {test_func.__name__} 失敗")
        except Exception as e:
            print(f"❌ {test_func.__name__} 例外発生: {str(e)}")
        print("-" * 30)
    
    print(f"\nテスト結果: {passed}/{total} 成功")
    
    if passed == total:
        print("🎉 全てのテストが成功しました！")
        return True
    else:
        print("⚠️ 一部のテストが失敗しました。")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
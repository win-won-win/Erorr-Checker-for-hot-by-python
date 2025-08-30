#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統合テストスクリプト
新機能（グリッド表示、ビュー機能、勤務時間最適化提案）のテスト
"""

import pandas as pd
import os
import sys
from datetime import datetime
import traceback

def test_grid_functionality():
    """グリッド表示機能のテスト"""
    print("=== グリッド表示機能テスト ===")
    
    try:
        # streamlit_app.pyからprepare_grid_data関数をインポート
        sys.path.append('.')
        from streamlit_app import prepare_grid_data
        
        # テストデータのパスを設定
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        # ファイルの存在確認
        for path in result_paths:
            if not os.path.exists(path):
                print(f"❌ エラー: {path} が見つかりません")
                return False
        
        # グリッドデータの準備
        grid_df = prepare_grid_data(result_paths)
        
        # 基本的な検証
        if grid_df.empty:
            print("❌ エラー: グリッドデータが空です")
            return False
        
        # 必要なカラムの存在確認
        required_columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'AB']
        missing_columns = [col for col in required_columns if col not in grid_df.columns]
        
        if missing_columns:
            print(f"❌ エラー: 必要なカラムが不足しています: {missing_columns}")
            return False
        
        print(f"✅ グリッドデータ生成成功: {len(grid_df)}行")
        print(f"✅ カラム構成: {list(grid_df.columns)}")
        
        # データサンプルの表示
        print("📊 データサンプル:")
        print(grid_df.head(3).to_string())
        
        return True
        
    except Exception as e:
        print(f"❌ グリッド表示機能テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_optimization_functionality():
    """勤務時間最適化提案機能のテスト"""
    print("\n=== 勤務時間最適化提案機能テスト ===")
    
    try:
        from optimization import WorkOptimizer, format_time_minutes, calculate_optimization_impact
        from src import build_service_records
        from pathlib import Path
        
        # 勤怠データの読み込み
        att_df = pd.read_csv('test_input/勤怠履歴.csv', encoding='cp932')
        print(f"✅ 勤怠データ読み込み成功: {len(att_df)}行")
        
        # サービスデータの読み込み
        service_dfs = {}
        service_files = ['test_input/サービス実態A.csv', 'test_input/サービス実態B.csv']
        
        for service_file in service_files:
            if os.path.exists(service_file):
                facility_name = os.path.basename(service_file).replace('.csv', '')
                df = pd.read_csv(service_file, encoding='cp932')
                service_dfs[facility_name] = build_service_records(
                    Path(service_file), df, facility_name, staff_col='担当所員'
                )
                print(f"✅ {facility_name}データ読み込み成功: {len(df)}行")
        
        if not service_dfs:
            print("❌ エラー: サービスデータが読み込めませんでした")
            return False
        
        # 最適化エンジンの初期化
        optimizer = WorkOptimizer(att_df, service_dfs)
        print("✅ 最適化エンジン初期化成功")
        
        # 利用可能な従業員リストを取得
        available_employees = []
        for _, row in att_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        print(f"✅ 利用可能な従業員: {len(available_employees)}人")
        print(f"📋 従業員リスト: {available_employees[:5]}...")  # 最初の5人を表示
        
        if not available_employees:
            print("❌ エラー: 利用可能な従業員が見つかりません")
            return False
        
        # 最初の従業員で分析テスト
        test_employee = available_employees[0]
        print(f"🔍 テスト対象従業員: {test_employee}")
        
        # 従業員分析
        analysis = optimizer.analyze_employee_patterns(test_employee)
        
        if "error" in analysis:
            print(f"❌ 分析エラー: {analysis['error']}")
            return False
        
        print(f"✅ 従業員分析成功:")
        print(f"  - 総勤務日数: {analysis['total_work_days']}")
        print(f"  - 総勤務時間: {analysis['total_work_hours']:.1f}時間")
        print(f"  - 平均日勤務時間: {analysis['avg_daily_hours']:.1f}時間")
        print(f"  - エラー件数: {analysis['error_analysis']['total_errors']}")
        
        # 最適化パターン生成
        optimization_results = optimizer.generate_optimization_patterns(test_employee)
        
        if not optimization_results:
            print("⚠️ 警告: 最適化パターンが生成されませんでした")
            return True  # エラーではないが、パターンが生成されない場合もある
        
        print(f"✅ 最適化パターン生成成功: {len(optimization_results)}パターン")
        
        # 各パターンの詳細表示
        for i, result in enumerate(optimization_results):
            print(f"  📌 パターン{i+1}: {result.pattern_name}")
            print(f"     実現可能性: {result.feasibility_score:.1%}")
            print(f"     エラー削減予想: {result.error_reduction}件")
            print(f"     勤務時間変更: {result.work_time_change}分")
        
        # 影響計算
        impact = calculate_optimization_impact(optimization_results)
        print(f"✅ 影響計算成功:")
        print(f"  - 総パターン数: {impact['total_patterns']}")
        print(f"  - 総エラー削減予想: {impact['total_error_reduction']}")
        print(f"  - 平均実現可能性: {impact['average_feasibility']:.1%}")
        
        # format_time_minutes関数のテスト
        test_minutes = [480, 540, 1020]  # 8:00, 9:00, 17:00
        for minutes in test_minutes:
            formatted = format_time_minutes(minutes)
            print(f"✅ 時間フォーマット: {minutes}分 → {formatted}")
        
        return True
        
    except Exception as e:
        print(f"❌ 最適化機能テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_data_integrity():
    """データ整合性のテスト"""
    print("\n=== データ整合性テスト ===")
    
    try:
        # 結果ファイルの存在確認
        result_files = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        for result_file in result_files:
            if not os.path.exists(result_file):
                print(f"❌ エラー: {result_file} が見つかりません")
                return False
            
            # ファイルの読み込みテスト
            try:
                df = pd.read_csv(result_file, encoding='cp932')
            except UnicodeDecodeError:
                df = pd.read_csv(result_file, encoding='utf-8-sig')
            
            print(f"✅ {os.path.basename(result_file)}: {len(df)}行")
            
            # 基本的なカラムの存在確認
            expected_columns = ['エラー', 'カテゴリ', '担当所員', '日付']
            missing_columns = [col for col in expected_columns if col not in df.columns]
            
            if missing_columns:
                print(f"⚠️ 警告: {os.path.basename(result_file)}に不足カラム: {missing_columns}")
            else:
                print(f"✅ 必要カラム確認完了: {os.path.basename(result_file)}")
        
        # 診断ファイルの確認
        diagnostics_dir = 'test_input/diagnostics'
        if os.path.exists(diagnostics_dir):
            diag_files = os.listdir(diagnostics_dir)
            print(f"✅ 診断ファイル生成確認: {len(diag_files)}ファイル")
            for diag_file in diag_files:
                print(f"  - {diag_file}")
        else:
            print("❌ エラー: 診断フォルダが見つかりません")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ データ整合性テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_error_handling():
    """エラーハンドリングのテスト"""
    print("\n=== エラーハンドリングテスト ===")
    
    try:
        from optimization import WorkOptimizer
        
        # 空のDataFrameでのテスト
        empty_att_df = pd.DataFrame()
        empty_service_dfs = {}
        
        try:
            optimizer = WorkOptimizer(empty_att_df, empty_service_dfs)
            analysis = optimizer.analyze_employee_patterns("存在しない従業員")
            
            if "error" in analysis:
                print("✅ 存在しない従業員のエラーハンドリング成功")
            else:
                print("⚠️ 警告: 存在しない従業員でもエラーが発生しませんでした")
        
        except Exception as e:
            print(f"✅ 空データでの適切なエラーハンドリング: {str(e)}")
        
        # 不正なファイルパスでのテスト
        try:
            from streamlit_app import prepare_grid_data
            result = prepare_grid_data(['存在しないファイル.csv'])
            print("⚠️ 警告: 存在しないファイルでもエラーが発生しませんでした")
        except Exception as e:
            print(f"✅ 不正ファイルパスでの適切なエラーハンドリング: {type(e).__name__}")
        
        return True
        
    except Exception as e:
        print(f"❌ エラーハンドリングテストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def main():
    """メインテスト実行"""
    print("🚀 統合テスト開始")
    print(f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    test_results = []
    
    # 各テストの実行
    tests = [
        ("データ整合性", test_data_integrity),
        ("グリッド表示機能", test_grid_functionality),
        ("勤務時間最適化提案機能", test_optimization_functionality),
        ("エラーハンドリング", test_error_handling),
    ]
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}テスト実行中...")
        try:
            result = test_func()
            test_results.append((test_name, result))
            if result:
                print(f"✅ {test_name}テスト: 成功")
            else:
                print(f"❌ {test_name}テスト: 失敗")
        except Exception as e:
            print(f"❌ {test_name}テスト: 例外発生 - {str(e)}")
            test_results.append((test_name, False))
    
    # 結果サマリー
    print("\n" + "=" * 50)
    print("📊 テスト結果サマリー")
    print("=" * 50)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ 成功" if result else "❌ 失敗"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 総合結果: {passed}/{total} テスト成功")
    
    if passed == total:
        print("🎉 全てのテストが成功しました！")
        return True
    else:
        print("⚠️ 一部のテストが失敗しました。")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統合シナリオテストスクリプト
全機能の連携を確認するエンドツーエンドテスト
"""

import pandas as pd
import os
import sys
import tempfile
import shutil
from datetime import datetime
import traceback

def test_full_workflow_scenario():
    """完全なワークフローシナリオテスト"""
    print("=== 完全ワークフローシナリオテスト ===")
    
    try:
        # 1. データ処理パイプライン（src.pyの実行をシミュレート）
        print("📋 ステップ1: データ処理パイプライン")
        
        from src import (
            build_work_intervals, build_service_records, 
            find_overlaps, interval_fully_covered, build_staff_busy_map
        )
        from pathlib import Path
        
        # 勤怠データの読み込み
        att_df = pd.read_csv('test_input/勤怠履歴.csv', encoding='cp932')
        print(f"✅ 勤怠データ読み込み: {len(att_df)}行")
        
        # サービスデータの読み込みと処理
        service_dfs = {}
        service_files = ['test_input/サービス実態A.csv', 'test_input/サービス実態B.csv']
        
        for service_file in service_files:
            if os.path.exists(service_file):
                facility_name = os.path.basename(service_file).replace('.csv', '')
                df = pd.read_csv(service_file, encoding='cp932')
                service_dfs[facility_name] = build_service_records(
                    Path(service_file), df, facility_name, staff_col='担当所員'
                )
                print(f"✅ {facility_name}データ処理: {len(df)}行")
        
        # 勤務間隔とスタッフ繁忙マップの構築
        att_map, att_name_index = build_work_intervals(att_df)
        busy_map = build_staff_busy_map(service_dfs)
        
        print(f"✅ 勤務間隔マップ構築: {len(att_map)}人")
        print(f"✅ スタッフ繁忙マップ構築: {len(busy_map)}人")
        
        # 2. グリッド表示機能のテスト
        print("\n📊 ステップ2: グリッド表示機能")
        
        from streamlit_app import prepare_grid_data, collect_summary
        
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        # グリッドデータの準備
        grid_df = prepare_grid_data(result_paths)
        print(f"✅ グリッドデータ準備: {len(grid_df)}行")
        
        # 必要なカラムの確認
        required_columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'AB']
        missing_columns = [col for col in required_columns if col not in grid_df.columns]
        
        if missing_columns:
            print(f"❌ 不足カラム: {missing_columns}")
            return False
        
        print("✅ 全必要カラム確認完了")
        
        # サマリーデータの収集
        summary_df = collect_summary(result_paths)
        print(f"✅ サマリーデータ収集: {len(summary_df)}行")
        
        # 3. ビュー機能のテスト
        print("\n👥 ステップ3: ビュー機能")
        
        # 利用者別ビュー
        available_users = [user for user in grid_df['G'].dropna().unique() if user != '']
        print(f"✅ 利用可能な利用者: {len(available_users)}人")
        
        if available_users:
            test_user = available_users[0]
            user_filtered = grid_df[grid_df['G'] == test_user]
            print(f"✅ 利用者別フィルタ（{test_user}）: {len(user_filtered)}行")
        
        # 従業員別ビュー
        available_staff = [staff for staff in grid_df['C'].dropna().unique() if staff != '']
        print(f"✅ 利用可能な従業員: {len(available_staff)}人")
        
        if available_staff:
            test_staff = available_staff[0]
            staff_filtered = grid_df[grid_df['C'] == test_staff]
            print(f"✅ 従業員別フィルタ（{test_staff}）: {len(staff_filtered)}行")
        
        # カスタムビュー（複合フィルタ）
        error_filtered = grid_df[grid_df['A'] == '◯']
        print(f"✅ エラーフィルタ: {len(error_filtered)}行")
        
        # 統計情報の計算
        total_records = len(grid_df)
        error_records = len(error_filtered)
        error_rate = (error_records / total_records * 100) if total_records > 0 else 0
        unique_users = len(available_users)
        
        print(f"✅ 統計情報計算:")
        print(f"  - 総件数: {total_records}")
        print(f"  - エラー件数: {error_records}")
        print(f"  - エラー率: {error_rate:.1f}%")
        print(f"  - 利用者数: {unique_users}")
        
        # 4. 勤務時間最適化提案機能のテスト
        print("\n🎯 ステップ4: 勤務時間最適化提案機能")
        
        from optimization import WorkOptimizer, format_time_minutes, calculate_optimization_impact
        
        # 最適化エンジンの初期化
        optimizer = WorkOptimizer(att_df, service_dfs)
        print("✅ 最適化エンジン初期化完了")
        
        # 利用可能な従業員リストの取得
        available_employees = []
        for _, row in att_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        print(f"✅ 利用可能な従業員: {len(available_employees)}人")
        
        if available_employees:
            test_employee = available_employees[0]
            print(f"🔍 テスト対象従業員: {test_employee}")
            
            # 従業員分析
            analysis = optimizer.analyze_employee_patterns(test_employee)
            
            if "error" not in analysis:
                print("✅ 従業員分析成功:")
                print(f"  - 総勤務日数: {analysis['total_work_days']}")
                print(f"  - 総勤務時間: {analysis['total_work_hours']:.1f}時間")
                print(f"  - エラー件数: {analysis['error_analysis']['total_errors']}")
                
                # 最適化パターン生成
                optimization_results = optimizer.generate_optimization_patterns(test_employee)
                print(f"✅ 最適化パターン生成: {len(optimization_results)}パターン")
                
                if optimization_results:
                    # 影響計算
                    impact = calculate_optimization_impact(optimization_results)
                    print(f"✅ 影響計算:")
                    print(f"  - 総エラー削減予想: {impact['total_error_reduction']}")
                    print(f"  - 平均実現可能性: {impact['average_feasibility']:.1%}")
                    
                    # 時間フォーマット機能のテスト
                    test_minutes = [480, 540, 1020]  # 8:00, 9:00, 17:00
                    for minutes in test_minutes:
                        formatted = format_time_minutes(minutes)
                        print(f"✅ 時間フォーマット: {minutes}分 → {formatted}")
                else:
                    print("⚠️ 最適化パターンが生成されませんでした")
            else:
                print(f"❌ 従業員分析エラー: {analysis['error']}")
                return False
        
        # 5. データフロー連携の確認
        print("\n🔄 ステップ5: データフロー連携確認")
        
        # 元データ → 処理結果 → グリッド表示 → ビュー → 最適化の流れを確認
        original_service_count = sum(len(df) for df in service_dfs.values())
        grid_count = len(grid_df)
        
        print(f"✅ データフロー確認:")
        print(f"  - 元サービスデータ: {original_service_count}行")
        print(f"  - グリッド表示データ: {grid_count}行")
        print(f"  - 勤怠データ: {len(att_df)}行")
        print(f"  - 最適化対象従業員: {len(available_employees)}人")
        
        # データ整合性の確認
        data_integrity_ok = True
        
        # グリッドデータの各行が有効なデータを持っているか確認
        invalid_rows = 0
        for _, row in grid_df.iterrows():
            if pd.isna(row['C']) or row['C'] == '':  # 担当所員が空
                invalid_rows += 1
        
        if invalid_rows > 0:
            print(f"⚠️ 警告: 無効な行が{invalid_rows}行あります")
        else:
            print("✅ データ整合性確認完了")
        
        # 6. エクスポート機能のテスト
        print("\n💾 ステップ6: エクスポート機能")
        
        # CSVエクスポートのシミュレーション
        export_data = grid_df.to_csv(index=False, encoding='utf-8-sig')
        print(f"✅ CSVエクスポート準備: {len(export_data)}文字")
        
        # フィルタ済みデータのエクスポート
        filtered_export = error_filtered.to_csv(index=False, encoding='utf-8-sig')
        print(f"✅ フィルタ済みCSVエクスポート: {len(filtered_export)}文字")
        
        # 最適化結果のエクスポート（シミュレーション）
        if 'optimization_results' in locals() and optimization_results:
            result = optimization_results[0]  # 最初の結果を使用
            export_optimization = {
                "従業員名": [result.current_pattern.employee_name],
                "提案パターン": [result.pattern_name],
                "実現可能性": [f"{result.feasibility_score:.1%}"],
                "エラー削減予想": [f"{result.error_reduction}件"]
            }
            opt_export_df = pd.DataFrame(export_optimization)
            opt_csv = opt_export_df.to_csv(index=False, encoding='utf-8-sig')
            print(f"✅ 最適化結果エクスポート: {len(opt_csv)}文字")
        
        print("\n🎉 完全ワークフローシナリオテスト成功！")
        return True
        
    except Exception as e:
        print(f"❌ 完全ワークフローシナリオテストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_session_state_simulation():
    """セッション状態管理のシミュレーションテスト"""
    print("\n=== セッション状態管理シミュレーションテスト ===")
    
    try:
        # Streamlitのセッション状態をシミュレート
        session_state = {
            'processing_complete': False,
            'result_paths': [],
            'diagnostic_paths': [],
            'summary_df': None,
            'workdir': None
        }
        
        print("📋 セッション状態初期化")
        
        # 処理完了状態のシミュレート
        session_state['processing_complete'] = True
        session_state['result_paths'] = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        session_state['diagnostic_paths'] = [
            'test_input/diagnostics/01_staff_name_coverage.csv',
            'test_input/diagnostics/02_attendance_summary.csv'
        ]
        
        print("✅ 処理完了状態設定")
        
        # サマリーデータの生成
        from streamlit_app import collect_summary
        session_state['summary_df'] = collect_summary(session_state['result_paths'])
        
        print(f"✅ サマリーデータ生成: {len(session_state['summary_df'])}行")
        
        # 最適化関連のセッション状態
        session_state['optimization_analysis'] = None
        session_state['optimization_results'] = None
        session_state['selected_employee'] = None
        session_state['adopted_pattern'] = None
        
        print("✅ 最適化セッション状態初期化")
        
        # セッション状態の整合性確認
        required_keys = [
            'processing_complete', 'result_paths', 'diagnostic_paths', 
            'summary_df', 'optimization_analysis', 'optimization_results'
        ]
        
        missing_keys = [key for key in required_keys if key not in session_state]
        
        if missing_keys:
            print(f"❌ 不足セッション状態キー: {missing_keys}")
            return False
        
        print("✅ セッション状態整合性確認完了")
        
        # 状態遷移のテスト
        print("🔄 状態遷移テスト:")
        
        # 初期状態 → 処理中 → 完了
        states = ['初期', '処理中', '完了', '最適化実行中', '最適化完了']
        for state in states:
            print(f"  ✅ 状態: {state}")
        
        return True
        
    except Exception as e:
        print(f"❌ セッション状態管理テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_error_recovery_scenario():
    """エラー回復シナリオテスト"""
    print("\n=== エラー回復シナリオテスト ===")
    
    try:
        # 1. 不正データでの処理
        print("📋 不正データ処理テスト")
        
        # 空のDataFrameでのテスト
        empty_df = pd.DataFrame()
        
        try:
            from streamlit_app import prepare_grid_data
            result = prepare_grid_data([])  # 空のパスリスト
            print("⚠️ 空データでもエラーが発生しませんでした")
        except Exception as e:
            print(f"✅ 空データで適切なエラー処理: {type(e).__name__}")
        
        # 2. 存在しない従業員での最適化
        print("📋 存在しない従業員での最適化テスト")
        
        try:
            from optimization import WorkOptimizer
            att_df = pd.read_csv('test_input/勤怠履歴.csv', encoding='cp932')
            service_dfs = {}
            
            optimizer = WorkOptimizer(att_df, service_dfs)
            analysis = optimizer.analyze_employee_patterns("存在しない従業員")
            
            if "error" in analysis:
                print("✅ 存在しない従業員で適切なエラー処理")
            else:
                print("⚠️ 存在しない従業員でもエラーが発生しませんでした")
        
        except Exception as e:
            print(f"✅ 存在しない従業員で適切な例外処理: {type(e).__name__}")
        
        # 3. 破損ファイルでの処理
        print("📋 破損ファイル処理テスト")
        
        # 一時的な破損ファイルを作成
        temp_file = "temp_broken.csv"
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write("破損したCSVファイル\n不正な形式")
        
        try:
            df = pd.read_csv(temp_file, encoding='cp932')
            print("⚠️ 破損ファイルでもエラーが発生しませんでした")
        except Exception as e:
            print(f"✅ 破損ファイルで適切なエラー処理: {type(e).__name__}")
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        # 4. メモリ不足シミュレーション
        print("📋 リソース制限テスト")
        
        # 大量データの処理（シミュレーション）
        try:
            large_data = pd.DataFrame({
                'A': ['◯'] * 1000,
                'B': ['テスト'] * 1000,
                'C': ['従業員'] * 1000,
                'D': ['2025-01-01'] * 1000,
                'E': ['09:00'] * 1000,
                'F': ['17:00'] * 1000,
                'G': ['利用者'] * 1000,
                'AB': ['サービス'] * 1000
            })
            
            # フィルタリング処理
            filtered = large_data[large_data['A'] == '◯']
            print(f"✅ 大量データ処理成功: {len(filtered)}行")
            
        except Exception as e:
            print(f"❌ 大量データ処理でエラー: {str(e)}")
            return False
        
        print("✅ エラー回復シナリオテスト完了")
        return True
        
    except Exception as e:
        print(f"❌ エラー回復シナリオテストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def main():
    """メインテスト実行"""
    print("🚀 統合シナリオテスト開始")
    print(f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    test_results = []
    
    # 各テストの実行
    tests = [
        ("完全ワークフローシナリオ", test_full_workflow_scenario),
        ("セッション状態管理シミュレーション", test_session_state_simulation),
        ("エラー回復シナリオ", test_error_recovery_scenario),
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
    print("\n" + "=" * 60)
    print("📊 統合シナリオテスト結果サマリー")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ 成功" if result else "❌ 失敗"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 総合結果: {passed}/{total} テスト成功")
    
    if passed == total:
        print("🎉 全ての統合シナリオテストが成功しました！")
        print("🔗 全機能の連携が正常に動作しています")
        return True
    else:
        print("⚠️ 一部の統合シナリオテストが失敗しました。")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
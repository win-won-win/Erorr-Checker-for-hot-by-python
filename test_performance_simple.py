#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
簡略版パフォーマンステストスクリプト
psutilを使わずに基本的なパフォーマンステストを実行
"""

import pandas as pd
import time
import os
import sys
from datetime import datetime
import traceback

def test_large_data_performance():
    """大量データでのパフォーマンステスト"""
    print("=== 大量データパフォーマンステスト ===")
    
    try:
        from streamlit_app import prepare_grid_data, collect_summary
        
        # 既存のテストデータを使用
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        # グリッドデータ準備の処理時間測定
        start_time = time.time()
        grid_df = prepare_grid_data(result_paths)
        grid_time = time.time() - start_time
        
        print(f"✅ グリッドデータ準備完了: {grid_time:.3f}秒")
        print(f"📈 処理データ量: {len(grid_df)}行")
        
        # サマリー収集の処理時間測定
        start_time = time.time()
        summary_df = collect_summary(result_paths)
        summary_time = time.time() - start_time
        
        print(f"✅ サマリー収集完了: {summary_time:.3f}秒")
        print(f"📈 サマリー行数: {len(summary_df)}行")
        
        # フィルタリング性能テスト
        start_time = time.time()
        
        # エラーのみフィルタ
        error_filtered = grid_df[grid_df['A'] == '◯']
        
        # 特定の従業員でフィルタ
        staff_filtered = pd.DataFrame()
        if not grid_df['C'].empty and len(grid_df['C'].dropna()) > 0:
            first_staff = grid_df['C'].dropna().iloc[0]
            staff_filtered = grid_df[grid_df['C'] == first_staff]
        
        # 日付範囲フィルタ（簡略版）
        date_filtered = grid_df[grid_df['D'].notna()]
        
        filter_time = time.time() - start_time
        
        print(f"✅ フィルタリング処理完了: {filter_time:.3f}秒")
        print(f"📈 フィルタ結果:")
        print(f"  - エラーのみ: {len(error_filtered)}行")
        print(f"  - 従業員フィルタ: {len(staff_filtered)}行")
        print(f"  - 日付フィルタ: {len(date_filtered)}行")
        
        # パフォーマンス評価
        total_time = grid_time + summary_time + filter_time
        rows_per_second = len(grid_df) / total_time if total_time > 0 else 0
        
        print(f"⚡ パフォーマンス評価:")
        print(f"  - 総処理時間: {total_time:.3f}秒")
        print(f"  - 処理速度: {rows_per_second:.1f}行/秒")
        
        # パフォーマンス基準の評価
        performance_ok = True
        if total_time > 5.0:  # 5秒以上は遅い
            print("⚠️ 警告: 処理時間が5秒を超えています")
            performance_ok = False
        else:
            print("✅ パフォーマンス基準をクリアしています")
        
        return performance_ok
        
    except Exception as e:
        print(f"❌ パフォーマンステストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_optimization_performance():
    """最適化機能のパフォーマンステスト"""
    print("\n=== 最適化機能パフォーマンステスト ===")
    
    try:
        from optimization import WorkOptimizer
        from src import build_service_records
        from pathlib import Path
        
        # データ読み込み時間測定
        start_time = time.time()
        
        att_df = pd.read_csv('test_input/勤怠履歴.csv', encoding='cp932')
        
        service_dfs = {}
        service_files = ['test_input/サービス実態A.csv', 'test_input/サービス実態B.csv']
        
        for service_file in service_files:
            if os.path.exists(service_file):
                facility_name = os.path.basename(service_file).replace('.csv', '')
                df = pd.read_csv(service_file, encoding='cp932')
                service_dfs[facility_name] = build_service_records(
                    Path(service_file), df, facility_name, staff_col='担当所員'
                )
        
        load_time = time.time() - start_time
        
        print(f"✅ データ読み込み完了: {load_time:.3f}秒")
        print(f"📈 勤怠データ: {len(att_df)}行")
        print(f"📈 サービスデータ: {sum(len(df) for df in service_dfs.values())}行")
        
        # 最適化エンジン初期化時間測定
        start_time = time.time()
        optimizer = WorkOptimizer(att_df, service_dfs)
        init_time = time.time() - start_time
        
        print(f"✅ 最適化エンジン初期化完了: {init_time:.3f}秒")
        
        # 全従業員の分析時間測定
        available_employees = []
        for _, row in att_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        total_analysis_time = 0
        total_optimization_time = 0
        successful_analyses = 0
        
        test_employees = available_employees[:3]  # 最初の3人をテスト
        
        for employee in test_employees:
            # 分析時間測定
            start_time = time.time()
            analysis = optimizer.analyze_employee_patterns(employee)
            analysis_time = time.time() - start_time
            
            if "error" not in analysis:
                successful_analyses += 1
                total_analysis_time += analysis_time
                
                # 最適化パターン生成時間測定
                start_time = time.time()
                optimization_results = optimizer.generate_optimization_patterns(employee)
                optimization_time = time.time() - start_time
                total_optimization_time += optimization_time
                
                print(f"✅ {employee}: 分析{analysis_time:.3f}秒, 最適化{optimization_time:.3f}秒, パターン{len(optimization_results)}個")
            else:
                print(f"⚠️ {employee}: 分析失敗 - {analysis.get('error', 'Unknown error')}")
        
        # パフォーマンス統計
        if successful_analyses > 0:
            avg_analysis_time = total_analysis_time / successful_analyses
            avg_optimization_time = total_optimization_time / successful_analyses
            
            print(f"📊 最適化パフォーマンス統計:")
            print(f"  - 成功した分析: {successful_analyses}/{len(test_employees)}")
            print(f"  - 平均分析時間: {avg_analysis_time:.3f}秒/人")
            print(f"  - 平均最適化時間: {avg_optimization_time:.3f}秒/人")
            
            # パフォーマンス基準の評価
            performance_ok = True
            if avg_analysis_time > 2.0:  # 2秒以上は遅い
                print("⚠️ 警告: 分析時間が2秒を超えています")
                performance_ok = False
            
            if avg_optimization_time > 3.0:  # 3秒以上は遅い
                print("⚠️ 警告: 最適化時間が3秒を超えています")
                performance_ok = False
            
            if performance_ok:
                print("✅ 最適化パフォーマンス基準をクリアしています")
            
            return performance_ok
        else:
            print("❌ 成功した分析がありません")
            return False
        
    except Exception as e:
        print(f"❌ 最適化パフォーマンステストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_concurrent_operations():
    """並行処理のシミュレーションテスト"""
    print("\n=== 並行処理シミュレーションテスト ===")
    
    try:
        from streamlit_app import prepare_grid_data
        
        # 複数回の処理を連続実行して処理時間の安定性をチェック
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        processing_times = []
        data_sizes = []
        
        for i in range(5):  # 5回連続実行
            start_time = time.time()
            grid_df = prepare_grid_data(result_paths)
            processing_time = time.time() - start_time
            
            processing_times.append(processing_time)
            data_sizes.append(len(grid_df))
            
            print(f"  実行{i+1}: {processing_time:.3f}秒, データ{len(grid_df)}行")
            
            # データを明示的に削除
            del grid_df
        
        # 処理時間の安定性評価
        avg_processing_time = sum(processing_times) / len(processing_times)
        min_time = min(processing_times)
        max_time = max(processing_times)
        time_variance = max_time - min_time
        
        print(f"📊 並行処理テスト結果:")
        print(f"  - 平均処理時間: {avg_processing_time:.3f}秒")
        print(f"  - 最小処理時間: {min_time:.3f}秒")
        print(f"  - 最大処理時間: {max_time:.3f}秒")
        print(f"  - 時間のばらつき: {time_variance:.3f}秒")
        
        # データサイズの一貫性チェック
        data_consistent = len(set(data_sizes)) == 1
        if data_consistent:
            print("✅ データサイズは一貫しています")
        else:
            print("⚠️ 警告: データサイズが一貫していません")
        
        # 処理時間の安定性評価
        performance_stable = (max_time / min_time) < 2.0 if min_time > 0 else False  # 2倍以下なら安定
        
        if performance_stable:
            print("✅ 処理時間は安定しています")
        else:
            print("⚠️ 警告: 処理時間が不安定です")
        
        return data_consistent and performance_stable
        
    except Exception as e:
        print(f"❌ 並行処理テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def test_data_volume_scalability():
    """データ量スケーラビリティテスト"""
    print("\n=== データ量スケーラビリティテスト ===")
    
    try:
        from streamlit_app import prepare_grid_data
        
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        # 基本データサイズでの処理時間測定
        start_time = time.time()
        grid_df = prepare_grid_data(result_paths)
        base_time = time.time() - start_time
        base_size = len(grid_df)
        
        print(f"✅ 基本データ処理: {base_size}行, {base_time:.3f}秒")
        
        # フィルタリング操作の処理時間測定
        filter_operations = [
            ("エラーフィルタ", lambda df: df[df['A'] == '◯']),
            ("従業員フィルタ", lambda df: df[df['C'].notna()]),
            ("日付フィルタ", lambda df: df[df['D'].notna()]),
            ("複合フィルタ", lambda df: df[(df['A'] == '◯') & (df['C'].notna())]),
        ]
        
        filter_times = []
        
        for filter_name, filter_func in filter_operations:
            start_time = time.time()
            filtered_df = filter_func(grid_df)
            filter_time = time.time() - start_time
            filter_times.append(filter_time)
            
            print(f"✅ {filter_name}: {len(filtered_df)}行, {filter_time:.3f}秒")
        
        # スケーラビリティ評価
        avg_filter_time = sum(filter_times) / len(filter_times)
        
        print(f"📊 スケーラビリティ評価:")
        print(f"  - 基本処理時間: {base_time:.3f}秒")
        print(f"  - 平均フィルタ時間: {avg_filter_time:.3f}秒")
        print(f"  - 処理効率: {base_size/base_time:.1f}行/秒")
        
        # スケーラビリティ基準
        scalability_ok = True
        if base_time > 1.0:  # 1秒以上は遅い
            print("⚠️ 警告: 基本処理時間が1秒を超えています")
            scalability_ok = False
        
        if avg_filter_time > 0.1:  # 0.1秒以上は遅い
            print("⚠️ 警告: フィルタ処理時間が0.1秒を超えています")
            scalability_ok = False
        
        if scalability_ok:
            print("✅ スケーラビリティ基準をクリアしています")
        
        return scalability_ok
        
    except Exception as e:
        print(f"❌ スケーラビリティテストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def main():
    """メインテスト実行"""
    print("🚀 簡略版パフォーマンステスト開始")
    print(f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    test_results = []
    
    # 各テストの実行
    tests = [
        ("大量データパフォーマンス", test_large_data_performance),
        ("最適化機能パフォーマンス", test_optimization_performance),
        ("並行処理シミュレーション", test_concurrent_operations),
        ("データ量スケーラビリティ", test_data_volume_scalability),
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
    print("📊 パフォーマンステスト結果サマリー")
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
        print("🎉 全てのパフォーマンステストが成功しました！")
        return True
    else:
        print("⚠️ 一部のパフォーマンステストが失敗しました。")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
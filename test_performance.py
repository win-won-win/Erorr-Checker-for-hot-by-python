#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
パフォーマンステストスクリプト
大量データでの動作確認とメモリ使用量測定
"""

import pandas as pd
import time
import psutil
import os
import sys
from datetime import datetime
import traceback

def get_memory_usage():
    """現在のメモリ使用量を取得（MB）"""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

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
        
        # メモリ使用量測定開始
        initial_memory = get_memory_usage()
        print(f"📊 初期メモリ使用量: {initial_memory:.2f} MB")
        
        # グリッドデータ準備の処理時間測定
        start_time = time.time()
        grid_df = prepare_grid_data(result_paths)
        grid_time = time.time() - start_time
        
        grid_memory = get_memory_usage()
        print(f"✅ グリッドデータ準備完了: {grid_time:.3f}秒")
        print(f"📊 グリッド処理後メモリ: {grid_memory:.2f} MB (+{grid_memory-initial_memory:.2f} MB)")
        print(f"📈 処理データ量: {len(grid_df)}行")
        
        # サマリー収集の処理時間測定
        start_time = time.time()
        summary_df = collect_summary(result_paths)
        summary_time = time.time() - start_time
        
        summary_memory = get_memory_usage()
        print(f"✅ サマリー収集完了: {summary_time:.3f}秒")
        print(f"📊 サマリー処理後メモリ: {summary_memory:.2f} MB")
        
        # フィルタリング性能テスト
        start_time = time.time()
        
        # エラーのみフィルタ
        error_filtered = grid_df[grid_df['A'] == '◯']
        
        # 特定の従業員でフィルタ
        if not grid_df['C'].empty:
            staff_filtered = grid_df[grid_df['C'] == grid_df['C'].iloc[0]]
        
        # 日付範囲フィルタ（簡略版）
        date_filtered = grid_df[grid_df['D'].notna()]
        
        filter_time = time.time() - start_time
        filter_memory = get_memory_usage()
        
        print(f"✅ フィルタリング処理完了: {filter_time:.3f}秒")
        print(f"📊 フィルタリング後メモリ: {filter_memory:.2f} MB")
        print(f"📈 フィルタ結果:")
        print(f"  - エラーのみ: {len(error_filtered)}行")
        print(f"  - 従業員フィルタ: {len(staff_filtered) if 'staff_filtered' in locals() else 0}行")
        print(f"  - 日付フィルタ: {len(date_filtered)}行")
        
        # メモリ効率の評価
        total_memory_increase = filter_memory - initial_memory
        memory_per_row = total_memory_increase / len(grid_df) if len(grid_df) > 0 else 0
        
        print(f"📊 メモリ効率:")
        print(f"  - 総メモリ増加: {total_memory_increase:.2f} MB")
        print(f"  - 行あたりメモリ: {memory_per_row:.4f} MB/行")
        
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
        
        if total_memory_increase > 100:  # 100MB以上は多い
            print("⚠️ 警告: メモリ使用量が100MBを超えています")
            performance_ok = False
        
        if performance_ok:
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
        
        # メモリ使用量測定開始
        initial_memory = get_memory_usage()
        print(f"📊 初期メモリ使用量: {initial_memory:.2f} MB")
        
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
        load_memory = get_memory_usage()
        
        print(f"✅ データ読み込み完了: {load_time:.3f}秒")
        print(f"📊 読み込み後メモリ: {load_memory:.2f} MB (+{load_memory-initial_memory:.2f} MB)")
        
        # 最適化エンジン初期化時間測定
        start_time = time.time()
        optimizer = WorkOptimizer(att_df, service_dfs)
        init_time = time.time() - start_time
        init_memory = get_memory_usage()
        
        print(f"✅ 最適化エンジン初期化完了: {init_time:.3f}秒")
        print(f"📊 初期化後メモリ: {init_memory:.2f} MB (+{init_memory-load_memory:.2f} MB)")
        
        # 全従業員の分析時間測定
        available_employees = []
        for _, row in att_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        total_analysis_time = 0
        total_optimization_time = 0
        successful_analyses = 0
        
        for employee in available_employees[:3]:  # 最初の3人をテスト
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
        
        final_memory = get_memory_usage()
        
        # パフォーマンス統計
        if successful_analyses > 0:
            avg_analysis_time = total_analysis_time / successful_analyses
            avg_optimization_time = total_optimization_time / successful_analyses
            
            print(f"📊 最適化パフォーマンス統計:")
            print(f"  - 成功した分析: {successful_analyses}/{len(available_employees[:3])}")
            print(f"  - 平均分析時間: {avg_analysis_time:.3f}秒/人")
            print(f"  - 平均最適化時間: {avg_optimization_time:.3f}秒/人")
            print(f"  - 総メモリ使用量: {final_memory:.2f} MB")
            print(f"  - メモリ増加: {final_memory-initial_memory:.2f} MB")
            
            # パフォーマンス基準の評価
            performance_ok = True
            if avg_analysis_time > 2.0:  # 2秒以上は遅い
                print("⚠️ 警告: 分析時間が2秒を超えています")
                performance_ok = False
            
            if avg_optimization_time > 3.0:  # 3秒以上は遅い
                print("⚠️ 警告: 最適化時間が3秒を超えています")
                performance_ok = False
            
            if final_memory - initial_memory > 50:  # 50MB以上は多い
                print("⚠️ 警告: メモリ使用量が50MBを超えています")
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
        
        # 複数回の処理を連続実行してメモリリークをチェック
        initial_memory = get_memory_usage()
        print(f"📊 初期メモリ使用量: {initial_memory:.2f} MB")
        
        result_paths = [
            'test_input/result_サービス実態A.csv',
            'test_input/result_サービス実態B.csv'
        ]
        
        memory_readings = []
        processing_times = []
        
        for i in range(5):  # 5回連続実行
            start_time = time.time()
            grid_df = prepare_grid_data(result_paths)
            processing_time = time.time() - start_time
            
            current_memory = get_memory_usage()
            memory_readings.append(current_memory)
            processing_times.append(processing_time)
            
            print(f"  実行{i+1}: {processing_time:.3f}秒, メモリ{current_memory:.2f}MB")
            
            # データを明示的に削除
            del grid_df
        
        # メモリリークの検出
        memory_increase = memory_readings[-1] - initial_memory
        max_memory = max(memory_readings)
        avg_processing_time = sum(processing_times) / len(processing_times)
        
        print(f"📊 並行処理テスト結果:")
        print(f"  - 最終メモリ増加: {memory_increase:.2f} MB")
        print(f"  - 最大メモリ使用量: {max_memory:.2f} MB")
        print(f"  - 平均処理時間: {avg_processing_time:.3f}秒")
        
        # メモリリークの評価
        memory_leak_ok = memory_increase < 20  # 20MB以下なら許容
        performance_stable = max(processing_times) / min(processing_times) < 2.0  # 2倍以下なら安定
        
        if memory_leak_ok:
            print("✅ メモリリークは検出されませんでした")
        else:
            print("⚠️ 警告: メモリリークの可能性があります")
        
        if performance_stable:
            print("✅ 処理時間は安定しています")
        else:
            print("⚠️ 警告: 処理時間が不安定です")
        
        return memory_leak_ok and performance_stable
        
    except Exception as e:
        print(f"❌ 並行処理テストでエラー: {str(e)}")
        traceback.print_exc()
        return False

def main():
    """メインテスト実行"""
    print("🚀 パフォーマンステスト開始")
    print(f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"💻 システム情報:")
    print(f"  - CPU数: {psutil.cpu_count()}")
    print(f"  - 総メモリ: {psutil.virtual_memory().total / 1024 / 1024 / 1024:.1f} GB")
    print(f"  - 利用可能メモリ: {psutil.virtual_memory().available / 1024 / 1024 / 1024:.1f} GB")
    print("=" * 50)
    
    test_results = []
    
    # 各テストの実行
    tests = [
        ("大量データパフォーマンス", test_large_data_performance),
        ("最適化機能パフォーマンス", test_optimization_performance),
        ("並行処理シミュレーション", test_concurrent_operations),
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
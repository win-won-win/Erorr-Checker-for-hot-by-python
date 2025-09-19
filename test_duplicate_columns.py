#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「重複利用者名」と「重複サービス時間」列の機能テストスクリプト
"""
import pandas as pd
import os
import sys
from pathlib import Path

# streamlit_app.pyから必要な関数をインポート
sys.path.append('.')
from streamlit_app import prepare_grid_data, extract_facility_name_from_filename

def create_test_data():
    """テスト用のCSVデータを作成"""
    print("=== テスト用データ作成 ===")
    
    # テスト用データ1（さくら事業所）
    test_data_1 = {
        'エラー': ['◯', '', '◯', ''],
        'カテゴリ': ['施設間重複', '', '施設間重複', ''],
        '代替職員リスト': ['ー', 'ー', '田中一郎', 'ー'],
        '重複時間（分）': [60, 0, 30, 0],
        '超過時間（分）': [0, 0, 0, 0],
        '重複相手施設': ['result_ほっと202508.csv', '', 'result_ほっと202508.csv', ''],
        '重複相手担当者': ['山田花子', '', '佐藤次郎', ''],
        '重複タイプ': ['完全重複', '', '部分重複', ''],
        'カバー状況': ['完全カバー', '完全カバー', '完全カバー', '完全カバー'],
        '勤務区間数': [6, 5, 3, 4],
        '詳細ID': ['さくら_001', 'さくら_002', 'さくら_003', 'さくら_004'],
        '日付': ['令和07年02月01日 (土)', '令和07年02月01日 (土)', '令和07年02月01日 (土)', '令和07年02月02日 (日)'],
        '時間': ['09:00～10:00', '10:00～11:00', '15:00～16:00', '11:00～12:00'],
        '利用者名': ['田中太郎', '佐藤次郎', '小林五郎', '高橋三郎'],
        'サービス内容': ['身体', '身体', '身体', '身体'],
        '担当所員': ['山田花子', '鈴木一郎', '佐藤七子', '田中五郎'],
        '開始時間': ['9:00', '10:00', '15:00', '11:00'],
        '終了時間': ['10:00', '11:00', '16:00', '12:00'],
        '実施時間': [60, 60, 60, 60],
        '重複サービス時間': ['9:00-10:00', '', '15:00-15:30', '']
    }
    
    # テスト用データ2（ほっと事業所）
    test_data_2 = {
        'エラー': ['◯', '', '◯'],
        'カテゴリ': ['施設間重複', '', '施設間重複'],
        '代替職員リスト': ['ー', 'ー', '鈴木二郎'],
        '重複時間（分）': [60, 0, 30],
        '超過時間（分）': [0, 0, 0],
        '重複相手施設': ['result_さくら202508.csv', '', 'result_さくら202508.csv'],
        '重複相手担当者': ['佐藤七子', '', '山田花子'],
        '重複タイプ': ['完全重複', '', '部分重複'],
        'カバー状況': ['完全カバー', '完全カバー', '完全カバー'],
        '勤務区間数': [4, 3, 5],
        '詳細ID': ['ほっと_001', 'ほっと_002', 'ほっと_003'],
        '日付': ['令和07年02月01日 (土)', '令和07年02月01日 (土)', '令和07年02月01日 (土)'],
        '時間': ['09:00～10:00', '12:00～13:00', '15:00～16:00'],
        '利用者名': ['中村四郎', '渡辺六郎', '伊藤七郎'],
        'サービス内容': ['身体', '身体', '身体'],
        '担当所員': ['佐藤七子', '田中五郎', '山田花子'],
        '開始時間': ['9:00', '12:00', '15:00'],
        '終了時間': ['10:00', '13:00', '16:00'],
        '実施時間': [60, 60, 60],
        '重複サービス時間': ['9:00-10:00', '', '15:00-15:30']
    }
    
    # DataFrameを作成
    df1 = pd.DataFrame(test_data_1)
    df2 = pd.DataFrame(test_data_2)
    
    # テスト用ディレクトリを作成
    test_dir = "test_duplicate_columns"
    os.makedirs(test_dir, exist_ok=True)
    
    # CSVファイルとして保存
    test_path_1 = f"{test_dir}/result_さくら202508.csv"
    test_path_2 = f"{test_dir}/result_ほっと202508.csv"
    
    df1.to_csv(test_path_1, index=False, encoding='utf-8-sig')
    df2.to_csv(test_path_2, index=False, encoding='utf-8-sig')
    
    print(f"✅ テストデータ作成完了:")
    print(f"  - {test_path_1} ({len(df1)}行)")
    print(f"  - {test_path_2} ({len(df2)}行)")
    
    return [test_path_1, test_path_2]

def test_facility_name_extraction():
    """事業所名抽出機能のテスト"""
    print("\n=== 事業所名抽出機能テスト ===")
    
    test_cases = [
        ("result_さくら202508.csv", "さくら"),
        ("result_ほっと202508.csv", "ほっと"),
        ("result_デイサービス太陽202508.csv", "デイサービス太陽"),
        ("result_ケアセンター花202508.csv", "ケアセンター花")
    ]
    
    all_passed = True
    for filename, expected in test_cases:
        result = extract_facility_name_from_filename(filename)
        if result == expected:
            print(f"✅ {filename} -> {result}")
        else:
            print(f"❌ {filename} -> {result} (期待値: {expected})")
            all_passed = False
    
    return all_passed

def test_duplicate_columns_functionality():
    """重複列機能のテスト"""
    print("\n=== 重複列機能テスト ===")
    
    # テストデータを作成
    test_paths = create_test_data()
    
    try:
        # prepare_grid_data関数を実行
        grid_df = prepare_grid_data(test_paths)
        
        print(f"✅ グリッドデータ生成成功: {len(grid_df)}行")
        
        # 期待される列の存在確認
        expected_columns = [
            'エラー', 'カテゴリ', '代替職員リスト', '担当所員', '利用者名', 
            '重複利用者名', '重複エラー事業所名', '重複サービス時間', 
            '日付', '開始時間', '終了時間', 'サービス詳細', '重複時間', '超過時間'
        ]
        
        missing_columns = [col for col in expected_columns if col not in grid_df.columns]
        if missing_columns:
            print(f"❌ 不足している列: {missing_columns}")
            return False
        
        print("✅ 全ての期待される列が存在")
        
        # 列の順序確認
        actual_order = list(grid_df.columns[:len(expected_columns)])
        if actual_order == expected_columns:
            print("✅ 列の順序が正しい")
        else:
            print(f"❌ 列の順序が不正:")
            print(f"  期待値: {expected_columns}")
            print(f"  実際値: {actual_order}")
            return False
        
        # エラー行の確認
        error_rows = grid_df[grid_df['エラー'] == '◯']
        print(f"✅ エラー行数: {len(error_rows)}件")
        
        # 重複利用者名の検証
        print("\n--- 重複利用者名の検証 ---")
        for idx, row in grid_df.iterrows():
            error_status = row['エラー']
            user_name = row['利用者名']
            duplicate_user_name = row['重複利用者名']
            
            if error_status == '◯':
                # エラー行では重複利用者名が利用者名と同じであるべき
                if duplicate_user_name == user_name:
                    print(f"✅ 行{idx}: エラー行で重複利用者名が正しく設定 ({duplicate_user_name})")
                else:
                    print(f"❌ 行{idx}: エラー行で重複利用者名が不正 (期待値: {user_name}, 実際値: {duplicate_user_name})")
                    return False
            else:
                # 非エラー行では重複利用者名が空であるべき
                if duplicate_user_name == '':
                    print(f"✅ 行{idx}: 非エラー行で重複利用者名が空白")
                else:
                    print(f"❌ 行{idx}: 非エラー行で重複利用者名が空白でない ({duplicate_user_name})")
                    return False
        
        # 重複サービス時間の検証
        print("\n--- 重複サービス時間の検証 ---")
        for idx, row in grid_df.iterrows():
            error_status = row['エラー']
            service_time = row['重複サービス時間']
            
            if error_status == '◯':
                if service_time and service_time != '':
                    print(f"✅ 行{idx}: エラー行で重複サービス時間が設定 ({service_time})")
                else:
                    print(f"⚠️ 行{idx}: エラー行で重複サービス時間が空 (データ依存)")
            else:
                if service_time == '':
                    print(f"✅ 行{idx}: 非エラー行で重複サービス時間が空白")
                else:
                    print(f"❌ 行{idx}: 非エラー行で重複サービス時間が空白でない ({service_time})")
        
        # 重複エラー事業所名の検証
        print("\n--- 重複エラー事業所名の検証 ---")
        for idx, row in grid_df.iterrows():
            error_status = row['エラー']
            facility_name = row['重複エラー事業所名']
            
            if error_status == '◯':
                if facility_name and facility_name != '':
                    print(f"✅ 行{idx}: エラー行で重複エラー事業所名が設定 ({facility_name})")
                else:
                    print(f"⚠️ 行{idx}: エラー行で重複エラー事業所名が空")
            else:
                if facility_name == '':
                    print(f"✅ 行{idx}: 非エラー行で重複エラー事業所名が空白")
                else:
                    print(f"❌ 行{idx}: 非エラー行で重複エラー事業所名が空白でない ({facility_name})")
        
        # サンプルデータの表示
        print("\n--- サンプルデータ（最初の5行） ---")
        display_cols = ['エラー', '利用者名', '重複利用者名', '重複エラー事業所名', '重複サービス時間']
        print(grid_df[display_cols].head().to_string())
        
        return True
        
    except Exception as e:
        print(f"❌ 重複列機能テストでエラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def cleanup_test_data():
    """テストデータのクリーンアップ"""
    import shutil
    test_dir = "test_duplicate_columns"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
        print(f"✅ テストデータクリーンアップ完了: {test_dir}")

def main():
    """メインテスト実行"""
    print("「重複利用者名」と「重複サービス時間」列の機能テスト開始")
    print("=" * 60)
    
    tests = [
        test_facility_name_extraction,
        test_duplicate_columns_functionality
    ]
    
    passed = 0
    total = len(tests)
    
    try:
        for test_func in tests:
            try:
                if test_func():
                    passed += 1
                    print(f"✅ {test_func.__name__} 成功")
                else:
                    print(f"❌ {test_func.__name__} 失敗")
            except Exception as e:
                print(f"❌ {test_func.__name__} 例外発生: {str(e)}")
            print("-" * 40)
        
        print(f"\nテスト結果: {passed}/{total} 成功")
        
        if passed == total:
            print("🎉 全てのテストが成功しました！")
            return True
        else:
            print("⚠️ 一部のテストが失敗しました。")
            return False
    
    finally:
        # テストデータのクリーンアップ
        cleanup_test_data()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
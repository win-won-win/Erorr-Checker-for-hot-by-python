#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重複エラー事業所名列の実装テスト
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from streamlit_app import extract_facility_name_from_filename, extract_facility_names_from_partner_facilities

def test_extract_facility_name_from_filename():
    """ファイル名から事業所名を抽出する関数のテスト"""
    print("=== ファイル名から事業所名抽出のテスト ===")
    
    test_cases = [
        ("さくら　2020508 3.csv", "さくら"),
        ("result_さくら　2020508 3.csv", "さくら"),
        ("ひまわり 456.csv", "ひまわり"),
        ("result_ひまわり 456.csv", "ひまわり"),
        ("みどり_123.csv", "みどり"),
        ("result_みどり_123.csv", "みどり"),
        ("あおぞら.csv", "あおぞら"),
        ("result_あおぞら.csv", "あおぞら"),
        ("複雑な事業所名　123 456.csv", "複雑な事業所名"),
        ("result_複雑な事業所名　123 456.csv", "複雑な事業所名"),
    ]
    
    for filename, expected in test_cases:
        result = extract_facility_name_from_filename(filename)
        status = "✅" if result == expected else "❌"
        print(f"{status} {filename} -> {result} (期待値: {expected})")

def test_extract_facility_names_from_partner_facilities():
    """重複相手施設から事業所名を抽出する関数のテスト"""
    print("\n=== 重複相手施設から事業所名抽出のテスト ===")
    
    test_cases = [
        ("result_さくら　2020508 3.csv", ["さくら"]),
        ("result_さくら　2020508 3.csv，result_ひまわり 456.csv", ["さくら", "ひまわり"]),
        ("result_みどり_123.csv，result_あおぞら.csv，result_たんぽぽ 789.csv", ["みどり", "あおぞら", "たんぽぽ"]),
        ("", []),
        (None, []),
        ("result_複雑な事業所名　123 456.csv", ["複雑な事業所名"]),
    ]
    
    for partner_facilities, expected in test_cases:
        result = extract_facility_names_from_partner_facilities(partner_facilities)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{partner_facilities}' -> {result} (期待値: {expected})")

def test_integration():
    """統合テスト"""
    print("\n=== 統合テスト ===")
    
    # 模擬的なCSVデータを作成
    import pandas as pd
    
    test_data = [
        {
            'エラー': '◯',
            'カテゴリ': '重複',
            '担当所員': '田中太郎',
            '利用者名': '山田花子',
            '重複相手施設': 'result_さくら　2020508 3.csv，result_ひまわり 456.csv',
            '重複時間（分）': 30
        },
        {
            'エラー': '',
            'カテゴリ': '正常',
            '担当所員': '佐藤次郎',
            '利用者名': '鈴木一郎',
            '重複相手施設': '',
            '重複時間（分）': 0
        },
        {
            'エラー': '◯',
            'カテゴリ': '重複',
            '担当所員': '高橋三郎',
            '利用者名': '田中美子',
            '重複相手施設': 'result_みどり_123.csv',
            '重複時間（分）': 15
        }
    ]
    
    df = pd.DataFrame(test_data)
    
    # 各行に対して事業所名抽出をテスト
    for idx, row in df.iterrows():
        partner_facilities = row.get('重複相手施設', '')
        duplicate_facility_names = extract_facility_names_from_partner_facilities(partner_facilities)
        duplicate_facility_display = '，'.join(duplicate_facility_names) if duplicate_facility_names else ''
        
        print(f"行 {idx + 1}:")
        print(f"  利用者名: {row['利用者名']}")
        print(f"  重複相手施設: {partner_facilities}")
        print(f"  重複エラー事業所名: {duplicate_facility_display}")
        print()

if __name__ == "__main__":
    test_extract_facility_name_from_filename()
    test_extract_facility_names_from_partner_facilities()
    test_integration()
    print("テスト完了")
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
事業所名抽出機能の単体テスト
"""

import os
import re
import pandas as pd

def extract_facility_name_from_filename(filename):
    """
    ファイル名から事業所名を抽出する関数
    例: 'さくら　2020508 3.csv' -> 'さくら'
    """
    # ファイル名から拡張子を除去
    base_name = os.path.splitext(filename)[0]
    
    # result_ プレフィックスを除去
    if base_name.startswith('result_'):
        base_name = base_name[7:]  # 'result_' を除去
    
    # 事業所名抽出のパターン
    # パターン1: 事業所名の後に数字や記号が続く場合（例: さくら　2020508 3）
    pattern1 = r'^([^\d\s]+)'
    match1 = re.match(pattern1, base_name.strip())
    if match1:
        facility_name = match1.group(1).strip()
        # 末尾の記号を除去
        facility_name = re.sub(r'[　\s\-_]+$', '', facility_name)
        if facility_name:
            return facility_name
    
    # パターン2: 全角スペースや半角スペースで区切られた最初の部分
    parts = re.split(r'[　\s]+', base_name.strip())
    if parts and parts[0]:
        return parts[0].strip()
    
    # フォールバック: ファイル名をそのまま返す
    return base_name.strip()

def extract_facility_names_from_partner_facilities(partner_facilities_str):
    """
    重複相手施設の文字列から事業所名のリストを抽出する関数
    例: 'result_さくら　2020508 3.csv，result_ひまわり 456.csv' -> ['さくら', 'ひまわり']
    """
    if not partner_facilities_str or pd.isna(partner_facilities_str):
        return []
    
    facility_names = []
    # カンマで分割
    facilities = [f.strip() for f in str(partner_facilities_str).split('，') if f.strip()]
    
    for facility in facilities:
        facility_name = extract_facility_name_from_filename(facility)
        if facility_name and facility_name not in facility_names:
            facility_names.append(facility_name)
    
    return facility_names

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
        print(f"{status} {filename} -> '{result}' (期待値: '{expected}')")

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
        print(f"  重複相手施設: '{partner_facilities}'")
        print(f"  重複エラー事業所名: '{duplicate_facility_display}'")
        print()

if __name__ == "__main__":
    test_extract_facility_name_from_filename()
    test_extract_facility_names_from_partner_facilities()
    test_integration()
    print("テスト完了")
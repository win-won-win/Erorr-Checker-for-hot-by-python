#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
normalize_name関数のテスト
従業員名の正規化が正しく動作するかテストする
"""

from src import normalize_name

def test_normalize_name():
    """normalize_name関数のテスト"""
    print("=== normalize_name関数のテスト ===")
    
    test_cases = [
        ('〇大宮　浩子', '大宮 浩子'),
        ('〇早﨑　友音', '早﨑 友音'),
        ('〇早﨑　琴絵', '早﨑 琴絵'),
        ('〇利光　梨絵', '利光 梨絵'),
        ('大宮 浩子', '大宮 浩子'),  # 既に正規化済み
        ('佐藤　真央', '佐藤 真央'),  # 全角スペース
        ('〇永迫\u3000マハリア', '永迫 マハリア'),  # Unicode全角スペース
    ]
    
    for original, expected in test_cases:
        result = normalize_name(original)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{original}' -> '{result}' (期待値: '{expected}')")
        
        if result != expected:
            print(f"    詳細: 元={repr(original)}, 結果={repr(result)}, 期待={repr(expected)}")

def main():
    """メインテスト関数"""
    print("従業員名正規化のテスト開始")
    print("=" * 50)
    
    test_normalize_name()
    
    print("\n" + "=" * 50)
    print("テスト完了")

if __name__ == "__main__":
    main()
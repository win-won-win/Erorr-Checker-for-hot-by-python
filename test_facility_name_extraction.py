#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import os

def extract_facility_name_from_filename(filename):
    """
    ファイル名から事業所名を抽出する関数
    先頭からのひらがな・漢字・カタカナまたはスペースまでを認識
    例: 'さくら202508)3.csv' -> 'さくら'
    例: 'ほっと202508)3.csv' -> 'ほっと'
    例: 'さくら　2020508 3.csv' -> 'さくら'
    """
    
    # ファイル名から拡張子を除去
    base_name = os.path.splitext(filename)[0]
    
    # result_ プレフィックスを除去
    if base_name.startswith('result_'):
        base_name = base_name[7:]  # 'result_' を除去
    
    print(f"処理中のファイル名: {filename}")
    print(f"ベース名: {base_name}")
    
    # 先頭からのひらがな・カタカナ・漢字・英字を抽出（スペースまたは数字・記号で終了）
    # ひらがな: あ-ん (U+3042-U+3093)
    # カタカナ: ア-ン (U+30A2-U+30F3)  
    # 漢字: 一-龯 (U+4E00-U+9FAF)
    # 英字: a-zA-Z
    pattern = r'^([あ-んア-ン一-龯a-zA-Zａ-ｚＡ-Ｚ]+)'
    
    match = re.match(pattern, base_name.strip())
    if match:
        facility_name = match.group(1).strip()
        print(f"パターンマッチ成功: {facility_name}")
        return facility_name
    
    # フォールバック: スペースで区切られた最初の部分
    parts = re.split(r'[　\s]+', base_name.strip())
    print(f"スペース分割結果: {parts}")
    if parts and parts[0]:
        # 最初の部分から日本語・英字のみを抽出
        first_part = parts[0]
        clean_match = re.match(r'^([あ-んア-ン一-龯a-zA-Zａ-ｚＡ-Ｚ]+)', first_part)
        if clean_match:
            result = clean_match.group(1).strip()
            print(f"フォールバック1成功: {result}")
            return result
        print(f"フォールバック2: {first_part.strip()}")
        return first_part.strip()
    
    # 最終フォールバック: ファイル名をそのまま返す
    print(f"最終フォールバック: {base_name.strip()}")
    return base_name.strip()

# テストケース
test_files = [
    'さくら202508)3.csv',
    'ほっと202508)3.csv',
    'さくら　2020508 3.csv',
    'result_さくら202508)3.csv',
    'result_ほっと202508)3.csv'
]

print("=== 事業所名抽出テスト ===")
for filename in test_files:
    print(f"\n--- {filename} ---")
    result = extract_facility_name_from_filename(filename)
    print(f"抽出結果: '{result}'")
    print(f"文字コード: {[ord(c) for c in result]}")
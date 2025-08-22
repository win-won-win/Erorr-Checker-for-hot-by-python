#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
従業員ID取得機能のテスト
"""

import pandas as pd
import sys
import os
from typing import Dict

# src.pyから必要な関数をインポート
sys.path.append('.')
from src import normalize_name

def load_employee_id_mapping(attendance_file_path: str = 'input/勤怠履歴.csv') -> Dict[str, str]:
    """勤怠CSVから従業員名と従業員IDのマッピングを作成"""
    try:
        df = pd.read_csv(attendance_file_path, encoding='cp932')
        
        # 名前と従業員IDの組み合わせを取得（重複を除去）
        mapping = {}
        for _, row in df.iterrows():
            name = str(row.get('名前', '')).strip()
            emp_id = str(row.get('*従業員ID', '')).strip()
            
            if name and emp_id and name != 'nan' and emp_id != 'nan':
                # 名前の正規化を行う
                normalized_name = normalize_name(name)
                if normalized_name:
                    mapping[normalized_name] = emp_id
                    # 元の名前でもマッピングを作成（正規化前の名前でも検索できるように）
                    mapping[name] = emp_id
        
        return mapping
    except Exception as e:
        print(f"勤怠CSVの読み込みエラー: {e}")
        return {}

def get_employee_id(employee_name: str, attendance_file_path: str = 'input/勤怠履歴.csv') -> str:
    """勤怠CSVから従業員IDを正しく取得"""
    # 勤怠CSVから従業員IDマッピングを取得
    mapping = load_employee_id_mapping(attendance_file_path)
    
    if not mapping:
        # フォールバック: 従来の固定マッピング
        employee_ids = {
            '利光 梨絵': 'EMP001',
            '大宮 浩子': 'EMP002', 
            '早崎 友音': 'EMP003',
            '早崎 琴絵': 'EMP004',
            '萩原 真理子': 'EMP005'
        }
        return employee_ids.get(employee_name, f'EMP{hash(employee_name) % 1000:03d}')
    
    # まず元の名前で検索
    if employee_name in mapping:
        return mapping[employee_name]
    
    # 正規化した名前で検索
    normalized_name = normalize_name(employee_name)
    if normalized_name in mapping:
        return mapping[normalized_name]
    
    # 見つからない場合は、勤怠CSVに存在する従業員名を表示してエラー
    available_names = [name for name in mapping.keys() if not name.startswith('EMP')]
    print(f"警告: 従業員 '{employee_name}' (正規化後: '{normalized_name}') が勤怠CSVに見つかりません")
    print(f"利用可能な従業員名: {available_names[:10]}...")  # 最初の10名を表示
    
    # フォールバック: ハッシュベースのID生成
    return f'EMP{hash(employee_name) % 1000:03d}'

def main():
    print('=== 従業員ID取得機能のテスト ===')
    
    # 勤怠CSVから従業員IDマッピングを読み込み
    print('\n1. 従業員IDマッピングの読み込みテスト')
    mapping = load_employee_id_mapping('input/勤怠履歴.csv')
    
    if mapping:
        print(f'✅ マッピング数: {len(mapping)}')
        print('最初の5つのマッピング:')
        for i, (name, emp_id) in enumerate(list(mapping.items())[:5]):
            print(f'  {name} -> {emp_id}')
    else:
        print('❌ マッピングの読み込みに失敗しました')
        return
    
    # 実際の従業員名でテスト
    print('\n2. 従業員ID取得テスト')
    test_cases = ['笠間 京子', '存在しない従業員']
    
    for test_name in test_cases:
        result_id = get_employee_id(test_name, 'input/勤怠履歴.csv')
        print(f'\n従業員名: {test_name}')
        print(f'取得されたID: {result_id}')
        
        if test_name == '笠間 京子':
            # 期待される結果: s004（ハッシュベースのEMP859ではない）
            if result_id.startswith('s'):
                print('✅ 成功: 勤怠CSVから正しい従業員IDが取得されました')
            else:
                print('❌ 失敗: ハッシュベースのIDが生成されています')
        else:
            # 存在しない従業員の場合はハッシュベースのIDが期待される
            if result_id.startswith('EMP'):
                print('✅ 成功: 存在しない従業員に対してフォールバックIDが生成されました')
            else:
                print('❌ 失敗: 予期しないIDが生成されました')

if __name__ == '__main__':
    main()
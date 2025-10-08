#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jinjer形式CSVヘッダー構造の確認用スクリプト
"""

from optimal_attendance_export import create_jinjer_headers

def analyze_header_structure():
    """ヘッダー構造を詳細に分析"""
    headers = create_jinjer_headers()
    
    print(f"総ヘッダー数: {len(headers)}")
    print("\n=== ヘッダー構造詳細 ===")
    
    # 各セクションの開始位置を特定
    sections = {
        '基本情報': (0, 5),
        'スケジュール情報': (5, 20),
        '休日設定': (20, 21),
        '実際の出退勤時刻': (21, 41),
        '実際の休憩時刻': (41, 61),
        '食事時間': (61, 65),
        '外出・再入': (65, 85),
        '休日休暇': (85, 95),
        '管理情報': (95, 102),
        '直行・直帰': (102, 122),
        '打刻区分ID': (122, 172),
        '勤務状況フラグ': (172, 177),
        '労働時間計算': (177, 190),
        '乖離時間': (190, 194)
    }
    
    for section_name, (start, end) in sections.items():
        print(f"\n{section_name}: インデックス {start}-{end-1} ({end-start}列)")
        for i in range(start, min(end, len(headers))):
            print(f"  [{i:3d}] {headers[i]}")
    
    # 重要なインデックスを確認
    print("\n=== 重要なインデックス ===")
    key_indices = {
        '出勤1': 21,
        '退勤1': 22,
        '打刻区分ID:1': 122,
        '打刻区分ID:50': 171,
        '未打刻': 172,
        '実績確定状況': 176,
        '総労働時間': 177,
        '申請承認済法定外残業時間': 189
    }
    
    for key, expected_index in key_indices.items():
        if expected_index < len(headers):
            actual_header = headers[expected_index]
            print(f"  インデックス {expected_index:3d}: 期待='{key}', 実際='{actual_header}'")
            if key not in actual_header and actual_header not in key:
                print(f"    ⚠️  不一致！")
        else:
            print(f"  インデックス {expected_index:3d}: 期待='{key}', 実際=範囲外")

if __name__ == "__main__":
    analyze_header_structure()

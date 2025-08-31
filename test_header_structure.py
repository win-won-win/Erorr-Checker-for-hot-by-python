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
        'スケジュール情報': (5, 18),
        '休日設定': (18, 19),
        '実際の出退勤時刻': (19, 39),
        '実際の休憩時刻': (39, 59),
        '食事時間': (59, 63),
        '外出・再入': (63, 83),
        '休日休暇': (83, 93),
        '管理情報': (93, 100),
        '直行・直帰': (100, 120),
        '打刻区分ID': (120, 170),
        '勤務状況フラグ': (170, 175),
        '労働時間計算': (175, 188),
        '乖離時間': (188, 192)
    }
    
    for section_name, (start, end) in sections.items():
        print(f"\n{section_name}: インデックス {start}-{end-1} ({end-start}列)")
        for i in range(start, min(end, len(headers))):
            print(f"  [{i:3d}] {headers[i]}")
    
    # 重要なインデックスを確認
    print("\n=== 重要なインデックス ===")
    key_indices = {
        '出勤1': 19,
        '退勤1': 20,
        '打刻区分ID:1': 120,
        '打刻区分ID:50': 169,
        '未打刻': 170,
        '実績確定状況': 174,
        '総労働時間': 175,
        '申請承認済法定外残業時間': 187
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
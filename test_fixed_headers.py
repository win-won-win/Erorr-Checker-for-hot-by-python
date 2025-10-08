#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修正後のjinjer形式CSVヘッダー構造の確認
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from optimal_attendance_export import create_jinjer_headers

def test_fixed_structure():
    """修正後の194列構造をテスト"""
    headers = create_jinjer_headers()
    
    print(f"総ヘッダー数: {len(headers)}")
    print("\n=== 修正後の構造確認 ===")
    
    # 重要なインデックスを確認
    key_indices = {
        '出勤1': 21,
        '退勤1': 22,
        '打刻区分ID:1': 122,
        '打刻区分ID:10': 131,
        '打刻区分ID:50': 171,
        '未打刻': 172,
        '実績確定状況': 176,
        '総労働時間': 177,
        '申請承認済法定外残業時間': 189
    }
    
    print("=== 重要なインデックス確認 ===")
    all_correct = True
    for key, expected_index in key_indices.items():
        if expected_index < len(headers):
            actual_header = headers[expected_index]
            is_correct = key in actual_header or actual_header in key
            status = "✅" if is_correct else "❌"
            print(f"  {status} インデックス {expected_index:3d}: 期待='{key}', 実際='{actual_header}'")
            if not is_correct:
                all_correct = False
        else:
            print(f"  ❌ インデックス {expected_index:3d}: 期待='{key}', 実際=範囲外")
            all_correct = False
    
    print(f"\n=== 結果 ===")
    if all_correct and len(headers) == 194:
        print("✅ すべてのテストが成功しました！")
        print("✅ ヘッダー数も194列で正しいです。")
    else:
        print("❌ 一部のテストが失敗しました。")
        if len(headers) != 194:
            print(f"❌ ヘッダー数が間違っています: 期待=194, 実際={len(headers)}")
    
    return all_correct and len(headers) == 194

if __name__ == "__main__":
    success = test_fixed_structure()
    sys.exit(0 if success else 1)

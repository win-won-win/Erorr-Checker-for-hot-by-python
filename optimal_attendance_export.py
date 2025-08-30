#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最適勤怠データ出力機能
jinjer形式CSV（133列）を出力する
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import io
from typing import List, Dict, Any
import calendar
from src import normalize_name, parse_date_any, parse_minute_of_day

def create_jinjer_headers() -> List[str]:
    """jinjer形式CSVのヘッダー（133列）を生成"""
    headers = [
        # 基本情報（5列）
        '名前', '*従業員ID', '*年月日', '*打刻グループID', '所属グループ名',
        
        # スケジュール情報（13列）
        'スケジュール雛形ID', '出勤予定時刻', '退勤予定時刻',
        '休憩予定時刻1', '復帰予定時刻1', '休憩予定時刻2', '復帰予定時刻2',
        '休憩予定時刻3', '復帰予定時刻3', '休憩予定時刻4', '復帰予定時刻4',
        '休憩予定時刻5', '復帰予定時刻5',
        'スケジュール外休憩予定時刻', 'スケジュール外復帰予定時刻',
        
        # 休日設定（1列）
        '休日（0:法定休日1:所定休日2:法休(振替休出)3:所休(振替休出)4:法休(時間外休出)5:所休(時間外休出)）',
        
        # 実際の出退勤時刻（20列）- 最大10シフト対応
        '出勤1', '退勤1', '出勤2', '退勤2', '出勤3', '退勤3', '出勤4', '退勤4', '出勤5', '退勤5',
        '出勤6', '退勤6', '出勤7', '退勤7', '出勤8', '退勤8', '出勤9', '退勤9', '出勤10', '退勤10',
        
        # 実際の休憩時刻（20列）- 最大10回休憩対応
        '休憩1', '復帰1', '休憩2', '復帰2', '休憩3', '復帰3', '休憩4', '復帰4', '休憩5', '復帰5',
        '休憩6', '復帰6', '休憩7', '復帰7', '休憩8', '復帰8', '休憩9', '復帰9', '休憩10', '復帰10',
        
        # 食事時間（4列）
        '食事1開始', '食事1終了', '食事2開始', '食事2終了',
        
        # 外出・再入（20列）- 最大10回外出対応
        '外出1', '再入1', '外出2', '再入2', '外出3', '再入3', '外出4', '再入4', '外出5', '再入5',
        '外出6', '再入6', '外出7', '再入7', '外出8', '再入8', '外出9', '再入9', '外出10', '再入10',
        
        # 休日休暇（10列）
        '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
        '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由',
        
        # 管理情報（7列）
        '打刻時コメント', '管理者備考',
        '勤務状況（0:未打刻1:欠勤）', '遅刻取消処理の有無（0:無1:有）', '早退取消処理の有無（0:無1:有）',
        '遅刻（0:有1:無）', '早退（0:有1:無）',
        
        # 直行・直帰（20列）- 最大10シフト対応
        '直行1', '直帰1', '直行2', '直帰2', '直行3', '直帰3', '直行4', '直帰4', '直行5', '直帰5',
        '直行6', '直帰6', '直行7', '直帰7', '直行8', '直帰8', '直行9', '直帰9', '直行10', '直帰10',
    ]
    
    # 打刻区分ID（50列）
    for i in range(1, 51):
        headers.append(f'打刻区分ID:{i}')
    
    # 勤務状況フラグ（5列）
    headers.extend(['未打刻', '欠勤', '休日打刻', '休暇打刻', '実績確定状況'])
    
    # 労働時間計算（13列）
    headers.extend([
        '総労働時間', '実労働時間', '休憩時間', '総残業時間',
        '法定内残業時間（スケジュール軸）', '法定内残業時間（労働時間軸）', '法定外残業時間', '深夜時間',
        '不足労働時間数（スケジュール軸）', '不足労働時間数（労働時間軸）',
        '申請承認済総残業時間', '申請承認済法定内残業時間', '申請承認済法定外残業時間'
    ])
    
    # 乖離時間（4列）
    headers.extend([
        '出勤乖離時間（出勤時刻ー入館時刻）', '退勤乖離時間（退館時刻ー退勤時刻）',
        '出勤乖離時間（出勤時刻ーPC起動時刻）', '退勤乖離時間（PC停止時刻ー退勤時刻）'
    ])
    
    return headers

def time_to_minutes(time_str: str, is_end_time: bool = False) -> int:
    """時間を分に変換（24時間対応）"""
    if not time_str or time_str == '':
        return 0
    
    if time_str == '24:00' or (time_str == '0:00' and is_end_time):
        return 24 * 60  # 1440分
    
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours * 60 + minutes
    except:
        return 0

def minutes_to_time(minutes: int) -> str:
    """分を時:分形式に変換"""
    if minutes >= 24 * 60:
        return '24:00'
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}:{mins:02d}"

def format_time_for_csv(time_str: str) -> str:
    """CSV出力用の時間フォーマット"""
    if not time_str or time_str == '':
        return ''
    return time_str

def merge_overlapping_shifts(shifts: List[Dict]) -> List[Dict]:
    """2時間ルール適用：シフトを結合"""
    if not shifts or len(shifts) <= 1:
        return shifts
    
    # 時間順にソート
    sorted_shifts = sorted(shifts, key=lambda x: time_to_minutes(x.get('work_start', '0:00')))
    merged = []
    
    for shift in sorted_shifts:
        if not shift.get('work_start') or not shift.get('work_end'):
            continue
            
        current_start = time_to_minutes(shift['work_start'], False)
        current_end = time_to_minutes(shift['work_end'], True)
        
        # 最後に追加されたシフトと重複・連続チェック
        if merged:
            last_shift = merged[-1]
            last_end = time_to_minutes(last_shift['work_end'], True)
            
            # 2時間（120分）未満の間隔は連続とみなす
            if current_start - last_end < 120:
                # 結合：終了時間を延長
                new_end_time = max(last_end, current_end)
                last_shift['work_end'] = minutes_to_time(new_end_time)
                continue
        
        # 新しいシフトとして追加
        merged.append({
            'work_start': minutes_to_time(current_start),
            'work_end': minutes_to_time(current_end)
        })
    
    return merged

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

def generate_jinjer_csv(selected_employees: List[str], target_month: str, attendance_data: pd.DataFrame) -> str:
    """jinjer形式CSVを生成"""
    headers = create_jinjer_headers()
    csv_content = ','.join(headers) + '\n'
    
    # 対象月の全日付を生成
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    for employee in selected_employees:
        # 従業員の勤怠データを取得
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        
        # 従業員IDを勤怠データから直接取得
        employee_id = ''
        if not employee_data.empty:
            employee_id = str(employee_data.iloc[0].get('*従業員ID', '')).strip()
        
        # 勤怠データにない場合はフォールバック関数を使用
        if not employee_id or employee_id == 'nan':
            employee_id = get_employee_id(employee)
        
        for date in all_dates:
            row = [''] * len(headers)
            
            # 基本情報の設定
            row[0] = employee  # 名前
            row[1] = employee_id  # *従業員ID（勤怠CSVから取得）
            row[2] = date  # *年月日
            row[3] = '1'  # *打刻グループID
            row[4] = '株式会社hot'  # 所属グループ名
            
            # その日の勤務データを検索
            date_data = employee_data[
                pd.to_datetime(employee_data['*年月日']).dt.strftime('%Y-%m-%d') == date
            ]
            
            if not date_data.empty:
                # 勤務データがある場合
                day_record = date_data.iloc[0]
                
                # シフトデータを構築
                shifts = []
                for i in range(1, 11):  # 最大10シフト
                    start_col = f'出勤{i}'
                    end_col = f'退勤{i}'
                    
                    if start_col in day_record and end_col in day_record:
                        start_time = str(day_record[start_col]).strip()
                        end_time = str(day_record[end_col]).strip()
                        
                        if start_time and end_time and start_time != 'nan' and end_time != 'nan':
                            shifts.append({
                                'work_start': start_time,
                                'work_end': end_time
                            })
                
                # 2時間ルール適用
                merged_shifts = merge_overlapping_shifts(shifts)
                
                # 最大10シフトまで対応
                for i, shift in enumerate(merged_shifts[:10]):
                    start_index = 19 + (i * 2)  # 出勤1=19, 出勤2=21, ...
                    end_index = start_index + 1  # 退勤1=20, 退勤2=22, ...
                    
                    if start_index < len(headers) and end_index < len(headers):
                        row[start_index] = format_time_for_csv(shift['work_start'])
                        row[end_index] = format_time_for_csv(shift['work_end'])
                
                # 管理情報の設定（勤務状況、遅刻取消処理等）- 空欄のまま
                # row[95-99]は既に''で初期化されているので何もしない
                
                # 直行・直帰の設定 - 空欄のまま
                # row[100-119]は既に''で初期化されているので何もしない
                
                # 打刻区分ID（1-50にFALSE）
                stamp_index = 122  # 打刻区分IDの開始位置（正しいインデックス）
                for i in range(50):  # 打刻区分ID:1-50にFALSEを設定
                    if stamp_index + i < len(headers):
                        row[stamp_index + i] = 'FALSE'
                
                # 勤務状況フラグ（未打刻、欠勤、休日打刻、休暇打刻、実績確定状況）を空欄に設定
                status_flag_index = 172  # 勤務状況フラグの開始位置（打刻区分ID:50の次）
                for i in range(5):  # 5つの勤務状況フラグを空欄に設定
                    if status_flag_index + i < len(headers):
                        row[status_flag_index + i] = ''
                
                # 労働時間の設定（サンプル値）
                labor_index = 177  # 労働時間計算の開始位置（勤務状況フラグ5個の後）
                if len(merged_shifts) > 0:
                    total_minutes = sum(
                        time_to_minutes(shift['work_end'], True) - time_to_minutes(shift['work_start'], False)
                        for shift in merged_shifts
                    )
                    total_hours = total_minutes / 60
                    
                    row[labor_index] = f"{int(total_hours)}:{int((total_hours % 1) * 60):02d}"  # 総労働時間
                    row[labor_index + 1] = f"{int(total_hours - 1)}:{int(((total_hours - 1) % 1) * 60):02d}"  # 実労働時間（休憩1時間差し引き）
                    row[labor_index + 2] = '1:00'  # 休憩時間
                    
                    if total_hours > 8:
                        overtime = total_hours - 8
                        row[labor_index + 3] = f"{int(overtime)}:{int((overtime % 1) * 60):02d}"  # 総残業時間
                        row[labor_index + 6] = f"{int(overtime)}:{int((overtime % 1) * 60):02d}"  # 法定外残業時間
            else:
                # 勤務データがない場合：初期データとして設定
                row[19] = '0:00'  # 出勤1
                row[20] = '24:00'  # 退勤1
            
            # CSVの1行として追加
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content

def show_optimal_attendance_export():
    """最適勤怠データ出力UI"""
    st.markdown("## 🎯 最適勤怠データ出力")
    
    # 勤怠データの読み込み確認
    try:
        attendance_file_path = 'input/勤怠履歴.csv'
        attendance_df = pd.read_csv(attendance_file_path, encoding='cp932')
        
        # 利用可能な従業員リストを取得
        available_employees = []
        for _, row in attendance_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        if not available_employees:
            st.error("勤怠データから従業員情報を取得できませんでした。")
            return
        
        st.success(f"勤怠データを読み込みました。利用可能な従業員: {len(available_employees)}名")
        
        # 対象月の選択
        col1, col2 = st.columns(2)
        with col1:
            target_year = st.selectbox("対象年", range(2023, 2026), index=2)
        with col2:
            target_month = st.selectbox("対象月", range(1, 13), index=datetime.now().month - 1)
        
        target_month_str = f"{target_year}-{target_month:02d}"
        
        # 従業員選択
        st.markdown("### 👥 出力対象従業員の選択")
        
        # 全選択・全解除ボタン
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            if st.button("全員選択", key="select_all_export"):
                st.session_state.selected_employees_export = available_employees.copy()
                st.rerun()
        with col2:
            if st.button("選択解除", key="clear_all_export"):
                st.session_state.selected_employees_export = []
                st.rerun()
        
        # セッション状態の初期化
        if 'selected_employees_export' not in st.session_state:
            st.session_state.selected_employees_export = []
        
        # 従業員チェックボックス
        st.markdown("#### チェックボックスで従業員を選択してください")
        
        # 3列レイアウトでチェックボックスを表示
        cols = st.columns(3)
        for i, employee in enumerate(sorted(available_employees)):
            with cols[i % 3]:
                is_selected = employee in st.session_state.selected_employees_export
                if st.checkbox(employee, value=is_selected, key=f"emp_check_{i}"):
                    if employee not in st.session_state.selected_employees_export:
                        st.session_state.selected_employees_export.append(employee)
                else:
                    if employee in st.session_state.selected_employees_export:
                        st.session_state.selected_employees_export.remove(employee)
        
        # 選択された従業員の表示
        if st.session_state.selected_employees_export:
            st.info(f"選択された従業員: {len(st.session_state.selected_employees_export)}名")
            with st.expander("選択された従業員一覧"):
                for i, emp in enumerate(st.session_state.selected_employees_export, 1):
                    st.write(f"{i}. {emp}")
        
        # CSV出力ボタン
        if st.session_state.selected_employees_export:
            st.markdown("### 📥 CSV出力")
            
            if st.button("🎯 最適勤怠データをCSV出力", type="primary", key="export_csv"):
                with st.spinner("CSV生成中..."):
                    try:
                        # jinjer形式CSVを生成
                        csv_content = generate_jinjer_csv(
                            st.session_state.selected_employees_export,
                            target_month_str,
                            attendance_df
                        )
                        
                        # ダウンロードボタン
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"最適勤怠データ_{target_month_str}_{timestamp}.csv"
                        
                        st.download_button(
                            label="📥 CSVファイルをダウンロード",
                            data=csv_content.encode('shift_jis', errors='ignore'),
                            file_name=filename,
                            mime="text/csv",
                            help="jinjer形式（133列）の最適勤怠データCSVファイル"
                        )
                        
                        st.success(f"✅ CSV生成完了！{len(st.session_state.selected_employees_export)}名の勤怠データを出力しました。")
                        
                        # 生成されたCSVの詳細情報
                        lines = csv_content.count('\n') - 1  # ヘッダー行を除く
                        st.info(f"📊 出力詳細: {lines}行のデータ（ヘッダー含む{lines + 1}行）")
                        
                    except Exception as e:
                        st.error(f"CSV生成エラー: {str(e)}")
        else:
            st.warning("出力対象の従業員を選択してください。")
            
    except FileNotFoundError:
        st.error("勤怠履歴.csvファイルが見つかりません。inputフォルダに配置してください。")
    except Exception as e:
        st.error(f"データ読み込みエラー: {str(e)}")

if __name__ == "__main__":
    show_optimal_attendance_export()
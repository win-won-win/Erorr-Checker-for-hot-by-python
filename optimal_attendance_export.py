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
import re
from src import normalize_name, parse_date_any, parse_minute_of_day
import os
import glob

def create_jinjer_headers() -> List[str]:
    """jinjer形式CSVのヘッダー（133列）を生成"""
    headers = []
    
    # 基本情報（5列）
    headers.extend([
        '名前', '*従業員ID', '*年月日', '*打刻グループID', '所属グループ名'
    ])
    
    # スケジュール情報（14列）- スケジュール外復帰予定時刻を追加
    headers.extend([
        'スケジュール雛形ID', '出勤予定時刻', '退勤予定時刻',
        '休憩予定時刻1', '復帰予定時刻1', '休憩予定時刻2', '復帰予定時刻2',
        '休憩予定時刻3', '復帰予定時刻3', '休憩予定時刻4', '復帰予定時刻4',
        '休憩予定時刻5', '復帰予定時刻5', 'スケジュール外休憩予定時刻', 'スケジュール外復帰予定時刻'
    ])
    
    # 休日設定（1列）
    headers.extend([
        '休日（0:法定休日1:所定休日2:法休(振替休出)3:所休(振替休出)4:法休(時間外休出)5:所休(時間外休出)）'
    ])
    
    # 実際の出退勤時刻（20列）- 最大10シフト対応
    headers.extend([
        '出勤1', '退勤1', '出勤2', '退勤2', '出勤3', '退勤3', '出勤4', '退勤4', '出勤5', '退勤5',
        '出勤6', '退勤6', '出勤7', '退勤7', '出勤8', '退勤8', '出勤9', '退勤9', '出勤10', '退勤10'
    ])
    
    # 実際の休憩時刻（20列）- 最大10回休憩対応
    headers.extend([
        '休憩1', '復帰1', '休憩2', '復帰2', '休憩3', '復帰3', '休憩4', '復帰4', '休憩5', '復帰5',
        '休憩6', '復帰6', '休憩7', '復帰7', '休憩8', '復帰8', '休憩9', '復帰9', '休憩10', '復帰10'
    ])
    
    # 食事時間（4列）
    headers.extend([
        '食事1開始', '食事1終了', '食事2開始', '食事2終了'
    ])
    
    # 外出・再入（10列）- 5回に削減
    headers.extend([
        '外出1', '再入1', '外出2', '再入2', '外出3', '再入3', '外出4', '再入4', '外出5', '再入5'
    ])
    
    # 休日休暇（10列）
    headers.extend([
        '休日休暇名1', '休日休暇名1：種別', '休日休暇名1：開始時間', '休日休暇名1：終了時間', '休日休暇名1：理由',
        '休日休暇名2', '休日休暇名2：種別', '休日休暇名2：開始時間', '休日休暇名2：終了時間', '休日休暇名2：理由'
    ])
    
    # 管理情報（7列）
    headers.extend([
        '打刻時コメント', '管理者備考',
        '勤務状況（0:未打刻1:欠勤）', '遅刻取消処理の有無（0:無1:有）', '早退取消処理の有無（0:無1:有）',
        '遅刻（0:有1:無）', '早退（0:有1:無）'
    ])
    
    # 直行・直帰（10列）- 5シフトに削減
    headers.extend([
        '直行1', '直帰1', '直行2', '直帰2', '直行3', '直帰3', '直行4', '直帰4', '直行5', '直帰5'
    ])
    
    # 打刻区分ID（10列）
    for i in range(1, 11):
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
    
    # 乖離時間（3列）- 133列制限のため3列に削減
    headers.extend([
        '出勤乖離時間（出勤時刻ー入館時刻）', '退勤乖離時間（退館時刻ー退勤時刻）',
        '出勤乖離時間（出勤時刻ーPC起動時刻）'
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
    """1時間半ルール適用：シフトを結合して最適な勤務時間を算出
    
    1時間半（90分）未満の間隔で区切られたシフトを結合し、
    最小出勤回数かつ最小出勤時間を実現する。
    
    例: 0:00-0:30, 1:00-2:00, 4:00-5:00, 7:00-8:00, 8:00-9:00
    → 0:00-5:00, 7:00-9:00 (2回出勤、5時間+2時間=7時間)
    → 0:00-9:00 (1回出勤、9時間) より2時間短縮
    """
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
            
            # 1時間半（90分）未満の間隔は連続とみなす
            if current_start - last_end < 90:
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

def convert_japanese_date_to_iso(japanese_date: str) -> str:
    """和暦日付を西暦ISO形式に変換
    
    例: '令和07年06月01日 (日)' -> '2025-06-01'
    """
    if not japanese_date or japanese_date.strip() == '':
        return ''
    
    try:
        # 和暦パターンをマッチ
        pattern = r'令和(\d+)年(\d+)月(\d+)日'
        match = re.search(pattern, japanese_date)
        
        if match:
            reiwa_year = int(match.group(1))
            month = int(match.group(2))
            day = int(match.group(3))
            
            # 令和元年は2019年、令和2年は2020年...
            western_year = 2018 + reiwa_year
            
            return f"{western_year:04d}-{month:02d}-{day:02d}"
        
        # 既に西暦形式の場合はそのまま返す
        if re.match(r'\d{4}-\d{2}-\d{2}', japanese_date):
            return japanese_date
        
        # その他の形式は空文字を返す
        return ''
        
    except Exception as e:
        print(f"日付変換エラー: {japanese_date} -> {str(e)}")
        return ''

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

def load_service_data_from_session() -> pd.DataFrame:
    """Streamlitセッション状態からサービス実績データを読み込み、複数CSVを統合"""
    service_data = []
    
    # セッション状態からサービス実績データを取得
    if 'service_data_list' in st.session_state and st.session_state.service_data_list:
        for service_df in st.session_state.service_data_list:
            if service_df is not None and not service_df.empty:
                # サービス実績データを抽出
                for _, row in service_df.iterrows():
                    # 様々なカラム名に対応
                    employee = ''
                    date = ''
                    start_time = ''
                    end_time = ''
                    
                    # 担当者名の取得（複数のカラム名に対応）
                    for col in ['担当所員', '担当者', '職員名', '従業員名', '名前']:
                        if col in row and str(row[col]).strip():
                            employee = str(row[col]).strip()
                            break
                    
                    # 日付の取得（複数のカラム名に対応）
                    for col in ['日付', 'サービス提供日', '実施日', '年月日']:
                        if col in row and str(row[col]).strip():
                            date = str(row[col]).strip()
                            break
                    
                    # 開始時間の取得（複数のカラム名に対応）
                    for col in ['開始時間', 'サービス開始時間', '開始', '開始時刻']:
                        if col in row and str(row[col]).strip():
                            start_time = str(row[col]).strip()
                            break
                    
                    # 終了時間の取得（複数のカラム名に対応）
                    for col in ['終了時間', 'サービス終了時間', '終了', '終了時刻']:
                        if col in row and str(row[col]).strip():
                            end_time = str(row[col]).strip()
                            break
                    
                    if employee and date and start_time and end_time:
                        # 従業員名を正規化
                        normalized_employee = normalize_name(employee)
                        
                        # 日付を西暦形式に変換
                        iso_date = convert_japanese_date_to_iso(date)
                        if not iso_date:
                            iso_date = date  # 変換できない場合は元の日付を使用
                        
                        # デバッグ情報: 日付変換
                        if hasattr(st, 'session_state') and date != iso_date:
                            st.write(f"    📅 日付変換: '{date}' -> '{iso_date}'")
                        
                        service_data.append({
                            'employee': employee,  # 元の名前
                            'employee_normalized': normalized_employee,  # 正規化した名前
                            'date': iso_date,  # 西暦形式に変換した日付
                            'original_date': date,  # 元の日付形式
                            'start_time': start_time,
                            'end_time': end_time,
                            'service_content': str(row.get('サービス内容', row.get('内容', ''))).strip(),
                            'implementation_time': str(row.get('実施時間', row.get('時間', ''))).strip()
                        })
    
    # 統合されたDataFrameを返す
    result_df = pd.DataFrame(service_data)
    
    # デバッグ情報（常に表示）
    if hasattr(st, 'session_state'):
        st.info(f"🔍 セッション状態確認:")
        st.write(f"  - service_data_list存在: {'service_data_list' in st.session_state}")
        if 'service_data_list' in st.session_state:
            st.write(f"  - service_data_listの長さ: {len(st.session_state.service_data_list) if st.session_state.service_data_list else 0}")
        
        st.info(f"🔍 統合されたサービス実績データ: {len(result_df)}行")
        if not result_df.empty:
            unique_employees = result_df['employee'].nunique()
            unique_dates = result_df['date'].nunique()
            st.write(f"  従業員数: {unique_employees}, 日付数: {unique_dates}")
            
            # サンプルデータを表示
            st.write("サンプルデータ（最初の5行）:")
            st.dataframe(result_df.head())
        else:
            st.warning("⚠️ サービス実績データが空です")
    
    return result_df

def load_service_data_from_input_dir(workdir: str = None) -> pd.DataFrame:
    """inputディレクトリから直接サービス実績CSVを読み込み"""
    service_data = []
    
    # inputディレクトリのパスを決定
    if workdir and os.path.exists(workdir):
        input_dir = os.path.join(workdir, "input")
    else:
        input_dir = "input"
    
    if not os.path.exists(input_dir):
        return pd.DataFrame(service_data)
    
    # inputディレクトリ内のCSVファイルを取得（勤怠履歴以外）
    csv_files = [f for f in os.listdir(input_dir) if f.endswith('.csv')]
    service_files = [f for f in csv_files if '勤怠' not in f and 'attendance' not in f.lower()]
    
    # デバッグ情報
    if hasattr(st, 'session_state'):
        st.info(f"🔍 inputディレクトリ: {input_dir}")
        st.write(f"  全CSVファイル: {csv_files}")
        st.write(f"  サービス実績ファイル: {service_files}")
    
    for service_file in service_files:
        file_path = os.path.join(input_dir, service_file)
        try:
            # 複数のエンコーディングを試行
            df = None
            for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                continue
            
            # デバッグ情報
            if hasattr(st, 'session_state'):
                st.success(f"✅ {service_file}を読み込み: {len(df)}行")
                st.write(f"  カラム: {df.columns.tolist()}")
            
            # サービス実績データを抽出
            for _, row in df.iterrows():
                # 様々なカラム名に対応
                employee = ''
                date = ''
                start_time = ''
                end_time = ''
                
                # 担当者名の取得（複数のカラム名に対応）
                for col in ['担当所員', '担当者', '職員名', '従業員名', '名前']:
                    if col in row and str(row[col]).strip():
                        employee = str(row[col]).strip()
                        break
                
                # 日付の取得（複数のカラム名に対応）
                for col in ['日付', 'サービス提供日', '実施日', '年月日']:
                    if col in row and str(row[col]).strip():
                        date = str(row[col]).strip()
                        break
                
                # 開始時間の取得（複数のカラム名に対応）
                for col in ['開始時間', 'サービス開始時間', '開始', '開始時刻']:
                    if col in row and str(row[col]).strip():
                        start_time = str(row[col]).strip()
                        break
                
                # 終了時間の取得（複数のカラム名に対応）
                for col in ['終了時間', 'サービス終了時間', '終了', '終了時刻']:
                    if col in row and str(row[col]).strip():
                        end_time = str(row[col]).strip()
                        break
                
                if employee and date and start_time and end_time:
                    # 従業員名を正規化
                    normalized_employee = normalize_name(employee)
                    
                    # 日付を西暦形式に変換
                    iso_date = convert_japanese_date_to_iso(date)
                    if not iso_date:
                        iso_date = date  # 変換できない場合は元の日付を使用
                    
                    service_data.append({
                        'employee': employee,  # 元の名前
                        'employee_normalized': normalized_employee,  # 正規化した名前
                        'date': iso_date,  # 西暦形式に変換した日付
                        'original_date': date,  # 元の日付形式
                        'start_time': start_time,
                        'end_time': end_time,
                        'service_content': str(row.get('サービス内容', row.get('内容', ''))).strip(),
                        'implementation_time': str(row.get('実施時間', row.get('時間', ''))).strip()
                    })
        
        except Exception as e:
            if hasattr(st, 'session_state'):
                st.error(f"❌ {service_file}の読み込みエラー: {str(e)}")
    
    result_df = pd.DataFrame(service_data)
    
    # デバッグ情報
    if hasattr(st, 'session_state'):
        st.info(f"🔍 inputディレクトリから統合されたサービス実績データ: {len(result_df)}行")
        if not result_df.empty:
            unique_employees = result_df['employee'].nunique()
            unique_dates = result_df['date'].nunique()
            st.write(f"  従業員数: {unique_employees}, 日付数: {unique_dates}")
            
            # サンプルデータを表示
            st.write("サンプルデータ（最初の5行）:")
            st.dataframe(result_df.head())
    
    return result_df

def load_service_data_from_results(workdir: str = None) -> pd.DataFrame:
    """エラーチェック結果からサービス実績データを読み込み（フォールバック用）"""
    service_data = []
    
    if workdir and os.path.exists(workdir):
        # 作業ディレクトリからresult_*.csvファイルを探す
        result_files = glob.glob(os.path.join(workdir, "result_*.csv"))
    else:
        # カレントディレクトリからresult_*.csvファイルを探す
        result_files = glob.glob("result_*.csv")
    
    for file_path in result_files:
        try:
            df = pd.read_csv(file_path, encoding="utf-8-sig")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(file_path, encoding="cp932")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="utf-8")
        
        # サービス実績データを抽出
        for _, row in df.iterrows():
            employee = str(row.get('担当所員', '')).strip()
            date = str(row.get('日付', '')).strip()
            start_time = str(row.get('開始時間', '')).strip()
            end_time = str(row.get('終了時間', '')).strip()
            
            if employee and date and start_time and end_time:
                # 従業員名を正規化
                normalized_employee = normalize_name(employee)
                
                # 日付を西暦形式に変換
                iso_date = convert_japanese_date_to_iso(date)
                if not iso_date:
                    iso_date = date  # 変換できない場合は元の日付を使用
                
                service_data.append({
                    'employee': employee,
                    'employee_normalized': normalized_employee,
                    'date': iso_date,
                    'original_date': date,
                    'start_time': start_time,
                    'end_time': end_time,
                    'service_content': str(row.get('サービス内容', '')).strip(),
                    'implementation_time': str(row.get('実施時間', '')).strip()
                })
    
    return pd.DataFrame(service_data)

def aggregate_daily_service_times(service_df: pd.DataFrame, employee: str, target_date: str) -> List[Dict]:
    """指定従業員・日付のサービス時間を集計してシフトリストを作成"""
    # サービスデータが空の場合は空のリストを返す
    if service_df.empty or 'employee' not in service_df.columns:
        return []
    
    # 従業員名を正規化
    normalized_employee = normalize_name(employee)
    
    # 指定従業員・日付のサービスデータを抽出（複数パターンで照合）
    try:
        daily_services = pd.DataFrame()
        
        # パターン1: 元の名前で検索
        daily_services = service_df[
            (service_df['employee'] == employee) &
            (service_df['date'] == target_date)
        ].copy()
        
        # パターン2: 正規化した名前で検索（employee_normalizedカラムを使用）
        if daily_services.empty and 'employee_normalized' in service_df.columns:
            daily_services = service_df[
                (service_df['employee_normalized'] == normalized_employee) &
                (service_df['date'] == target_date)
            ].copy()
        
        # パターン3: サービスデータの従業員名を動的に正規化して比較
        if daily_services.empty:
            matching_rows = []
            target_date_data = service_df[service_df['date'] == target_date]
            
            # デバッグ情報: パターン3開始
            if hasattr(st, 'session_state'):
                st.write(f"    🔄 パターン3開始: 対象日のデータ数={len(target_date_data)}")
            
            for _, row in target_date_data.iterrows():
                service_employee = str(row['employee']).strip()
                service_normalized = normalize_name(service_employee)
                
                # デバッグ情報: 各行の照合状況
                if hasattr(st, 'session_state'):
                    st.write(f"    照合中: '{service_employee}' -> 正規化: '{service_normalized}'")
                
                # 4つのパターンで照合
                match_found = False
                if service_employee == employee:
                    match_found = True
                    if hasattr(st, 'session_state'):
                        st.write(f"      ✅ パターン1マッチ: 元の名前同士")
                elif service_normalized == normalized_employee:
                    match_found = True
                    if hasattr(st, 'session_state'):
                        st.write(f"      ✅ パターン2マッチ: 正規化した名前同士")
                elif service_normalized == employee:
                    match_found = True
                    if hasattr(st, 'session_state'):
                        st.write(f"      ✅ パターン3マッチ: 正規化 vs 元")
                elif service_employee == normalized_employee:
                    match_found = True
                    if hasattr(st, 'session_state'):
                        st.write(f"      ✅ パターン4マッチ: 元 vs 正規化")
                
                if match_found:
                    matching_rows.append(row)
            
            if matching_rows:
                daily_services = pd.DataFrame(matching_rows)
        
        # デバッグ情報
        if hasattr(st, 'session_state'):
            st.write(f"  🔍 従業員名照合: '{employee}' -> 正規化: '{normalized_employee}'")
            if not daily_services.empty:
                st.write(f"    ✅ マッチしたサービス: {len(daily_services)}件")
                # マッチした従業員名を表示
                matched_names = daily_services['employee'].unique()
                st.write(f"    マッチした名前: {list(matched_names)}")
            else:
                # 利用可能な従業員名を表示
                available_employees = service_df['employee'].unique()[:10]  # 最初の10名
                available_normalized = [normalize_name(name) for name in available_employees]
                st.write(f"    ❌ マッチなし。利用可能な従業員名（最初の10名）:")
                for orig, norm in zip(available_employees, available_normalized):
                    st.write(f"      '{orig}' -> 正規化: '{norm}'")
                
    except KeyError as e:
        print(f"カラムアクセスエラー: {e}")
        print(f"利用可能なカラム: {service_df.columns.tolist()}")
        return []
    
    if daily_services.empty:
        return []
    
    shifts = []
    for _, service in daily_services.iterrows():
        start_time = service.get('start_time', '')
        end_time = service.get('end_time', '')
        
        if start_time and end_time and start_time != 'nan' and end_time != 'nan':
            shifts.append({
                'work_start': start_time,
                'work_end': end_time
            })
    
    return shifts

def get_attendance_shifts(attendance_data: pd.DataFrame, employee: str, target_date: str) -> List[Dict]:
    """勤怠履歴データから指定従業員・日付の出勤・退勤時間を取得"""
    shifts = []
    
    # 勤怠データから該当従業員・日付のデータを取得
    employee_data = attendance_data[
        (attendance_data['名前'].str.strip() == employee.strip()) &
        (attendance_data['*年月日'].astype(str) == target_date)
    ]
    
    if employee_data.empty:
        return []
    
    row = employee_data.iloc[0]
    
    # 出勤・退勤時間のペアを取得（最大10ペア）
    for i in range(1, 11):
        start_col = f'出勤{i}' if i > 1 else '出勤1'
        end_col = f'退勤{i}' if i > 1 else '退勤1'
        
        start_time = str(row.get(start_col, '')).strip()
        end_time = str(row.get(end_col, '')).strip()
        
        if start_time and end_time and start_time != 'nan' and end_time != 'nan':
            shifts.append({
                'work_start': start_time,
                'work_end': end_time
            })
    
    return shifts

def generate_jinjer_csv(selected_employees: List[str], target_month: str, attendance_data: pd.DataFrame, workdir: str = None) -> str:
    """jinjer形式CSVを生成（サービス実績データベースの最適勤務時間）
    
    1. セッション状態のサービス実績データを優先使用
    2. フォールバック1: エラーチェック結果のサービス実績データ
    3. フォールバック2: 勤怠履歴データの出勤・退勤時間
    
    1時間半ルールを適用してシフトを最適化し、
    打刻区分IDや勤務状況フラグを適切に設定する。
    """
    headers = create_jinjer_headers()
    csv_content = ','.join(headers) + '\n'
    
    # サービス実績データを読み込み（優先順位順）
    service_df = load_service_data_from_session()
    
    # セッション状態にデータがない場合はinputディレクトリから直接読み込み
    if service_df.empty:
        service_df = load_service_data_from_input_dir(workdir)
    
    # それでもデータがない場合はresult_*.csvから読み込み
    if service_df.empty:
        service_df = load_service_data_from_results(workdir)
    
    # デバッグ情報: サービス実績データの状況
    if hasattr(st, 'session_state'):
        st.write(f"📊 サービス実績データ読み込み結果:")
        st.write(f"  データフレーム形状: {service_df.shape}")
        if not service_df.empty:
            st.write(f"  カラム: {service_df.columns.tolist()}")
            if 'employee' in service_df.columns:
                unique_employees = service_df['employee'].unique()
                st.write(f"  従業員数: {len(unique_employees)}")
                st.write(f"  従業員名（最初の10名）: {list(unique_employees[:10])}")
            else:
                st.error("❌ 'employee'カラムが見つかりません")
            
            # 日付形式の確認
            if 'date' in service_df.columns:
                unique_dates = service_df['date'].unique()
                st.write(f"  日付数: {len(unique_dates)}")
                st.write(f"  日付形式サンプル（最初の10件）: {list(unique_dates[:10])}")
                
                # 大宮浩子のデータがある日付を確認
                omiya_data = service_df[service_df['employee_normalized'] == '大宮 浩子']
                if not omiya_data.empty:
                    omiya_dates = omiya_data['date'].unique()
                    st.write(f"  大宮浩子のサービス実績がある日付: {list(omiya_dates[:5])}")
                else:
                    st.write("  大宮浩子のサービス実績データなし")
                
                # 月別データ分布を確認
                service_df_temp = service_df.copy()
                service_df_temp['year_month'] = service_df_temp['date'].str[:7]  # YYYY-MM部分を抽出
                month_counts = service_df_temp['year_month'].value_counts().sort_index()
                st.write(f"  📅 月別データ分布: {dict(month_counts)}")
        else:
            st.error("❌ サービス実績データが空です")
    
    # 対象月の全日付を生成
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    for employee in selected_employees:
        # 従業員IDを勤怠データから取得
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        
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
            row[1] = employee_id  # *従業員ID
            row[2] = date  # *年月日
            row[3] = '1'  # *打刻グループID
            row[4] = '株式会社hot'  # 所属グループ名
            
            # サービス実績データからその日のシフトを取得
            shifts = aggregate_daily_service_times(service_df, employee, date)
            data_source = "service_data"
            
            # サービス実績データがない場合のみ勤怠履歴データから取得
            if not shifts:
                shifts = get_attendance_shifts(attendance_data, employee, date)
                data_source = "attendance_data"
                
                # デバッグ情報: どちらのデータも見つからない場合
                if not shifts:
                    data_source = "no_data"
            
            # デバッグ情報をStreamlitに出力（常に表示）
            if hasattr(st, 'session_state'):
                st.write(f"🔍 {employee} {date}: データソース={data_source}, シフト数={len(shifts)}")
                if shifts:
                    for i, shift in enumerate(shifts):
                        st.write(f"  元シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            
            if shifts:
                # シフトがある場合、1時間半ルールで最適化
                merged_shifts = merge_overlapping_shifts(shifts)
                
                # デバッグ情報: 最適化結果（常に表示）
                if hasattr(st, 'session_state'):
                    st.write(f"  最適化前: {len(shifts)}シフト -> 最適化後: {len(merged_shifts)}シフト")
                    for i, shift in enumerate(merged_shifts):
                        st.write(f"    最適化シフト{i+1}: {shift['work_start']}-{shift['work_end']}")
            else:
                # どちらのデータからもシフトが取得できない場合は空のシフト
                merged_shifts = []
                if hasattr(st, 'session_state'):
                    st.warning(f"⚠️ {employee} {date}: シフトデータが見つかりません")
            
            # 最大10シフトまで対応
            for i, shift in enumerate(merged_shifts[:10]):
                start_index = 21 + (i * 2)  # 出勤1=21, 出勤2=23, ...
                end_index = start_index + 1  # 退勤1=22, 退勤2=24, ...
                
                if start_index < len(headers) and end_index < len(headers):
                    row[start_index] = format_time_for_csv(shift['work_start'])
                    row[end_index] = format_time_for_csv(shift['work_end'])
            
            # 管理情報の設定（勤務状況、遅刻取消処理等）- 空欄のまま
            # row[95-99]は既に''で初期化されているので何もしない
            
            # 直行・直帰の設定 - 空欄のまま
            # row[100-119]は既に''で初期化されているので何もしない
            
            # 打刻区分ID（1-10にFALSE）
            stamp_index = 102  # 打刻区分IDの開始位置（修正：102が正しい位置）
            for i in range(10):  # 打刻区分ID:1-10にFALSEを設定
                if stamp_index + i < len(headers):
                    row[stamp_index + i] = 'FALSE'
            
            # 勤務状況フラグ（未打刻、欠勤、休日打刻、休暇打刻、実績確定状況）を空欄に設定
            status_flag_index = 112  # 勤務状況フラグの開始位置（修正：112が正しい位置）
            for i in range(5):  # 5つの勤務状況フラグを空欄に設定
                if status_flag_index + i < len(headers):
                    row[status_flag_index + i] = ''
            
            # 労働時間の設定（サンプル値）
            labor_index = 117  # 労働時間計算の開始位置（修正：117が正しい位置）
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
            
            # CSVの1行として追加
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content

def generate_0_24_jinjer_csv(selected_employees: List[str], target_month: str, attendance_data: pd.DataFrame) -> str:
    """0-24データ用jinjer形式CSVを生成（出勤1=0:00、退勤1=24:00）
    
    全日程で0:00-24:00の勤務として設定し、
    打刻区分IDや勤務状況フラグを適切に設定する。
    """
    headers = create_jinjer_headers()
    csv_content = ','.join(headers) + '\n'
    
    # 対象月の全日付を生成
    year, month = map(int, target_month.split('-'))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, days_in_month + 1)]
    
    for employee in selected_employees:
        # 従業員IDを勤怠データから取得
        employee_data = attendance_data[
            attendance_data['名前'].str.strip() == employee.strip()
        ].copy()
        
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
            row[1] = employee_id  # *従業員ID
            row[2] = date  # *年月日
            row[3] = '1'  # *打刻グループID
            row[4] = '株式会社hot'  # 所属グループ名
            
            # 0-24データの設定
            row[21] = '0:00'   # 出勤1
            row[22] = '24:00'  # 退勤1
            
            # 打刻区分ID（1-10にFALSE）
            stamp_index = 102  # 打刻区分IDの開始位置（修正：102が正しい位置）
            for i in range(10):
                if stamp_index + i < len(headers):
                    row[stamp_index + i] = 'FALSE'
            
            # 勤務状況フラグを空欄に設定
            status_flag_index = 112  # 勤務状況フラグの開始位置（修正：112が正しい位置）
            for i in range(5):
                if status_flag_index + i < len(headers):
                    row[status_flag_index + i] = ''
            
            # 労働時間の設定（24時間勤務）
            labor_index = 117  # 労働時間計算の開始位置（修正：117が正しい位置）
            row[labor_index] = '24:00'      # 総労働時間
            row[labor_index + 1] = '23:00'  # 実労働時間（休憩1時間差し引き）
            row[labor_index + 2] = '1:00'   # 休憩時間
            row[labor_index + 3] = '16:00'  # 総残業時間（8時間超過分）
            row[labor_index + 6] = '16:00'  # 法定外残業時間
            
            # CSVの1行として追加
            csv_content += ','.join([
                f'"{field}"' if ',' in str(field) else str(field)
                for field in row
            ]) + '\n'
    
    return csv_content

def show_optimal_attendance_export():
    """最適勤怠データ出力UI"""
    
    # デバッグモードの設定
    debug_mode = st.checkbox("🔍 デバッグモードを有効にする", value=False, help="データソースや最適化処理の詳細情報を表示します")
    st.session_state.debug_mode = debug_mode
    
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
                        # jinjer形式CSVを生成（サービス実績データベース）
                        csv_content = generate_jinjer_csv(
                            st.session_state.selected_employees_export,
                            target_month_str,
                            attendance_df,
                            None  # 作業ディレクトリは指定しない（カレントディレクトリから検索）
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
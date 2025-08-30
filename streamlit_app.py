import streamlit as st
import pandas as pd
import tempfile
import os
import io
import zipfile
import shutil
import subprocess
import sys
from datetime import datetime
import calendar
from typing import List, Dict, Any

# optimal_attendance_export.pyの機能をインポート
from optimal_attendance_export import (
    create_jinjer_headers,
    time_to_minutes,
    minutes_to_time,
    format_time_for_csv,
    merge_overlapping_shifts,
    get_employee_id,
    generate_jinjer_csv,
    show_optimal_attendance_export
)

# 詳細分析機能（関数定義）
def show_overlap_analysis(df):
    """重複の詳細分析を表示"""
    st.markdown("#### 📊 重複分析")
    
    # データの存在確認
    if 'H' not in df.columns:
        st.warning("重複時間（分）のカラムが見つかりません。データを再生成してください。")
        return
    
    # 重複データのフィルタリング
    overlap_data = df[df['H'].notna() & (pd.to_numeric(df['H'], errors='coerce') > 0)]
    
    if overlap_data.empty:
        st.info("重複データが見つかりませんでした。")
        return
    
    # 重複統計
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("重複件数", len(overlap_data))
    with col2:
        total_overlap_minutes = pd.to_numeric(overlap_data['H'], errors='coerce').sum()
        st.metric("総重複時間", f"{total_overlap_minutes:.0f}分")
    with col3:
        avg_overlap = pd.to_numeric(overlap_data['H'], errors='coerce').mean()
        st.metric("平均重複時間", f"{avg_overlap:.1f}分")
    with col4:
        max_overlap = pd.to_numeric(overlap_data['H'], errors='coerce').max()
        st.metric("最大重複時間", f"{max_overlap:.0f}分")
    
    # 重複タイプ別集計
    st.markdown("##### 重複タイプ別集計")
    if 'L' in overlap_data.columns and overlap_data['L'].notna().any():
        valid_type_data = overlap_data[overlap_data['L'].notna() & (overlap_data['L'] != '')]
        if not valid_type_data.empty:
            overlap_type_stats = valid_type_data.groupby('L').agg({
                'H': lambda x: len(x),  # 件数
                'C': 'nunique'  # 関与職員数
            })
            overlap_type_stats.columns = ['件数', '関与職員数']
            st.dataframe(overlap_type_stats, use_container_width=True)
        else:
            st.info("重複タイプの詳細データがありません。")
    else:
        st.info("重複タイプの詳細データがありません。")

def show_attendance_excess_analysis(df):
    """勤怠超過の詳細分析を表示"""
    st.markdown("#### 📊 勤怠超過分析")
    
    # データの存在確認
    if 'I' not in df.columns:
        st.warning("超過時間（分）のカラムが見つかりません。データを再生成してください。")
        return
    
    # 超過データのフィルタリング
    excess_data = df[df['I'].notna() & (pd.to_numeric(df['I'], errors='coerce') > 0)]
    
    if excess_data.empty:
        st.info("勤怠超過データが見つかりませんでした。")
        return
    
    # 超過統計
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("超過件数", len(excess_data))
    with col2:
        total_excess_minutes = pd.to_numeric(excess_data['I'], errors='coerce').sum()
        st.metric("総超過時間", f"{total_excess_minutes:.0f}分")
    with col3:
        avg_excess = pd.to_numeric(excess_data['I'], errors='coerce').mean()
        st.metric("平均超過時間", f"{avg_excess:.1f}分")
    with col4:
        max_excess = pd.to_numeric(excess_data['I'], errors='coerce').max()
        st.metric("最大超過時間", f"{max_excess:.0f}分")
    
    # カバー状況別集計
    st.markdown("##### カバー状況別集計")
    if 'M' in excess_data.columns and excess_data['M'].notna().any():
        valid_coverage_data = excess_data[excess_data['M'].notna() & (excess_data['M'] != '')]
        if not valid_coverage_data.empty:
            coverage_stats = valid_coverage_data.groupby('M').agg({
                'I': lambda x: len(x),  # 件数
                'C': 'nunique'  # 関与職員数
            })
            coverage_stats.columns = ['件数', '関与職員数']
            st.dataframe(coverage_stats, use_container_width=True)
        else:
            st.info("カバー状況の詳細データがありません。")
    else:
        st.info("カバー状況の詳細データがありません。")
    
    # 職員別超過ランキング
    st.markdown("##### 職員別超過時間ランキング（上位10名）")
    if 'C' in excess_data.columns:
        staff_excess = excess_data.groupby('C').agg({
            'I': lambda x: len(x),  # 超過件数
            'C': 'first'  # 職員名
        })
        staff_excess.columns = ['超過件数', '職員名']
        staff_excess = staff_excess.sort_values('超過件数', ascending=False).head(10)
        st.dataframe(staff_excess[['超過件数']], use_container_width=True)
    else:
        st.info("職員データがありません。")

def show_time_slot_analysis(df):
    """時間帯分析を表示"""
    st.markdown("#### 📊 時間帯分析")
    
    # 時間帯別のエラー分布
    if 'E' in df.columns and df['E'].notna().any():
        # 開始時間から時間帯を抽出
        df_copy = df.copy()
        df_copy['時間帯'] = df_copy['E'].apply(lambda x: f"{str(x)[:2]}:00" if pd.notna(x) and str(x) else "不明")
        
        time_slot_stats = df_copy.groupby('時間帯').agg({
            'A': lambda x: (x == '◯').sum(),  # エラー件数
            'C': 'count',  # 総件数
            'H': 'sum',  # 重複時間合計
            'I': 'sum'   # 超過時間合計
        }).round(1)
        time_slot_stats.columns = ['エラー件数', '総件数', '重複時間合計(分)', '超過時間合計(分)']
        time_slot_stats['エラー率'] = (time_slot_stats['エラー件数'] / time_slot_stats['総件数'] * 100).round(1)
        
        st.dataframe(time_slot_stats, use_container_width=True)
    else:
        st.info("時間帯分析用のデータが不足しています。")

def show_staff_workload_analysis(df):
    """職員負荷分析を表示"""
    st.markdown("#### 📊 職員負荷分析")
    
    if 'C' in df.columns and df['C'].notna().any():
        staff_workload = df.groupby('C').agg({
            'A': lambda x: (x == '◯').sum(),  # エラー件数
            'C': 'count',  # 総件数
            'H': 'sum',  # 重複時間合計
            'I': 'sum',  # 超過時間合計
            'N': 'mean'  # 平均勤務区間数
        }).round(1)
        staff_workload.columns = ['エラー件数', '総件数', '重複時間合計(分)', '超過時間合計(分)', '平均勤務区間数']
        staff_workload['エラー率'] = (staff_workload['エラー件数'] / staff_workload['総件数'] * 100).round(1)
        staff_workload = staff_workload.sort_values('エラー件数', ascending=False)
        
        st.dataframe(staff_workload, use_container_width=True)
    else:
        st.info("職員負荷分析用のデータが不足しています。")

def show_row_detail_modal(row):
    """選択された行の詳細情報をモーダル風に表示"""
    with st.expander(f"📋 詳細情報 - {row.get('C', 'N/A')} ({row.get('D', 'N/A')})", expanded=True):
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("**基本情報**")
            st.write(f"• エラー: {row.get('A', 'N/A')}")
            st.write(f"• カテゴリ: {row.get('B', 'N/A')}")
            st.write(f"• 担当所員: {row.get('C', 'N/A')}")
            st.write(f"• 日付: {row.get('D', 'N/A')}")
            st.write(f"• 時間: {row.get('E', 'N/A')} - {row.get('F', 'N/A')}")
        
        with col2:
            st.markdown("**詳細情報**")
            if pd.notna(row.get('H', 0)) and row.get('H', 0) > 0:
                st.write(f"• 重複時間: {row.get('H', 'N/A')}分")
                st.write(f"• 重複相手施設: {row.get('J', 'N/A')}")
            if pd.notna(row.get('I', 0)) and row.get('I', 0) > 0:
                st.write(f"• 超過時間: {row.get('I', 'N/A')}分")

def save_upload_to(path: str, uploaded_file):
    """アップロードされたファイルを指定されたパスに保存する"""
    import time
    import stat
    import tempfile
    
    debug_info = []
    
    try:
        debug_info.append(f"開始: path={path}")
        
        # ディレクトリが存在しない場合は作成
        dir_path = os.path.dirname(path)
        debug_info.append(f"ディレクトリパス: {dir_path}")
        
        os.makedirs(dir_path, exist_ok=True)
        debug_info.append(f"ディレクトリ作成完了: 存在={os.path.exists(dir_path)}")
        
        # ディレクトリの権限を確認・設定
        try:
            os.chmod(dir_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
            debug_info.append("ディレクトリ権限設定完了")
        except Exception as e:
            debug_info.append(f"ディレクトリ権限設定失敗: {e}")
        
        # ファイル名から特殊文字を正規化（ドロップボックス対応）
        import unicodedata
        normalized_path = unicodedata.normalize('NFC', path)
        debug_info.append(f"正規化パス: {normalized_path}")
        
        # 既存ファイルがあれば削除
        if os.path.exists(normalized_path):
            os.remove(normalized_path)
            debug_info.append("既存ファイル削除完了")
        
        # データを取得
        data = uploaded_file.getbuffer()
        expected_size = len(data)
        debug_info.append(f"データサイズ: {expected_size} bytes")
        
        # 一時ファイルを使用してより確実に保存
        temp_path = normalized_path + ".tmp"
        debug_info.append(f"一時ファイルパス: {temp_path}")
        
        # ファイル書き込み
        with open(temp_path, "wb") as f:
            f.write(data)
            f.flush()  # バッファをフラッシュ
            os.fsync(f.fileno())  # ディスクに強制書き込み
        
        debug_info.append("一時ファイル書き込み完了")
        
        # 一時ファイルの確認
        if not os.path.exists(temp_path):
            raise Exception(f"一時ファイルの作成に失敗: {temp_path}")
        
        temp_size = os.path.getsize(temp_path)
        debug_info.append(f"一時ファイルサイズ: {temp_size} bytes")
        
        if temp_size != expected_size:
            raise Exception(f"一時ファイルサイズが不正: 期待値={expected_size}, 実際={temp_size}")
        
        # 一時ファイルを最終ファイルに移動
        import shutil
        shutil.move(temp_path, normalized_path)
        debug_info.append("ファイル移動完了")
        
        # ファイル権限を設定
        try:
            os.chmod(normalized_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
            debug_info.append("ファイル権限設定完了")
        except Exception as e:
            debug_info.append(f"ファイル権限設定失敗: {e}")
        
        # 最終確認
        time.sleep(0.5)  # 500ms待機
        
        if not os.path.exists(normalized_path):
            raise Exception(f"最終確認でファイルが見つかりません: {normalized_path}")
        
        actual_size = os.path.getsize(normalized_path)
        debug_info.append(f"最終ファイルサイズ: {actual_size} bytes")
        
        if actual_size == 0:
            raise Exception(f"保存されたファイルのサイズが0です: {normalized_path}")
        
        if actual_size != expected_size:
            raise Exception(f"最終ファイルサイズが一致しません: 期待値={expected_size}, 実際={actual_size}")
        
        debug_info.append("保存処理完了")
        return normalized_path, debug_info
            
    except Exception as e:
        debug_info.append(f"エラー発生: {str(e)}")
        raise Exception(f"ファイル保存エラー ({path}): {str(e)}\nデバッグ情報: {'; '.join(debug_info)}")

def collect_summary(result_paths):
    summary_rows = []
    for p in result_paths:
        try:
            df = pd.read_csv(p, encoding="utf-8-sig")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(p, encoding="cp932")
            except UnicodeDecodeError:
                df = pd.read_csv(p, encoding="utf-8")
        total = len(df)
        err_cnt = int((df.get("エラー","") == "◯").sum())
        cat_counts = {}
        if "カテゴリ" in df.columns:
            for v, c in df["カテゴリ"].value_counts().items():
                if isinstance(v, str) and v:
                    cat_counts[v] = int(c)
        summary_rows.append({
            "ファイル": os.path.basename(p),
            "総件数": total,
            "エラー件数": err_cnt,
            **{f"カテゴリ:{k}": v for k, v in cat_counts.items()}
        })
    return pd.DataFrame(summary_rows)

def prepare_grid_data(result_paths):
    """
    result_*.csvファイルからグリッド表示用のDataFrameを作成
    指定された順序でカラムを並び替え、必要なカラムのみを含める
    """
    grid_data = []
    
    for p in result_paths:
        try:
            df = pd.read_csv(p, encoding="utf-8-sig")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(p, encoding="cp932")
            except UnicodeDecodeError:
                df = pd.read_csv(p, encoding="utf-8")
        
        # 指定された順序でカラムを構築
        for idx, row in df.iterrows():
            grid_row = {
                # 指定された順序: エラー　カテゴリ　代替職員リスト　担当所員　利用者名　日付　開始時間　終了時間　サービス詳細　重複時間　超過時間
                'エラー': row.get('エラー', ''),
                'カテゴリ': row.get('カテゴリ', ''),
                '代替職員リスト': row.get('代替職員リスト', 'ー'),
                '担当所員': row.get('担当所員', ''),
                '利用者名': row.get('利用者名', ''),
                '日付': row.get('日付', ''),
                '開始時間': row.get('開始時間', ''),
                '終了時間': row.get('終了時間', ''),
                'サービス詳細': f"{row.get('サービス内容', '')} - {row.get('実施時間', '')}".strip(' -'),
                '重複時間': row.get('重複時間（分）', 0),
                '超過時間': row.get('超過時間（分）', 0),
                # 勤務時間の詳細情報を追加
                'カバー状況': row.get('カバー状況', ''),
                'エラー職員勤務時間': row.get('エラー職員勤務時間', ''),
                '代替職員勤務時間': row.get('代替職員勤務時間', ''),
                '勤務時間詳細': row.get('勤務時間詳細', ''),
                '勤務時間外詳細': row.get('勤務時間外詳細', ''),
                '未カバー区間': row.get('未カバー区間', ''),
                '勤務区間数': row.get('勤務区間数', 0)
            }
            grid_data.append(grid_row)
    
    # 指定された順序でDataFrameを作成
    column_order = [
        'エラー', 'カテゴリ', '代替職員リスト', '担当所員', '利用者名',
        '日付', '開始時間', '終了時間', 'サービス詳細', '重複時間', '超過時間',
        'カバー状況', 'エラー職員勤務時間', '代替職員勤務時間', '勤務時間詳細',
        '勤務時間外詳細', '未カバー区間', '勤務区間数'
    ]
    
    df = pd.DataFrame(grid_data)
    return df[column_order] if not df.empty else pd.DataFrame(columns=column_order)

# ページ設定
st.set_page_config(page_title="サービス実態 × 勤怠 不整合チェック", layout="wide")

st.title("サービス実態 × 勤怠 不整合チェック UI")
st.markdown("施設ごとのサービス実態CSV（複数）と勤怠履歴CSVをアップロードし、ボタン1つで突合・検出とresult CSVの出力を行います。")

# セッション状態の初期化
if 'processing_complete' not in st.session_state:
    st.session_state.processing_complete = False
if 'result_paths' not in st.session_state:
    st.session_state.result_paths = []
if 'diagnostic_paths' not in st.session_state:
    st.session_state.diagnostic_paths = []
if 'summary_df' not in st.session_state:
    st.session_state.summary_df = None
if 'workdir' not in st.session_state:
    st.session_state.workdir = None

# サイドバーのオプション設定
with st.sidebar:
    st.header("オプション")
    identical_prefer = st.selectbox(
        "完全一致時のフラグ付与（施設名の昇順で）",
        options=["earlier", "later"],
        index=0,
        help="開始/終了が完全一致のときに、施設名の昇順で earlier/later のどちらにフラグ付与するか"
    )
    alt_delim = st.text_input("代替職員リストの区切り文字", value="/")
    use_schedule_when_missing = st.checkbox("実打刻が欠損のときに予定で代用する (--use-schedule-when-missing)", value=True)
    service_staff_col = st.text_input("サービス実態の従業員列名", value="担当所員")
    att_name_col = st.text_input("勤怠の従業員列名", value="名前")
    generate_diagnostics = st.checkbox("診断CSVを出力する", value=True)

# タブの作成
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📁 ファイルアップロード",
    "📊 検出サマリー",
    "📋 詳細データ",
    "💾 ダウンロード・最適化",
    "🎯 最適勤怠データ出力"
])

# タブ1: ファイルアップロード
with tab1:
    st.header("📁 ファイルアップロード")
    
    st.subheader("1. 施設ごとのサービス実態CSV（複数可）")
    st.markdown("サービス実態CSV（A,B,C... など複数）")
    svc_files = st.file_uploader(
        "Drag and drop files here", 
        type=["csv"], 
        accept_multiple_files=True, 
        key="svc",
        help="Limit 200MB per file • CSV"
    )
    
    # アップロードされたファイルの表示
    if svc_files:
        st.markdown("**アップロード済みファイル:**")
        for file in svc_files:
            file_size = len(file.getvalue()) / 1024  # KB
            if file_size < 1024:
                size_str = f"{file_size:.1f}KB"
            else:
                size_str = f"{file_size/1024:.1f}MB"
            st.write(f"• {file.name} ({size_str})")
    
    st.subheader("2. 勤怠履歴CSV（1件）")
    st.markdown("勤怠履歴CSV")
    att_file = st.file_uploader(
        "Drag and drop file here", 
        type=["csv"], 
        accept_multiple_files=False, 
        key="att",
        help="Limit 200MB per file • CSV"
    )
    
    # アップロードされたファイルの表示
    if att_file:
        file_size = len(att_file.getvalue()) / 1024  # KB
        if file_size < 1024:
            size_str = f"{file_size:.1f}KB"
        else:
            size_str = f"{file_size/1024:.1f}MB"
        st.write(f"• {att_file.name} ({size_str})")
    
    st.markdown("---")
    
    # 実行ボタン
    run = st.button("エラーチェックを実行する", type="primary", use_container_width=True)
    
    if run:
        if not svc_files:
            st.error("サービス実態CSVを1件以上アップロードしてください。")
            st.stop()
        if not att_file:
            st.error("勤怠履歴CSVをアップロードしてください。")
            st.stop()

        with st.spinner("処理中..."):
            # 作業用ディレクトリ
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            workdir = tempfile.mkdtemp(prefix=f"svc_att_check_{ts}_")
            indir = os.path.join(workdir, "input")
            os.makedirs(indir, exist_ok=True)

            # src.py を作業ディレクトリにコピー（同ディレクトリにある想定）
            # 実行環境ではこのアプリと同じフォルダに src.py を置いてください。
            src_source = os.path.join(os.path.dirname(__file__), "src.py")
            src_target = os.path.join(workdir, "src.py")
            shutil.copyfile(src_source, src_target)

            # アップロードファイルを保存
            # 施設CSVはアップロード名をそのまま使う（result_*.csvの施設名に影響）
            st.info(f"サービス実態CSVファイル数: {len(svc_files)}")
            
            # 同名ファイルの重複チェックと連番付与
            saved_files = {}
            saved_service_files = []
            
            for i, up in enumerate(svc_files):
                original_name = up.name
                base_name, ext = os.path.splitext(original_name)
                
                # 同名ファイルがある場合は連番を付与
                if original_name in saved_files:
                    saved_files[original_name] += 1
                    new_name = f"{base_name}_{saved_files[original_name]}{ext}"
                else:
                    saved_files[original_name] = 0
                    new_name = original_name
                
                file_path = os.path.join(indir, new_name)
                try:
                    # save_upload_toは正規化されたパスとデバッグ情報を返す
                    actual_path, debug_info = save_upload_to(file_path, up)
                    
                    # デバッグ情報を表示
                    with st.expander(f"🔧 デバッグ情報: {original_name}", expanded=False):
                        for info in debug_info:
                            st.write(f"• {info}")
                    
                    # 保存されたファイルの確認
                    if os.path.exists(actual_path):
                        file_size = os.path.getsize(actual_path)
                        st.success(f"✅ 保存成功: {original_name} -> {os.path.basename(actual_path)} ({file_size} bytes)")
                        saved_service_files.append(os.path.basename(actual_path))
                    else:
                        st.error(f"❌ 保存失敗: {original_name} -> ファイルが見つかりません")
                        st.error(f"実際のパス: {actual_path}")
                        
                    # 追加の確認：ディレクトリ内のファイル一覧を表示
                    st.info(f"🔍 保存直後のディレクトリ確認 ({i+1}/{len(svc_files)}):")
                    try:
                        files_in_dir = os.listdir(indir)
                        all_files = [f for f in files_in_dir]
                        # 大文字小文字を区別しないCSVファイル検出
                        csv_files_in_dir = [f for f in files_in_dir if f.lower().endswith('.csv')]
                        st.write(f"全ファイル数: {len(all_files)}")
                        st.write(f"CSVファイル数: {len(csv_files_in_dir)}")
                        
                        if all_files:
                            st.write("全ファイル一覧:")
                            for f in all_files:
                                f_path = os.path.join(indir, f)
                                f_size = os.path.getsize(f_path)
                                is_csv = f.lower().endswith('.csv')
                                st.write(f"  - {f} ({f_size} bytes) {'[CSV]' if is_csv else ''}")
                        else:
                            st.warning("ディレクトリにファイルが見つかりません！")
                            
                    except Exception as dir_e:
                        st.error(f"ディレクトリ確認エラー: {str(dir_e)}")
                        
                except Exception as e:
                    st.error(f"❌ 保存エラー: {original_name} -> {str(e)}")
            
            att_file_path = os.path.join(indir, att_file.name)
            try:
                # save_upload_toは正規化されたパスとデバッグ情報を返す
                actual_att_path, att_debug_info = save_upload_to(att_file_path, att_file)
                
                # デバッグ情報を表示
                with st.expander(f"🔧 勤怠履歴CSVデバッグ情報", expanded=False):
                    for info in att_debug_info:
                        st.write(f"• {info}")
                
                if os.path.exists(actual_att_path):
                    file_size = os.path.getsize(actual_att_path)
                    st.success(f"✅ 勤怠履歴CSV保存成功: {os.path.basename(actual_att_path)} ({file_size} bytes)")
                else:
                    st.error(f"❌ 勤怠履歴CSV保存失敗: ファイルが見つかりません")
                    st.error(f"実際のパス: {actual_att_path}")
                    st.stop()
            except Exception as e:
                st.error(f"❌ 勤怠履歴CSV保存エラー: {str(e)}")
                st.stop()
            
            # 保存されたファイルの最終確認
            st.info("📁 保存されたファイルの最終確認:")
            all_files = os.listdir(indir)
            # 大文字小文字を区別しないCSVファイル検出
            csv_files = [f for f in all_files if f.lower().endswith('.csv')]
            
            actual_service_files = []
            actual_attendance_files = []
            
            for csv_file in csv_files:
                file_path = os.path.join(indir, csv_file)
                file_size = os.path.getsize(file_path)
                st.write(f"• {csv_file} ({file_size} bytes)")
                
                # ファイルの分類
                if csv_file == att_file.name:
                    actual_attendance_files.append(csv_file)
                else:
                    actual_service_files.append(csv_file)
            
            # 保存状況の検証
            st.info(f"📊 ファイル分類結果:")
            st.write(f"• サービス実態CSVファイル: {len(actual_service_files)}件")
            for sf in actual_service_files:
                st.write(f"  - {sf}")
            st.write(f"• 勤怠履歴CSVファイル: {len(actual_attendance_files)}件")
            for af in actual_attendance_files:
                st.write(f"  - {af}")
            
            if len(actual_service_files) == 0:
                st.error("❌ サービス実態CSVファイルが1つも保存されませんでした。")
                st.error("🔍 デバッグ情報:")
                st.write(f"• 期待されたサービス実態ファイル数: {len(svc_files)}")
                st.write(f"• 保存成功と報告されたファイル数: {len(saved_service_files)}")
                st.write(f"• 実際にディレクトリに存在するファイル数: {len(actual_service_files)}")
                st.write(f"• 作業ディレクトリ: {indir}")
                st.stop()
            
            if len(actual_attendance_files) == 0:
                st.error("❌ 勤怠履歴CSVファイルが保存されませんでした。")
                st.stop()

            # コマンド組み立て
            cmd = [sys.executable, src_target, "--input", indir, "--identical-prefer", identical_prefer, "--alt-delim", alt_delim]
            # 勤怠履歴CSVファイルを明示的に指定
            cmd += ["--attendance-file", att_file.name]
            if use_schedule_when_missing:
                cmd.append("--use-schedule-when-missing")
            if not generate_diagnostics:
                cmd.append("--no-diagnostics")
            # 列名オプション（既定と違う場合のみ渡す）
            if service_staff_col and service_staff_col != "担当所員":
                cmd += ["--service-staff-col", service_staff_col]
            if att_name_col and att_name_col != "名前":
                cmd += ["--att-name-col", att_name_col]

            # 実行
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                st.error("処理でエラーが発生しました。詳細なエラー情報を確認してください。")
                
                # エラーの詳細情報を表示
                with st.expander("🔍 詳細なエラー情報", expanded=True):
                    if proc.stderr:
                        st.markdown("**標準エラー出力 (stderr):**")
                        st.code(proc.stderr)
                    if proc.stdout:
                        st.markdown("**標準出力 (stdout):**")
                        st.code(proc.stdout)
                    
                    st.markdown("**実行されたコマンド:**")
                    st.code(" ".join(cmd))
                    
                    st.markdown("**入力ファイル一覧:**")
                    try:
                        for file in os.listdir(indir):
                            if file.endswith('.csv'):
                                file_path = os.path.join(indir, file)
                                file_size = os.path.getsize(file_path)
                                st.write(f"• {file} ({file_size} bytes)")
                    except Exception as e:
                        st.write(f"ファイル一覧の取得に失敗: {e}")
                
                st.stop()

            # 出力（result_*.csv と diagnostics）を収集
            result_paths = []
            diagnostic_paths = []
            for root, dirs, files in os.walk(indir):
                for fn in files:
                    if fn.startswith("result_") and fn.endswith(".csv"):
                        result_paths.append(os.path.join(root, fn))
            diag_dir = os.path.join(indir, "diagnostics")
            if os.path.isdir(diag_dir):
                for fn in os.listdir(diag_dir):
                    diagnostic_paths.append(os.path.join(diag_dir, fn))

            # セッション状態に結果を保存
            st.session_state.result_paths = result_paths
            st.session_state.diagnostic_paths = diagnostic_paths
            st.session_state.workdir = workdir
            st.session_state.processing_complete = True
            
            if result_paths:
                st.session_state.summary_df = collect_summary(result_paths)
            else:
                st.session_state.summary_df = None
            
            st.success("処理が完了しました！他のタブで結果を確認してください。")

# タブ2: 検出サマリー
with tab2:
    st.header("📊 検出サマリー")
    
    if st.session_state.processing_complete:
        if st.session_state.summary_df is not None:
            st.dataframe(st.session_state.summary_df, use_container_width=True)
        else:
            st.info("結果CSVが見つかりませんでした。入力ファイルの形式・エンコーディングをご確認ください。")
    else:
        st.info("まず「ファイルアップロード」タブでCSVファイルをアップロードし、エラーチェックを実行してください。")

# タブ3: 詳細データ
with tab3:
    st.header("📋 詳細データ（グリッド表示）")
    
    if st.session_state.processing_complete and st.session_state.result_paths:
        try:
            grid_df = prepare_grid_data(st.session_state.result_paths)
            
            if not grid_df.empty:
                # メインのグリッド表示を最優先で配置
                st.markdown("### 📋 データグリッド")
                
                # 基本的なフィルタリング（常に表示）
                col_filter1, col_filter2, col_filter3 = st.columns(3)
                
                with col_filter1:
                    error_filter = st.selectbox(
                        "エラーフィルタ",
                        options=["すべて", "エラーのみ", "正常のみ"],
                        index=0,
                        key="error_filter"
                    )
                
                with col_filter2:
                    category_filter = st.selectbox(
                        "カテゴリフィルタ",
                        options=["すべて"] + [cat for cat in grid_df['カテゴリ'].unique() if pd.notna(cat) and cat != ''],
                        index=0,
                        key="category_filter"
                    )
                
                with col_filter3:
                    # 空のカラム（レイアウト調整用）
                    st.write("")
                
                # 従業員と利用者のフィルタリング（デフォルトで表示）
                st.markdown("#### 👥 従業員・利用者フィルタ")
                col_staff, col_user = st.columns(2)
                
                with col_staff:
                    available_staff = [staff for staff in grid_df['担当所員'].dropna().unique() if staff != '']
                    selected_staff = st.multiselect(
                        "担当所員で絞り込み",
                        options=sorted(available_staff),
                        default=[],
                        key="staff_filter_main"
                    )
                
                with col_user:
                    available_users = [user for user in grid_df['利用者名'].dropna().unique() if user != '']
                    selected_users = st.multiselect(
                        "利用者で絞り込み",
                        options=sorted(available_users),
                        default=[],
                        key="user_filter_main"
                    )
                
                # フィルタリング処理
                filtered_df = grid_df.copy()
                
                if error_filter == "エラーのみ":
                    filtered_df = filtered_df[filtered_df['エラー'] == '◯']
                elif error_filter == "正常のみ":
                    filtered_df = filtered_df[filtered_df['エラー'] != '◯']
                
                if category_filter != "すべて":
                    filtered_df = filtered_df[filtered_df['カテゴリ'] == category_filter]
                
                if selected_staff:
                    filtered_df = filtered_df[filtered_df['担当所員'].isin(selected_staff)]
                
                if selected_users:
                    filtered_df = filtered_df[filtered_df['利用者名'].isin(selected_users)]
                
                # 基本統計情報（コンパクトに表示）
                total_records = len(grid_df)
                error_records = len(grid_df[grid_df['エラー'] == '◯'])
                filtered_records = len(filtered_df)
                
                col_stat1, col_stat2, col_stat3, col_stat4 = st.columns(4)
                with col_stat1:
                    st.metric("総件数", total_records)
                with col_stat2:
                    st.metric("エラー件数", error_records)
                with col_stat3:
                    st.metric("表示件数", filtered_records)
                with col_stat4:
                    error_rate = (error_records / total_records * 100) if total_records > 0 else 0
                    st.metric("エラー率", f"{error_rate:.1f}%")
                
                # メインのデータグリッド表示（大きく表示）
                st.dataframe(
                    filtered_df,
                    use_container_width=True,
                    height=600,  # 高さを大きくして見やすく
                    hide_index=True
                )
                
                # 追加機能をトグルで表示/非表示
                show_advanced = st.toggle("🔧 詳細機能を表示", value=False, key="show_advanced_features")
                
                if show_advanced:
                    st.markdown("---")
                    
                    # ビュー選択セクション
                    st.markdown("### 📊 表示ビュー選択")
                    view_type = st.radio(
                        "表示方法を選択してください",
                        options=["全体表示", "利用者別表示", "従業員別表示", "詳細分析表示", "カスタム表示"],
                        horizontal=True,
                        key="view_type"
                    )
                    
                    # 詳細統計情報
                    st.markdown("### 📈 詳細統計")
                    col_detail1, col_detail2, col_detail3, col_detail4 = st.columns(4)
                    
                    with col_detail1:
                        unique_users = len(grid_df['利用者名'].dropna().unique())
                        st.metric("利用者数", unique_users)
                    
                    with col_detail2:
                        # 重複関連統計
                        overlap_records = len(grid_df[grid_df['重複時間'] > 0])
                        total_overlap_minutes = grid_df['重複時間'].sum()
                        st.metric("重複件数", overlap_records)
                        st.metric("総重複時間", f"{total_overlap_minutes}分")
                    
                    with col_detail3:
                        # 超過関連統計
                        excess_records = len(grid_df[grid_df['超過時間'] > 0])
                        total_excess_minutes = grid_df['超過時間'].sum()
                        st.metric("超過件数", excess_records)
                        st.metric("総超過時間", f"{total_excess_minutes}分")
                    
                    with col_detail4:
                        # 職員関連統計
                        unique_staff = len(grid_df['担当所員'].dropna().unique())
                        st.metric("職員数", unique_staff)
                
                    # ビュー別の詳細フィルタリング
                    if view_type == "利用者別表示":
                        st.markdown("### 👥 利用者選択")
                        available_users = [user for user in grid_df['利用者名'].dropna().unique() if user != '']
                        if available_users:
                            selected_users = st.multiselect(
                                "表示する利用者を選択してください（複数選択可）",
                                options=sorted(available_users),
                                default=[],
                                key="user_filter_advanced"
                            )
                            if selected_users:
                                filtered_df = filtered_df[filtered_df['利用者名'].isin(selected_users)]
                        else:
                            st.warning("利用者データが見つかりません。")
                            
                    elif view_type == "従業員別表示":
                        st.markdown("### 👨‍💼 従業員選択")
                        available_staff = [staff for staff in grid_df['担当所員'].dropna().unique() if staff != '']
                        if available_staff:
                            selected_staff = st.multiselect(
                                "表示する従業員を選択してください（複数選択可）",
                                options=sorted(available_staff),
                                default=[],
                                key="staff_filter_advanced"
                            )
                            if selected_staff:
                                filtered_df = filtered_df[filtered_df['担当所員'].isin(selected_staff)]
                        else:
                            st.warning("従業員データが見つかりません。")
                            
                    elif view_type == "詳細分析表示":
                        st.markdown("### 🔍 詳細分析表示")
                        
                        # 分析タイプ選択
                        analysis_type = st.selectbox(
                            "分析タイプを選択",
                            options=["重複分析", "勤怠超過分析", "時間帯分析", "職員負荷分析"],
                            key="analysis_type"
                        )
                        
                        if analysis_type == "重複分析":
                            show_overlap_analysis(filtered_df)
                        elif analysis_type == "勤怠超過分析":
                            show_attendance_excess_analysis(filtered_df)
                        elif analysis_type == "時間帯分析":
                            show_time_slot_analysis(filtered_df)
                        elif analysis_type == "職員負荷分析":
                            show_staff_workload_analysis(filtered_df)
                            
                    elif view_type == "カスタム表示":
                        st.markdown("### 🔧 カスタムフィルタ")
                        
                        # 複合条件フィルタ
                        col_custom1, col_custom2 = st.columns(2)
                        with col_custom1:
                            custom_users = st.multiselect(
                                "利用者選択",
                                options=sorted([user for user in grid_df['利用者名'].dropna().unique() if user != '']),
                                key="custom_users"
                            )
                        with col_custom2:
                            custom_staff = st.multiselect(
                                "従業員選択",
                                options=sorted([staff for staff in grid_df['担当所員'].dropna().unique() if staff != '']),
                                key="custom_staff"
                            )
                        
                        # カスタムフィルタ適用
                        if custom_users:
                            filtered_df = filtered_df[filtered_df['利用者名'].isin(custom_users)]
                        if custom_staff:
                            filtered_df = filtered_df[filtered_df['担当所員'].isin(custom_staff)]
                    
                    # 詳細機能用のフィルタ済みデータグリッド表示
                    st.markdown("### 📋 フィルタ済みデータグリッド")
                    st.dataframe(
                        filtered_df,
                        use_container_width=True,
                        height=400,
                        hide_index=True
                    )
                
            else:
                st.info("グリッド表示用のデータが見つかりませんでした。")
        except Exception as e:
            st.error(f"グリッド表示でエラーが発生しました: {str(e)}")
    else:
        st.info("まず「ファイルアップロード」タブでCSVファイルをアップロードし、エラーチェックを実行してください。")

# タブ4: ダウンロード・最適化
with tab4:
    st.header("💾 ダウンロード・最適化")
    
    if st.session_state.processing_complete:
        # 個別ダウンロード
        if st.session_state.result_paths:
            st.subheader("📥 結果CSVダウンロード")
            for p in sorted(st.session_state.result_paths):
                with open(p, "rb") as f:
                    st.download_button(
                        label=f"Download {os.path.basename(p)}",
                        data=f.read(),
                        file_name=os.path.basename(p),
                        mime="text/csv",
                    )

        # 診断ダウンロード
        if st.session_state.diagnostic_paths and generate_diagnostics:
            st.subheader("🔍 診断CSVダウンロード (diagnostics)")
            for p in sorted(st.session_state.diagnostic_paths):
                with open(p, "rb") as f:
                    st.download_button(
                        label=f"Download {os.path.basename(p)}",
                        data=f.read(),
                        file_name=os.path.basename(p),
                        mime="text/csv",
                    )

        # まとめてZIP
        if st.session_state.result_paths:
            st.subheader("📦 一括ダウンロード（ZIP）")
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for p in st.session_state.result_paths:
                    zf.write(p, arcname=os.path.basename(p))
                if generate_diagnostics and st.session_state.diagnostic_paths:
                    for p in st.session_state.diagnostic_paths:
                        zf.write(p, arcname=os.path.join("diagnostics", os.path.basename(p)))
            buf.seek(0)
            
            # タイムスタンプを取得
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            st.download_button(
                label="結果一式をZIPでダウンロード",
                data=buf,
                file_name=f"results_{ts}.zip",
                mime="application/zip",
            )

    else:
        st.info("まず「ファイルアップロード」タブでCSVファイルをアップロードし、エラーチェックを実行してください。")

# タブ5: 最適勤怠データ出力
with tab5:
    st.header("🎯 最適勤怠データ出力")
    
    # 勤怠データの読み込み確認
    try:
        # セッション状態から勤怠履歴CSVファイルのパスを動的に取得
        if st.session_state.processing_complete and st.session_state.workdir:
            # 作業ディレクトリ内のinputフォルダから勤怠履歴CSVを探す
            input_dir = os.path.join(st.session_state.workdir, "input")
            attendance_file_path = None
            
            if os.path.exists(input_dir):
                for filename in os.listdir(input_dir):
                    if filename.endswith('.csv') and not filename.startswith('result_'):
                        # サービス実態CSVではない可能性が高いファイルを勤怠履歴CSVとして判定
                        if '勤怠' in filename or 'チェック' in filename or 'attendance' in filename.lower():
                            attendance_file_path = os.path.join(input_dir, filename)
                            break
                
                # 見つからない場合は、最初に見つかったCSVファイルを使用
                if not attendance_file_path:
                    csv_files = [f for f in os.listdir(input_dir) if f.endswith('.csv') and not f.startswith('result_')]
                    if csv_files:
                        # サービス実態CSVファイル数を推定して、残りを勤怠履歴CSVとする
                        service_files = [f for f in csv_files if not ('勤怠' in f or 'チェック' in f or 'attendance' in f.lower())]
                        attendance_files = [f for f in csv_files if f not in service_files]
                        if attendance_files:
                            attendance_file_path = os.path.join(input_dir, attendance_files[0])
            
            if not attendance_file_path:
                raise FileNotFoundError("勤怠履歴CSVファイルが見つかりません。")
        else:
            raise FileNotFoundError("処理が完了していないか、作業ディレクトリが見つかりません。")
        
        attendance_df = pd.read_csv(attendance_file_path, encoding='cp932')
        
        # 利用可能な従業員リストを取得
        available_employees = []
        for _, row in attendance_df.iterrows():
            emp_name = str(row.get('名前', '')).strip()
            if emp_name and emp_name not in available_employees:
                available_employees.append(emp_name)
        
        if not available_employees:
            st.error("勤怠データから従業員情報を取得できませんでした。")
        else:
            st.success(f"勤怠データを読み込みました。利用可能な従業員: {len(available_employees)}名")
            
            # 対象月の選択
            col1, col2 = st.columns(2)
            with col1:
                target_year = st.selectbox("対象年", range(2023, 2026), index=2, key="export_year")
            with col2:
                target_month = st.selectbox("対象月", range(1, 13), index=datetime.now().month - 1, key="export_month")
            
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
                    if st.checkbox(employee, value=is_selected, key=f"emp_check_tab5_{i}"):
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
                
                if st.button("🎯 最適勤怠データをCSV出力", type="primary", key="export_csv_tab5"):
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
                                help="jinjer形式（133列）の最適勤怠データCSVファイル",
                                key="download_csv_tab5"
                            )
                            
                            st.success(f"✅ CSV生成完了！{len(st.session_state.selected_employees_export)}名の勤怠データを出力しました。")
                            
                            # 生成されたCSVの詳細情報
                            lines = csv_content.count('\n') - 1  # ヘッダー行を除く
                            st.info(f"📊 出力詳細: {lines}行のデータ（ヘッダー含む{lines + 1}行）")
                            
                        except Exception as e:
                            st.error(f"CSV生成エラー: {str(e)}")
            else:
                st.warning("出力対象の従業員を選択してください。")
                
    except FileNotFoundError as e:
        st.error("勤怠履歴CSVファイルが見つかりません。")
        st.info("まず「ファイルアップロード」タブでCSVファイルをアップロードし、エラーチェックを実行してください。")
        with st.expander("🔍 詳細情報"):
            st.write(f"エラー詳細: {str(e)}")
            if st.session_state.workdir:
                st.write(f"作業ディレクトリ: {st.session_state.workdir}")
    except Exception as e:
        st.error(f"データ読み込みエラー: {str(e)}")
        with st.expander("🔍 詳細情報"):
            st.write(f"エラータイプ: {type(e).__name__}")
            st.write(f"エラー詳細: {str(e)}")

st.caption("※ このUIはローカルの src.py を呼び出して実行します。アプリと同じフォルダに src.py を置いてください。")

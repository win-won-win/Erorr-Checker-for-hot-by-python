import streamlit as st
import pandas as pd
import tempfile
import os
import io
import zipfile
import shutil
import subprocess
import sys
import re
import json
import hashlib
import uuid
from datetime import datetime
import calendar
from typing import List, Dict, Any, Optional, Tuple
from functools import lru_cache
from pathlib import Path
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode, DataReturnMode, JsCode
from src import normalize_name

try:
    from PIL import Image
except ImportError:
    Image = None  # Pillow未インストール時は画像を使わないフォールバック

# アイコン定義（洗練されたUnicodeアイコン）
ICONS = {
    'folder': '🗂️',      # フォルダ
    'chart': '📈',       # チャート
    'list': '📝',        # リスト
    'download': '⬇️',     # ダウンロード
    'target': '🎯',      # ターゲット
    'settings': '⚙️',    # 設定
    'search': '🔎',      # 検索
    'info': 'ℹ️',        # 情報
    'warning': '⚠️',     # 警告
    'error': '🚫',       # エラー
    'success': '✅',     # 成功
    'debug': '🛠️',       # デバッグ
    'users': '👥',       # ユーザー複数
    'user': '👤',        # ユーザー単体
    'staff': '👨‍💼',      # スタッフ
    'time': '🕐',        # 時間
    'calendar': '📅',    # カレンダー
    'file': '📄',        # ファイル
    'zip': '🗜️'          # ZIP
}

# optimal_attendance_export.pyの機能をインポート
from optimal_attendance_export import (
    create_jinjer_headers,
    time_to_minutes,
    minutes_to_time,
    format_time_for_csv,
    merge_overlapping_shifts,
    get_employee_id,
    generate_jinjer_csv,
    show_optimal_attendance_export,
    find_default_attendance_csv,
    build_builtin_attendance_dataframe,
    get_builtin_attendance_csv_bytes
)

# 詳細分析機能（関数定義）
def show_overlap_analysis(df):
    """重複の詳細分析を表示"""
    st.markdown("#### 重複分析")
    
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
    st.markdown("#### 勤怠超過分析")
    
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
    st.markdown("#### 時間帯分析")
    
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
    st.markdown("#### 職員負荷分析")
    
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
    with st.expander(f"詳細情報 - {row.get('C', 'N/A')} ({row.get('D', 'N/A')})", expanded=True):
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

def resolve_upload_cache_dir() -> Tuple[Path, Path, str]:
    """
    キャッシュ保存先を決定する。
    1. Desktop/ChofukuChecker_upload_cache を優先して作成・使用。
    2. Desktop が利用できない場合はホームディレクトリ配下に隠しフォルダを用意して使用。
    """
    desktop_dir = Path.home() / "Desktop" / "エラーチェック選択記憶用ファイル"
    try:
        desktop_dir.mkdir(parents=True, exist_ok=True)
        display_path = str(desktop_dir)
        return desktop_dir, desktop_dir / "manifest.json", display_path
    except Exception:
        pass

    fallback_dir = Path.home() / ".streamlit_upload_cache"
    fallback_dir.mkdir(parents=True, exist_ok=True)
    display_path = str(fallback_dir)
    return fallback_dir, fallback_dir / "manifest.json", display_path


UPLOAD_CACHE_DIR, UPLOAD_CACHE_MANIFEST, _upload_cache_display_raw = resolve_upload_cache_dir()
_home_prefix = str(Path.home())
if _upload_cache_display_raw.startswith(_home_prefix):
    UPLOAD_CACHE_DISPLAY = "~" + _upload_cache_display_raw[len(_home_prefix):]
else:
    UPLOAD_CACHE_DISPLAY = _upload_cache_display_raw


def _default_upload_manifest() -> Dict[str, List[Dict[str, Any]]]:
    return {"service": [], "attendance": []}


def ensure_upload_cache_dir() -> None:
    UPLOAD_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def read_upload_manifest() -> Dict[str, List[Dict[str, Any]]]:
    ensure_upload_cache_dir()
    if not UPLOAD_CACHE_MANIFEST.exists():
        write_upload_manifest(_default_upload_manifest())
    try:
        with open(UPLOAD_CACHE_MANIFEST, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        data = _default_upload_manifest()
        write_upload_manifest(data)
    for key in ["service", "attendance"]:
        if key not in data or not isinstance(data.get(key), list):
            data[key] = []
    return data


def write_upload_manifest(data: Dict[str, List[Dict[str, Any]]]) -> None:
    ensure_upload_cache_dir()
    with open(UPLOAD_CACHE_MANIFEST, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class CachedUploadedFile:
    """st.file_uploaderで選択したファイルをローカルキャッシュから再生成するためのラッパー"""

    def __init__(self, name: str, stored_path: Path, size: Optional[int] = None, saved_at: Optional[str] = None, stored_name: Optional[str] = None):
        self.name = name
        self._stored_path = stored_path
        self._size = size
        self.saved_at = saved_at
        self.stored_name = stored_name or stored_path.name
        self._data: Optional[bytes] = None

    def _load(self) -> bytes:
        if self._data is None:
            self._data = self._stored_path.read_bytes()
            self._size = len(self._data)
        return self._data

    def getvalue(self) -> bytes:
        return self._load()

    def getbuffer(self):
        return memoryview(self._load())

    def read(self) -> bytes:
        return self._load()

    @property
    def size(self) -> int:
        if self._size is None:
            try:
                self._size = self._stored_path.stat().st_size
            except FileNotFoundError:
                self._size = 0
        return self._size

    def __len__(self) -> int:
        return self.size


def save_uploaded_files_to_cache(category: str, uploaded_files: List[Any]) -> None:
    if not uploaded_files:
        return

    manifest = read_upload_manifest()
    existing_entries = list(manifest.get(category, []))
    ensure_upload_cache_dir()

    for uploaded in uploaded_files:
        safe_name = os.path.basename(getattr(uploaded, "name", "uploaded.csv"))
        file_bytes = uploaded.getvalue()
        digest = hashlib.sha1(file_bytes).hexdigest()
        ext = os.path.splitext(safe_name)[1]
        stored_basename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex}_{digest[:8]}"
        stored_name = f"{stored_basename}{ext}" if ext else stored_basename
        stored_path = UPLOAD_CACHE_DIR / stored_name
        if stored_path.exists():
            # 既存ファイルと衝突するはずがないが念のため削除
            stored_path.unlink()

        with open(stored_path, "wb") as f:
            f.write(file_bytes)

        # 同名の既存エントリを削除して差し替える
        filtered_entries = []
        for entry in existing_entries:
            if entry.get("name") == safe_name:
                old_stored = entry.get("stored_name")
                if old_stored:
                    old_path = UPLOAD_CACHE_DIR / old_stored
                    try:
                        old_path.unlink()
                    except FileNotFoundError:
                        pass
                continue
            filtered_entries.append(entry)
        existing_entries = filtered_entries

        existing_entries.append({
            "name": safe_name,
            "stored_name": stored_name,
            "size": len(file_bytes),
            "saved_at": datetime.now().isoformat()
        })

    manifest[category] = existing_entries
    write_upload_manifest(manifest)


def load_cached_uploaded_files(category: str) -> Tuple[List[CachedUploadedFile], List[Dict[str, Any]]]:
    manifest = read_upload_manifest()
    entries = manifest.get(category, [])
    loaded_files: List[CachedUploadedFile] = []
    valid_entries: List[Dict[str, Any]] = []

    for entry in entries:
        stored_name = entry.get("stored_name")
        if not stored_name:
            continue
        stored_path = UPLOAD_CACHE_DIR / stored_name
        if not stored_path.exists():
            continue
        cached_file = CachedUploadedFile(
            name=entry.get("name", stored_name),
            stored_path=stored_path,
            size=entry.get("size"),
            saved_at=entry.get("saved_at"),
            stored_name=stored_name
        )
        loaded_files.append(cached_file)
        valid_entries.append(entry)

    if len(valid_entries) != len(entries):
        manifest[category] = valid_entries
        write_upload_manifest(manifest)

    return loaded_files, valid_entries


def remove_cached_file(category: str, stored_name: str) -> bool:
    manifest = read_upload_manifest()
    entries = manifest.get(category, [])
    if not entries:
        return False

    remaining_entries = []
    removed = False
    for entry in entries:
        entry_stored = entry.get("stored_name")
        if not removed and entry_stored == stored_name:
            removed = True
            if entry_stored:
                path = UPLOAD_CACHE_DIR / entry_stored
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
            continue
        remaining_entries.append(entry)

    if removed:
        manifest[category] = remaining_entries
        write_upload_manifest(manifest)
    return removed


def trigger_streamlit_rerun() -> None:
    """Streamlitのバージョン差異を吸収しながら安全にrerunを要求する。"""
    rerun_fn = getattr(st, "rerun", None)
    if callable(rerun_fn):
        rerun_fn()
        return

    rerun_fn = getattr(st, "experimental_rerun", None)
    if callable(rerun_fn):
        rerun_fn()
        return

    set_params = getattr(st, "experimental_set_query_params", None)
    get_params = getattr(st, "experimental_get_query_params", None)
    if callable(set_params) and callable(get_params):
        params = get_params()
        params["_refresh_token"] = [uuid.uuid4().hex]
        set_params(**params)
        return

    st.warning("ファイル一覧を更新するにはブラウザを再読み込みしてください。")


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

def extract_facility_name_from_filename(filename):
    """
    ファイル名から事業所名を抽出する関数
    先頭からのひらがな・漢字・カタカナまたはスペースまでを認識
    例: 'さくら202508)3.csv' -> 'さくら'
    例: 'ほっと202508)3.csv' -> 'ほっと'
    例: 'さくら　2020508 3.csv' -> 'さくら'
    """
    import re
    
    # ファイル名から拡張子を除去
    base_name = os.path.splitext(filename)[0]
    
    # result_ プレフィックスを除去
    if base_name.startswith('result_'):
        base_name = base_name[7:]  # 'result_' を除去
    
    # 先頭からのひらがな・カタカナ・漢字・英字を抽出（数字・記号で終了）
    # ひらがな: あ-ん (U+3042-U+3093)
    # カタカナ: ア-ン (U+30A2-U+30F3) + 長音符・中点
    # 漢字: 一-龯 (U+4E00-U+9FAF)
    # 英字: a-zA-Z
    # 記号: ー（長音符）、・（中点）
    pattern = r'^([あ-んア-ンー・一-龯a-zA-Zａ-ｚＡ-Ｚ]+)'
    
    match = re.match(pattern, base_name.strip())
    if match:
        facility_name = match.group(1).strip()
        return facility_name
    
    # フォールバック: スペースで区切られた最初の部分
    parts = re.split(r'[　\s]+', base_name.strip())
    if parts and parts[0]:
        # 最初の部分から日本語・英字のみを抽出
        first_part = parts[0]
        clean_match = re.match(r'^([あ-んア-ン一-龯a-zA-Zａ-ｚＡ-Ｚ]+)', first_part)
        if clean_match:
            return clean_match.group(1).strip()
        return first_part.strip()
    
    # 最終フォールバック: ファイル名をそのまま返す
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

def normalize_staff_list(raw_value: Any) -> str:
    """
    代替職員リストなどのスタッフ名リストを正規化。
    区切り文字付きの文字列から個々の名前を抽出し、normalize_nameを適用する。
    """
    if raw_value is None or (isinstance(raw_value, float) and pd.isna(raw_value)):
        return ''
    
    text = str(raw_value).strip()
    
    # 明示的に候補なしを示す記号はそのまま返す
    if text in {'', 'ー', '-'}:
        return text
    
    # 区切り文字で分割（スラッシュ・全角スラッシュ・カンマ類）
    parts = re.split(r'[／/，,、]+', text)
    normalized_parts = []
    
    for part in parts:
        candidate = part.strip()
        if not candidate:
            continue
        normalized_candidate = normalize_name(candidate) or candidate
        if normalized_candidate not in normalized_parts:
            normalized_parts.append(normalized_candidate)
    
    if not normalized_parts:
        return ''
    
    return ' / '.join(normalized_parts)

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
        
        # ファイル名から事業所名を抽出
        filename = os.path.basename(p)
        facility_name = extract_facility_name_from_filename(filename)
        
        # 指定された順序でカラムを構築
        for idx, row in df.iterrows():
            # 重複相手施設から事業所名を抽出（従来の方法）
            partner_facilities = row.get('重複相手施設', '')
            duplicate_facility_names = extract_facility_names_from_partner_facilities(partner_facilities)
            
            # 重複相手施設が空の場合は、ファイル名から抽出した事業所名を使用
            if not duplicate_facility_names and facility_name:
                # エラーがある行のみ事業所名を表示
                if row.get('エラー', '') == '◯':
                    duplicate_facility_display = facility_name
                else:
                    duplicate_facility_display = ''
            else:
                duplicate_facility_display = '，'.join(duplicate_facility_names) if duplicate_facility_names else ''
            
            # デバッグ出力（最初の5行のみ）
            if idx < 5:
                print(f"デバッグ - ファイル{filename}: 行{idx}, エラー='{row.get('エラー', '')}', 事業所名='{facility_name}', 表示用='{duplicate_facility_display}'")
            
            # 重複利用者名の設定（エラー行のみ重複相手の利用者名を表示）
            if row.get('エラー', '') == '◯':
                duplicate_user_name = row.get('重複利用者名', '')
            else:
                duplicate_user_name = ''
            
            # 重複サービス時間の設定（エラー行のみ表示、NaN値を適切に処理）
            if row.get('エラー', '') == '◯':
                service_time = row.get('重複サービス時間', '')
                # NaN値やnull値を空文字に変換
                if pd.isna(service_time) or service_time == 'nan':
                    duplicate_service_time = ''
                else:
                    duplicate_service_time = str(service_time) if service_time else ''
            else:
                duplicate_service_time = ''
            
            raw_staff = row.get('担当所員', '')
            normalized_staff = row.get('担当所員_norm', '')
            if isinstance(normalized_staff, str) and normalized_staff.strip():
                display_staff = normalized_staff.strip()
            elif isinstance(raw_staff, str) and raw_staff.strip():
                display_staff = normalize_name(raw_staff.strip()) or raw_staff.strip()
            else:
                display_staff = ''
            
            raw_alt_staff = row.get('代替職員リスト', '')
            normalized_alt_staff = normalize_staff_list(raw_alt_staff)
            if normalized_alt_staff:
                display_alt_staff = normalized_alt_staff
            else:
                raw_alt_text = str(raw_alt_staff).strip() if raw_alt_staff is not None else ''
                display_alt_staff = 'ー' if raw_alt_text == '' or raw_alt_text.lower() == 'nan' else raw_alt_text
            
            grid_row = {
                'エラー': row.get('エラー', ''),
                'カテゴリ': row.get('カテゴリ', ''),
                '代替従業員リスト': display_alt_staff,
                '担当所員': display_staff,
                '利用者名': row.get('利用者名', ''),
                '重複利用者名': duplicate_user_name,
                '重複エラー事業所名': duplicate_facility_display,
                '重複サービス時間': duplicate_service_time,
                '日付': row.get('日付', ''),
                '開始時間': row.get('開始時間', ''),
                '終了時間': row.get('終了時間', ''),
                'サービス詳細': f"{row.get('サービス内容', '')} - {row.get('実施時間', '')}".strip(' -'),
                '重複時間': row.get('重複時間（分）', 0),
                '懲戒時間': row.get('懲戒時間', row.get('超過時間（分）', 0)),
                'カバー状況': row.get('カバー状況', ''),
                'エラー職員勤務時間': row.get('エラー職員勤務時間', ''),
                '代替職員勤務時間': row.get('代替職員勤務時間', ''),
                '勤務時間詳細': row.get('勤務時間詳細', ''),
                '勤務時間外詳細': row.get('勤務時間外詳細', ''),
                '未カバー区間': row.get('未カバー区間', ''),
                '勤務区間数': row.get('勤務区間数', 0)
            }
            grid_data.append(grid_row)
    
    desired_columns = [
        '代替従業員リスト', '重複エラー事業所名', '利用者名', '日付', '開始時間', '終了時間',
        '担当所員', 'サービス詳細', '重複利用者名', '重複サービス時間', '重複時間', '懲戒時間',
        'エラー職員勤務時間', '代替職員勤務時間', '勤務時間詳細', '勤務時間外詳細', '未カバー区間'
    ]

    base_columns = desired_columns + ['エラー', 'カテゴリ', 'カバー状況', '勤務区間数']
    base_columns = list(dict.fromkeys(base_columns))
    
    if not grid_data:
        return pd.DataFrame(columns=base_columns)
    
    df = pd.DataFrame(grid_data)
    
    remaining_columns = [col for col in df.columns if col not in desired_columns]
    ordered_columns = desired_columns + remaining_columns
    
    return df[ordered_columns]

def create_styled_grid(df):
    """
    条件付き背景色を適用したAgGridを作成する関数
    - 「さくら」を含む行：薄い赤の背景色 (#ffebee)
    - 「ほっと」を含む行：薄い青の背景色 (#e3f2fd)
    """
    # GridOptionsBuilderを使用してグリッドオプションを設定
    gb = GridOptionsBuilder.from_dataframe(df)
    
    # 基本設定
    gb.configure_pagination(paginationAutoPageSize=False, paginationPageSize=100)
    gb.configure_side_bar()
    gb.configure_selection('single', use_checkbox=False)
    gb.configure_default_column(
        groupable=True,
        value=True,
        enableRowGroup=True,
        aggFunc='sum',
        editable=False,
        resizable=True,
        sortable=True,
        filter=True
    )
    
    # 条件付きスタイリングのJavaScriptコード
    cell_style_jscode = JsCode("""
    function(params) {
        const facilityName = params.data['重複エラー事業所名'];
        if (facilityName) {
            // 正確に「さくら」または「ほっと」に一致する場合のみ色を適用
            if (facilityName === 'さくら' || facilityName.includes('さくら')) {
                // 「さくら」の場合：薄い赤
                return {
                    'backgroundColor': '#ffebee',
                    'color': 'black'
                };
            } else if (facilityName === 'ほっと' || facilityName.includes('ほっと')) {
                // 「ほっと」の場合：薄い青
                return {
                    'backgroundColor': '#e3f2fd',
                    'color': 'black'
                };
            }
        }
        return {};
    }
    """)
    
    # 行全体にスタイルを適用
    row_style_jscode = JsCode("""
    function(params) {
        const facilityName = params.data['重複エラー事業所名'];
        if (facilityName) {
            // 正確に「さくら」または「ほっと」に一致する場合のみ色を適用
            if (facilityName === 'さくら' || facilityName.includes('さくら')) {
                // 「さくら」の場合：薄い赤
                return {'backgroundColor': '#ffebee'};
            } else if (facilityName === 'ほっと' || facilityName.includes('ほっと')) {
                // 「ほっと」の場合：薄い青
                return {'backgroundColor': '#e3f2fd'};
            }
        }
        return {};
    }
    """)
    
    # 各カラムにセルスタイルを適用し、特定の列に幅を設定
    for col in df.columns:
        gb.configure_column(col, cellStyle=cell_style_jscode)
    
    # 新しく追加した列の幅を設定
    if '重複利用者名' in df.columns:
        gb.configure_column('重複利用者名', width=120)
    if '重複サービス時間' in df.columns:
        gb.configure_column('重複サービス時間', width=150)
    
    # その他の重要な列の幅も調整
    if '重複エラー事業所名' in df.columns:
        gb.configure_column('重複エラー事業所名', width=150)
    if '利用者名' in df.columns:
        gb.configure_column('利用者名', width=120)
    
    # 行スタイルを設定
    gb.configure_grid_options(getRowStyle=row_style_jscode)
    
    # グリッドオプションを構築
    gridOptions = gb.build()

    return gridOptions

def _safe_text(value: Any) -> str:
    """NaNやNoneを空文字列に正規化し、表示しやすいテキストを返す。"""
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return ""
    return text

@lru_cache(maxsize=32)
def _get_indicator_image(width: int, height: int, color: Tuple[int, int, int]) -> Optional[Any]:
    """指定色・サイズの縦ライン画像を生成（Pillow未導入ならNoneを返す）。"""
    if Image is None:
        return None
    return Image.new("RGB", (width, height), color)

def show_card_view(df: pd.DataFrame) -> None:
    """
    AgGridと同じデータをカード形式で表示する。
    CSSやunsafe_allow_htmlを使わず、標準コンポーネントのみで構成する。
    """
    st.caption(f"{len(df)}件をリスト表示中")

    for idx, (_, row) in enumerate(df.iterrows(), start=1):
        date_text = _safe_text(row.get("日付")) or "日付未設定"
        start_time = _safe_text(row.get("開始時間")) or "ー"
        end_time = _safe_text(row.get("終了時間")) or "ー"
        user_name = _safe_text(row.get("利用者名")) or "利用者不明"
        staff_name = _safe_text(row.get("担当所員")) or "担当未設定"
        facility_name = _safe_text(row.get("重複エラー事業所名")) or "事業所未設定"
        alt_staff = _safe_text(row.get("代替従業員リスト")) or "ー"

        duplicate_user = _safe_text(row.get("重複利用者名"))
        duplicate_service = _safe_text(row.get("重複サービス時間"))
        duplicate_minutes = _safe_text(row.get("重複時間"))
        penalty_minutes = _safe_text(row.get("懲戒時間"))
        service_detail = _safe_text(row.get("サービス詳細"))
        error_shift = _safe_text(row.get("エラー職員勤務時間"))
        alternate_shift = _safe_text(row.get("代替職員勤務時間"))
        shift_detail = _safe_text(row.get("勤務時間詳細"))
        off_detail = _safe_text(row.get("勤務時間外詳細"))
        uncovered = _safe_text(row.get("未カバー区間"))
        coverage = _safe_text(row.get("カバー状況"))
        error_mark = _safe_text(row.get("エラー"))
        category = _safe_text(row.get("カテゴリ"))

        detail_lines: List[str] = []
        if facility_name:
            detail_lines.append(f"重複エラー事業所名: {facility_name}")
        for label, value in [
            ("エラー", error_mark),
            ("カテゴリ", category),
            ("カバー状況", coverage),
            ("重複利用者", duplicate_user),
            ("重複サービス", duplicate_service),
            ("重複時間", duplicate_minutes),
            ("懲戒時間", penalty_minutes),
            ("サービス詳細", service_detail),
            ("勤務時間詳細", error_shift or shift_detail),
            ("代替職員勤務時間", alternate_shift),
            ("勤務時間外詳細", off_detail),
            ("未カバー区間", uncovered),
        ]:
            if value:
                detail_lines.append(f"{label}: {value}")

        tooltip_text = "\n".join(detail_lines) if detail_lines else "追加の詳細情報はありません。"

        indicator_color: Optional[Tuple[int, int, int]] = None
        indicator_fallback = None
        if facility_name and "さくら" in facility_name:
            indicator_color = (255, 224, 236)  # 薄いピンク
            indicator_fallback = ":red[┃]"
        elif facility_name and "ほっと" in facility_name:
            indicator_color = (224, 238, 255)  # 薄い青
            indicator_fallback = ":blue[┃]"

        left_line_count = 1  # 日付行
        left_line_count += max(1, staff_name.count('\n') + 1)
        left_line_count += max(1, alt_staff.count('\n') + 1)

        right_line_count = max(1, user_name.count('\n') + 1) + 1  # +1はℹ️ボタン分

        total_lines = max(left_line_count + 1, right_line_count)
        line_height_px = 24
        indicator_height = max(36, int(total_lines * line_height_px * 1.0))

        with st.container(border=True):
            row_cols = st.columns([0.2, 5, 2])
            with row_cols[0]:
                if indicator_color:
                    indicator_img = _get_indicator_image(12, indicator_height, indicator_color)
                    if indicator_img is not None:
                        st.image(indicator_img, width=12, clamp=True)
                    elif indicator_fallback:
                        st.markdown(indicator_fallback)
                else:
                    st.write("")
            with row_cols[1]:
                st.markdown(f"**{date_text}　{start_time} 〜 {end_time}**")
                st.caption(f"担当者: {staff_name}")
                st.caption(f"代替従業員: {alt_staff}")
            with row_cols[2]:
                top_cols = st.columns([4, 1])
                with top_cols[0]:
                    st.markdown(f"**{user_name}**")
                with top_cols[1]:
                    st.button(
                        "ℹ️",
                        key=f"detail_hint_{idx}",
                        help=tooltip_text,
                        disabled=True
                    )

# ページ設定
st.set_page_config(page_title="重複チェッカー for hot", layout="wide")

# カスタムCSS
st.markdown("""
<style>
/* ファイルアップローダーのスタイル調整 */
.stFileUploader > div > div > div > div {
    border: 2px dashed #cccccc;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    background-color: #f8f9fa;
}

.stFileUploader > div > div > div > div:hover {
    border-color: #007bff;
    background-color: #e3f2fd;
}

/* ファイルアップローダーのテキストを隠す（完全には隠せないが目立たなくする） */
.stFileUploader > div > div > div > div > small {
    color: #6c757d;
    font-size: 0.8em;
}

</style>
""", unsafe_allow_html=True)

st.title("重複チェッカー for hot")

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
    st.header("設定")
    identical_prefer = st.selectbox("完全一致時", ["earlier", "later"], index=0)
    alt_delim = st.text_input("区切り文字", value="/")
    use_schedule_when_missing = st.checkbox("予定で代用", value=True)
    service_staff_col = st.text_input("サービス従業員列", value="担当所員")
    att_name_col = st.text_input("勤怠従業員列", value="名前")
    generate_diagnostics = st.checkbox("診断CSV出力", value=True)
    show_debug_logs = st.checkbox("デバッグログを表示", value=False)

# タブの作成
tab1, tab2, tab3, tab4 = st.tabs([
    "①アップロード",
    "②エラー確認",
    "③勤怠CSVダウンロード",
    "④エラーダウンロード"
])

# タブ1: ①アップロード
with tab1:
    st.header("①アップロード")
    
    st.subheader("サービス実態CSV（複数可）")
    st.info("CSVファイルをここにドラッグ&ドロップするか、下のボタンからファイルを選択してください")
    cached_service_files, cached_service_meta = load_cached_uploaded_files("service")
    svc_uploaded_files = st.file_uploader("ファイル選択", type=["csv"], accept_multiple_files=True, key="svc", label_visibility="collapsed")
    svc_uploaded_files = list(svc_uploaded_files) if svc_uploaded_files else []

    if svc_uploaded_files:
        for file in svc_uploaded_files:
            file_size = len(file.getvalue()) / 1024
            size_str = f"{file_size:.1f}KB" if file_size < 1024 else f"{file_size/1024:.1f}MB"
            st.write(f"• {file.name} ({size_str})")
        save_uploaded_files_to_cache("service", svc_uploaded_files)
        cached_service_files, cached_service_meta = load_cached_uploaded_files("service")

    if cached_service_files:
        st.caption("前回アップロードしたサービスCSVを自動で使用します。")
        for meta in list(cached_service_meta):
            file_size = (meta.get("size") or 0) / 1024
            size_str = f"{file_size:.1f}KB" if file_size < 1024 else f"{file_size/1024:.1f}MB"
            cols = st.columns([12, 1])
            with cols[0]:
                st.write(f"• {meta.get('name')} ({size_str})")
            with cols[1]:
                button_label = "×"
                if st.button(button_label, key=f"remove_service_{meta.get('stored_name')}"):
                    if remove_cached_file("service", meta.get("stored_name")):
                        cached_service_meta = [m for m in cached_service_meta if m.get("stored_name") != meta.get("stored_name")]
                        cached_service_files = [obj for obj in cached_service_files if getattr(obj, "stored_name", None) != meta.get("stored_name")]
                        st.success(f"{meta.get('name')} を削除しました。")
                        trigger_streamlit_rerun()

    svc_files: List[Any] = list(cached_service_files)
    
    st.subheader("勤怠履歴CSV")
    st.info("CSVファイルをここにドラッグ&ドロップするか、下のボタンからファイルを選択してください")
    cached_attendance_files, cached_attendance_meta = load_cached_uploaded_files("attendance")
    att_uploaded_files = st.file_uploader("ファイル選択", type=["csv"], accept_multiple_files=True, key="att", label_visibility="collapsed")
    att_uploaded_files = list(att_uploaded_files) if att_uploaded_files else []
    
    if att_uploaded_files:
        for uploaded in att_uploaded_files:
            file_size = len(uploaded.getvalue()) / 1024
            size_str = f"{file_size:.1f}KB" if file_size < 1024 else f"{file_size/1024:.1f}MB"
            st.write(f"• {uploaded.name} ({size_str})")
        save_uploaded_files_to_cache("attendance", att_uploaded_files)
        cached_attendance_files, cached_attendance_meta = load_cached_uploaded_files("attendance")

    if cached_attendance_files:
        st.caption("前回アップロードした勤怠CSVを自動で使用します。")
        for meta in list(cached_attendance_meta):
            file_size = (meta.get("size") or 0) / 1024
            size_str = f"{file_size:.1f}KB" if file_size < 1024 else f"{file_size/1024:.1f}MB"
            cols = st.columns([12, 1])
            with cols[0]:
                st.write(f"• {meta.get('name')} ({size_str})")
            with cols[1]:
                if st.button("×", key=f"remove_att_{meta.get('stored_name')}"):
                    if remove_cached_file("attendance", meta.get("stored_name")):
                        cached_attendance_meta = [m for m in cached_attendance_meta if m.get("stored_name") != meta.get("stored_name")]
                        cached_attendance_files = [obj for obj in cached_attendance_files if getattr(obj, "stored_name", None) != meta.get("stored_name")]
                        st.success(f"{meta.get('name')} を削除しました。")
                        trigger_streamlit_rerun()

    att_files: List[Any] = list(cached_attendance_files)

    if att_files and len(att_files) > 1:
        st.caption("複数の勤怠CSVを選択すると自動で結合してから処理します。")

    st.caption(f"※ アップロードしたCSVはローカルの `{UPLOAD_CACHE_DISPLAY}` に保存され、次回の入れ替えや削除ボタンを押すまで保持されます。")
    
    run = st.button("エラーチェック実行", type="primary", use_container_width=True)
    
    if run:
        if not svc_files:
            st.error("サービス実態CSVを1件以上アップロードしてください。")
            st.stop()
        
        default_attendance_path = find_default_attendance_csv()
        use_default_attendance = False
        
        if not att_files:
            use_default_attendance = True
            if default_attendance_path and default_attendance_path.exists():
                st.info("勤怠履歴CSVが未アップロードのため、`input/勤怠履歴.csv` を使用します。")
            else:
                st.info("勤怠履歴CSVが未アップロードのため、組み込みの勤怠データを使用します。")

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
                    
                    if os.path.exists(actual_path):
                        saved_service_files.append(os.path.basename(actual_path))
                        
                except Exception as e:
                    st.error(f"保存エラー: {original_name} -> {str(e)}")
            
            attendance_filename = None
            actual_att_path = None
            
            if use_default_attendance:
                if default_attendance_path and default_attendance_path.exists():
                    attendance_filename = default_attendance_path.name
                    actual_att_path = os.path.join(indir, attendance_filename)
                    try:
                        shutil.copyfile(str(default_attendance_path), actual_att_path)
                    except Exception as e:
                        st.error(f"勤怠履歴CSVのコピーに失敗しました: {str(e)}")
                        st.stop()
                    attendance_df = None
                    for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                        try:
                            attendance_df = pd.read_csv(str(default_attendance_path), encoding=encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    if attendance_df is None:
                        attendance_df = build_builtin_attendance_dataframe()
                else:
                    attendance_filename = "勤怠履歴.csv"
                    actual_att_path = os.path.join(indir, attendance_filename)
                    try:
                        builtin_bytes = get_builtin_attendance_csv_bytes()
                        with open(actual_att_path, "wb") as f:
                            f.write(builtin_bytes)
                        attendance_df = build_builtin_attendance_dataframe()
                    except Exception as e:
                        st.error(f"組み込み勤怠データの準備に失敗しました: {str(e)}")
                        st.stop()
                attendance_filename = os.path.basename(actual_att_path)
                st.session_state.attendance_df = attendance_df
                st.session_state.attendance_file_path = actual_att_path
            else:
                attendance_dfs = []
                attendance_source_names = [uploaded.name for uploaded in att_files]
                encodings = ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']
                
                for uploaded in att_files:
                    file_bytes = uploaded.getvalue()
                    df = None
                    for encoding in encodings:
                        try:
                            df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                        except Exception as e:
                            st.error(f"勤怠履歴CSVの読み込みに失敗しました ({uploaded.name}): {str(e)}")
                            st.stop()
                    if df is None:
                        st.error(f"勤怠履歴CSVの読み込みに失敗しました ({uploaded.name}). 対応エンコーディング: {', '.join(encodings)}")
                        st.stop()
                    attendance_dfs.append(df)
                    if show_debug_logs:
                        st.write(f"勤怠CSV読込成功: {uploaded.name} (行数: {len(df)})")
                
                if len(attendance_dfs) == 1:
                    single_file = att_files[0]
                    attendance_filename = single_file.name
                    att_file_path = os.path.join(indir, attendance_filename)
                    try:
                        actual_att_path, att_debug_info = save_upload_to(att_file_path, single_file)
                        if not os.path.exists(actual_att_path):
                            st.error("勤怠履歴CSV保存失敗")
                            st.stop()
                        attendance_filename = os.path.basename(actual_att_path)
                        attendance_df = attendance_dfs[0]
                        st.session_state.attendance_df = attendance_df
                        st.session_state.attendance_file_path = actual_att_path
                    except Exception as e:
                        st.error(f"勤怠履歴CSV保存エラー: {str(e)}")
                        st.stop()
                else:
                    try:
                        attendance_df = pd.concat(attendance_dfs, ignore_index=True)
                    except Exception as e:
                        st.error(f"勤怠履歴CSVの結合に失敗しました: {str(e)}")
                        st.stop()
                    attendance_filename = "combined_attendance.csv"
                    actual_att_path = os.path.join(indir, attendance_filename)
                    try:
                        attendance_df.to_csv(actual_att_path, index=False, encoding="utf-8-sig")
                    except Exception as e:
                        st.error(f"結合後の勤怠履歴CSVの保存に失敗しました: {str(e)}")
                        st.stop()
                    attendance_filename = os.path.basename(actual_att_path)
                    st.session_state.attendance_df = attendance_df
                    st.session_state.attendance_file_path = actual_att_path
                    if show_debug_logs:
                        st.write(f"勤怠CSVを結合: {', '.join(attendance_source_names)} -> {attendance_filename}")
            
            # 保存されたファイルの最終確認
            all_files = os.listdir(indir)
            # 大文字小文字を区別しないCSVファイル検出
            csv_files = [f for f in all_files if f.lower().endswith('.csv')]
            
            actual_service_files = []
            actual_attendance_files = []

            if show_debug_logs:
                st.info("保存されたファイルの最終確認:")
            
            import unicodedata
            normalized_attendance = unicodedata.normalize('NFC', attendance_filename).casefold() if attendance_filename else None
            
            for csv_file in csv_files:
                file_path = os.path.join(indir, csv_file)
                file_size = os.path.getsize(file_path)
                if show_debug_logs:
                    st.write(f"• {csv_file} ({file_size} bytes)")
                
                # サービス実績ファイルと勤怠履歴ファイルを分類
                normalized_csv = unicodedata.normalize('NFC', csv_file).casefold()
                if normalized_attendance and normalized_csv == normalized_attendance:
                    actual_attendance_files.append(csv_file)
                else:
                    actual_service_files.append(csv_file)
            
            # サービス実績データをセッション状態に保存
            service_data_list = []
            for service_file in actual_service_files:
                try:
                    file_path = os.path.join(indir, service_file)
                    # 複数のエンコーディングを試行
                    df = None
                    for encoding in ['utf-8-sig', 'cp932', 'utf-8', 'shift_jis']:
                        try:
                            df = pd.read_csv(file_path, encoding=encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    
                    if df is not None:
                        service_data_list.append(df)
                        
                except Exception as e:
                    st.error(f"読み込みエラー: {service_file}")
            
            st.session_state.service_data_list = service_data_list
            
            if len(actual_service_files) == 0:
                st.error("サービス実態CSVファイルが保存されませんでした")
                st.stop()
            
            if len(actual_attendance_files) == 0:
                st.error("勤怠履歴CSVファイルが保存されませんでした")
                st.stop()

            # コマンド組み立て
            cmd = [sys.executable, src_target, "--input", indir, "--identical-prefer", identical_prefer, "--alt-delim", alt_delim]
            # 勤怠履歴CSVファイルを明示的に指定
            cmd += ["--attendance-file", attendance_filename]
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
                st.error("処理エラーが発生しました")
                with st.expander("エラー詳細", expanded=True):
                    if proc.stderr:
                        st.code(proc.stderr)
                    if proc.stdout:
                        st.code(proc.stdout)
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
            
            st.success("処理完了")

# タブ2: ②エラー確認（元の詳細データタブ）
with tab2:
    st.header("②エラー確認")
    
    if st.session_state.processing_complete and st.session_state.result_paths:
        try:
            grid_df = prepare_grid_data(st.session_state.result_paths)
            
            if not grid_df.empty:
                col_filter1, col_filter2 = st.columns(2)
                
                with col_filter1:
                    error_options = ["すべて", "エラーのみ", "正常のみ"]
                    st.session_state.setdefault("error_filter", "エラーのみ")
                    default_error_index = error_options.index(st.session_state.error_filter) if st.session_state.error_filter in error_options else error_options.index("エラーのみ")
                    error_filter = st.selectbox("エラー", error_options, index=default_error_index, key="error_filter")
                
                with col_filter2:
                    category_filter = st.selectbox("カテゴリ", ["すべて"] + [cat for cat in grid_df['カテゴリ'].unique() if pd.notna(cat) and cat != ''], key="category_filter")
                
                col_staff, col_user = st.columns(2)
                
                with col_staff:
                    available_staff = [staff for staff in grid_df['担当所員'].dropna().unique() if staff != '']
                    selected_staff = st.multiselect("担当所員", sorted(available_staff), key="staff_filter_main")
                
                with col_user:
                    available_users = [user for user in grid_df['利用者名'].dropna().unique() if user != '']
                    selected_users = st.multiselect("利用者", sorted(available_users), key="user_filter_main")
                
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
                
                total_records = len(grid_df)
                error_records = len(grid_df[grid_df['エラー'] == '◯'])
                filtered_records = len(filtered_df)
                
                col_stat1, col_stat2, col_stat3 = st.columns(3)
                with col_stat1:
                    st.metric("総件数", total_records)
                with col_stat2:
                    st.metric("エラー件数", error_records)
                with col_stat3:
                    st.metric("表示件数", filtered_records)
                
                # 条件付きスタイリングを適用したAgGridまたはカードビューを表示
                if not filtered_df.empty:
                    view_mode = st.radio(
                        "表示モード",
                        ("カード", "グリッド"),
                        horizontal=True,
                        key="view_mode_main"
                    )

                    if view_mode == "グリッド":
                        gridOptions = create_styled_grid(filtered_df)
                        
                        # AgGridを表示
                        grid_response = AgGrid(
                            filtered_df,
                            gridOptions=gridOptions,
                            data_return_mode=DataReturnMode.FILTERED_AND_SORTED,
                            update_mode=GridUpdateMode.SELECTION_CHANGED,
                            fit_columns_on_grid_load=False,
                            enable_enterprise_modules=False,
                            height=600,
                            width='100%',
                            reload_data=False,
                            allow_unsafe_jscode=True
                        )
                    else:
                        show_card_view(filtered_df)
                else:
                    st.info("フィルタ条件に一致するデータがありません")
                
            else:
                st.info("データが見つかりません")
        except Exception as e:
            st.error(f"エラー: {str(e)}")
    else:
        st.info("ファイルをアップロードしてエラーチェックを実行してください")

# タブ3: ③勤怠CSVダウンロード（元の最適勤怠データ出力タブ）
with tab3:
    st.header("③勤怠CSVダウンロード")
    # 修正済みの関数を使用
    show_optimal_attendance_export()

# タブ4: ④エラーダウンロード（元のダウンロードタブ）
with tab4:
    st.header("④エラーダウンロード")
    
    if st.session_state.processing_complete:
        # 個別ダウンロード
        if st.session_state.result_paths:
            st.subheader("結果CSV")
            st.markdown("")
            st.caption("各事業所ごとの重複チェック結果CSVを個別にダウンロードできます。")
            for p in sorted(st.session_state.result_paths):
                with open(p, "rb") as f:
                    st.download_button(
                        label=f"Download {os.path.basename(p)}",
                        data=f.read(),
                        file_name=os.path.basename(p),
                        mime="text/csv",
                    )
            st.write("")

        # 診断ダウンロード
        if st.session_state.diagnostic_paths and generate_diagnostics:
            st.subheader("診断CSV")
            st.markdown("")
            st.caption("オプションで生成した診断レポートCSVを確認できます。")
            for p in sorted(st.session_state.diagnostic_paths):
                with open(p, "rb") as f:
                    st.download_button(
                        label=f"Download {os.path.basename(p)}",
                        data=f.read(),
                        file_name=os.path.basename(p),
                        mime="text/csv",
                    )
            st.write("")

        # まとめてZIP
        if st.session_state.result_paths:
            st.subheader("一括ZIP")
            st.markdown("")
            st.caption("結果CSVと診断CSVをまとめて取得したい場合はこちらをご利用ください。")
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
                label="ZIP一括ダウンロード",
                data=buf,
                file_name=f"results_{ts}.zip",
                mime="application/zip",
            )

    else:
        st.info("ファイルをアップロードしてエラーチェックを実行してください")

# Streamlitグリッド詳細表示機能設計

## 1. 現在のStreamlitアプリ構造分析

### 1.1 既存機能
- **ファイルアップロード**: サービス実態CSV（複数）+ 勤怠履歴CSV
- **処理実行**: src.pyを呼び出してエラーチェック実行
- **サマリー表示**: 検出結果の統計情報
- **グリッド表示**: A-G, ABカラムでの結果表示
- **ビュー選択**: 全体/利用者別/従業員別/カスタム表示
- **統計情報**: 総件数、エラー件数、エラー率、利用者数

### 1.2 現在のグリッドカラム構造
```python
grid_row = {
    'A': row.get('エラー', ''),      # エラー状態
    'B': row.get('カテゴリ', ''),    # カテゴリ
    'C': row.get('担当所員', ''),    # 担当所員
    'D': row.get('日付', ''),        # 日付
    'E': row.get('開始時間', ''),    # 開始時間
    'F': row.get('終了時間', ''),    # 終了時間
    'G': row.get('利用者名', ''),    # 利用者名
    'AB': f"{row.get('サービス内容', '')} - {row.get('実施時間', '')}",
    'ファイル': os.path.basename(p),
    '行番号': idx + 1
}
```

## 2. 詳細表示機能の設計

### 2.1 新しいグリッドカラム構造

```python
def prepare_grid_data_with_details(result_paths, detail_data=None):
    """
    詳細情報を含むグリッドデータを準備
    """
    grid_data = []
    
    for p in result_paths:
        try:
            df = pd.read_csv(p, encoding="cp932")
        except UnicodeDecodeError:
            df = pd.read_csv(p, encoding="utf-8-sig")
        
        for idx, row in df.iterrows():
            grid_row = {
                # 基本情報（既存）
                'A': row.get('エラー', ''),
                'B': row.get('カテゴリ', ''),
                'C': row.get('担当所員', ''),
                'D': row.get('日付', ''),
                'E': row.get('開始時間', ''),
                'F': row.get('終了時間', ''),
                'G': row.get('利用者名', ''),
                'AB': f"{row.get('サービス内容', '')} - {row.get('実施時間', '')}",
                
                # 新規詳細情報カラム
                'H': row.get('重複時間（分）', 0),        # 重複時間
                'I': row.get('超過時間（分）', 0),        # 超過時間
                'J': row.get('重複相手施設', ''),         # 重複相手施設
                'K': row.get('重複タイプ', ''),           # 重複タイプ
                'L': row.get('カバー状況', ''),           # カバー状況
                'M': row.get('勤務区間数', 0),            # 勤務区間数
                'N': row.get('詳細ID', ''),               # 詳細ID
                
                # メタ情報
                'ファイル': os.path.basename(p),
                '行番号': idx + 1,
                '元行インデックス': idx  # 詳細情報参照用
            }
            grid_data.append(grid_row)
    
    return pd.DataFrame(grid_data)
```

### 2.2 詳細表示モードの追加

#### 2.2.1 新しいビュー選択オプション

```python
view_type = st.radio(
    "表示方法を選択してください",
    options=["全体表示", "利用者別表示", "従業員別表示", "詳細分析表示", "カスタム表示"],
    horizontal=True,
    key="view_type"
)
```

#### 2.2.2 詳細分析表示の実装

```python
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
```

### 2.3 詳細分析機能の実装

#### 2.3.1 重複分析表示

```python
def show_overlap_analysis(df):
    """重複の詳細分析を表示"""
    st.markdown("#### 📊 重複分析")
    
    # 重複データのフィルタリング
    overlap_data = df[df['H'] > 0]  # 重複時間が0より大きい
    
    if overlap_data.empty:
        st.info("重複データが見つかりませんでした。")
        return
    
    # 重複統計
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("重複件数", len(overlap_data))
    with col2:
        total_overlap_minutes = overlap_data['H'].sum()
        st.metric("総重複時間", f"{total_overlap_minutes}分")
    with col3:
        avg_overlap = overlap_data['H'].mean()
        st.metric("平均重複時間", f"{avg_overlap:.1f}分")
    with col4:
        max_overlap = overlap_data['H'].max()
        st.metric("最大重複時間", f"{max_overlap}分")
    
    # 重複タイプ別集計
    st.markdown("##### 重複タイプ別集計")
    overlap_type_stats = overlap_data.groupby('K').agg({
        'H': ['count', 'sum', 'mean'],
        'C': 'nunique'
    }).round(1)
    overlap_type_stats.columns = ['件数', '総時間(分)', '平均時間(分)', '関与職員数']
    st.dataframe(overlap_type_stats, use_container_width=True)
    
    # 施設間重複マトリックス
    st.markdown("##### 施設間重複マトリックス")
    facility_overlap = overlap_data.groupby(['ファイル', 'J'])['H'].sum().unstack(fill_value=0)
    if not facility_overlap.empty:
        st.dataframe(facility_overlap, use_container_width=True)
    
    # 詳細データ表示
    st.markdown("##### 重複詳細データ")
    display_columns = ['C', 'D', 'E', 'F', 'H', 'J', 'K', 'ファイル']
    column_names = {
        'C': '担当所員', 'D': '日付', 'E': '開始時間', 'F': '終了時間',
        'H': '重複時間(分)', 'J': '重複相手施設', 'K': '重複タイプ', 'ファイル': '施設'
    }
    
    display_df = overlap_data[display_columns].rename(columns=column_names)
    st.dataframe(display_df, use_container_width=True)
```

#### 2.3.2 勤怠超過分析表示

```python
def show_attendance_excess_analysis(df):
    """勤怠超過の詳細分析を表示"""
    st.markdown("#### ⏰ 勤怠超過分析")
    
    # 超過データのフィルタリング
    excess_data = df[df['I'] > 0]  # 超過時間が0より大きい
    
    if excess_data.empty:
        st.info("勤怠超過データが見つかりませんでした。")
        return
    
    # 超過統計
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("超過件数", len(excess_data))
    with col2:
        total_excess_minutes = excess_data['I'].sum()
        st.metric("総超過時間", f"{total_excess_minutes}分")
    with col3:
        avg_excess = excess_data['I'].mean()
        st.metric("平均超過時間", f"{avg_excess:.1f}分")
    with col4:
        max_excess = excess_data['I'].max()
        st.metric("最大超過時間", f"{max_excess}分")
    
    # カバー状況別集計
    st.markdown("##### カバー状況別集計")
    coverage_stats = excess_data.groupby('L').agg({
        'I': ['count', 'sum', 'mean'],
        'C': 'nunique'
    }).round(1)
    coverage_stats.columns = ['件数', '総時間(分)', '平均時間(分)', '関与職員数']
    st.dataframe(coverage_stats, use_container_width=True)
    
    # 職員別超過時間ランキング
    st.markdown("##### 職員別超過時間ランキング（上位10名）")
    staff_excess = excess_data.groupby('C').agg({
        'I': ['count', 'sum', 'mean'],
        'M': 'mean'
    }).round(1)
    staff_excess.columns = ['超過件数', '総超過時間(分)', '平均超過時間(分)', '平均勤務区間数']
    staff_excess = staff_excess.sort_values('総超過時間(分)', ascending=False).head(10)
    st.dataframe(staff_excess, use_container_width=True)
    
    # 詳細データ表示
    st.markdown("##### 勤怠超過詳細データ")
    display_columns = ['C', 'D', 'E', 'F', 'I', 'L', 'M', 'ファイル']
    column_names = {
        'C': '担当所員', 'D': '日付', 'E': '開始時間', 'F': '終了時間',
        'I': '超過時間(分)', 'L': 'カバー状況', 'M': '勤務区間数', 'ファイル': '施設'
    }
    
    display_df = excess_data[display_columns].rename(columns=column_names)
    st.dataframe(display_df, use_container_width=True)
```

#### 2.3.3 行選択による詳細情報表示

```python
def show_row_detail_modal(selected_row, detail_data=None):
    """選択された行の詳細情報をモーダル表示"""
    
    with st.expander(f"📋 詳細情報 - {selected_row['C']} ({selected_row['D']} {selected_row['E']}-{selected_row['F']})", expanded=True):
        
        # 基本情報
        st.markdown("##### 基本情報")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.write(f"**担当所員**: {selected_row['C']}")
            st.write(f"**日付**: {selected_row['D']}")
            st.write(f"**施設**: {selected_row['ファイル']}")
        with col2:
            st.write(f"**開始時間**: {selected_row['E']}")
            st.write(f"**終了時間**: {selected_row['F']}")
            st.write(f"**利用者**: {selected_row['G']}")
        with col3:
            st.write(f"**エラー**: {selected_row['A']}")
            st.write(f"**カテゴリ**: {selected_row['B']}")
            st.write(f"**サービス**: {selected_row['AB']}")
        
        # 重複詳細情報
        if selected_row['H'] > 0:  # 重複時間がある場合
            st.markdown("##### 🔄 重複詳細情報")
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**重複時間**: {selected_row['H']}分")
                st.write(f"**重複タイプ**: {selected_row['K']}")
            with col2:
                st.write(f"**重複相手施設**: {selected_row['J']}")
                if detail_data and selected_row['N']:
                    # 詳細データから重複相手の具体的な情報を取得
                    show_overlap_partners(selected_row['N'], detail_data)
        
        # 勤怠詳細情報
        if selected_row['I'] > 0 or selected_row['L']:  # 超過時間があるかカバー状況がある場合
            st.markdown("##### ⏰ 勤怠詳細情報")
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**超過時間**: {selected_row['I']}分")
                st.write(f"**カバー状況**: {selected_row['L']}")
            with col2:
                st.write(f"**勤務区間数**: {selected_row['M']}")
                if detail_data and selected_row['N']:
                    # 詳細データから勤務区間の具体的な情報を取得
                    show_attendance_details(selected_row['N'], detail_data)

def show_overlap_partners(detail_id, detail_data):
    """重複相手の詳細情報を表示"""
    if detail_id in detail_data:
        overlap_details = detail_data[detail_id].get('overlap_details', [])
        if overlap_details:
            st.markdown("**重複相手詳細:**")
            for detail in overlap_details:
                st.write(f"- {detail['overlap_facility']}: {detail['overlap_staff']} ({detail['overlap_start']}-{detail['overlap_end']}) - {detail['overlap_duration_minutes']}分")

def show_attendance_details(detail_id, detail_data):
    """勤怠詳細情報を表示"""
    if detail_id in detail_data:
        att_detail = detail_data[detail_id].get('attendance_detail')
        if att_detail:
            st.markdown("**勤務区間:**")
            for interval in att_detail['staff_work_intervals']:
                st.write(f"- {interval}")
            
            if att_detail['uncovered_intervals']:
                st.markdown("**未カバー区間:**")
                for interval in att_detail['uncovered_intervals']:
                    st.write(f"- {interval}")
```

### 2.4 インタラクティブ機能の追加

#### 2.4.1 行選択機能

```python
# グリッド表示部分の拡張
if not filtered_df.empty:
    st.markdown("### 📋 データグリッド")
    
    # 表示カラムの選択
    available_columns = {
        'A': 'エラー', 'B': 'カテゴリ', 'C': '担当所員', 'D': '日付',
        'E': '開始時間', 'F': '終了時間', 'G': '利用者名', 'AB': 'サービス',
        'H': '重複時間(分)', 'I': '超過時間(分)', 'J': '重複相手施設',
        'K': '重複タイプ', 'L': 'カバー状況', 'M': '勤務区間数'
    }
    
    selected_columns = st.multiselect(
        "表示するカラムを選択",
        options=list(available_columns.keys()),
        default=['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I'],
        format_func=lambda x: available_columns[x],
        key="display_columns"
    )
    
    # データ表示
    display_df = filtered_df[selected_columns + ['ファイル', '行番号', 'N']].copy()
    display_df = display_df.rename(columns=available_columns)
    
    # 行選択機能
    selected_indices = st.dataframe(
        display_df,
        use_container_width=True,
        on_select="rerun",
        selection_mode="multi-row"
    )
    
    # 選択された行の詳細表示
    if selected_indices and len(selected_indices.selection.rows) > 0:
        st.markdown("### 🔍 選択行の詳細情報")
        for row_idx in selected_indices.selection.rows:
            selected_row = filtered_df.iloc[row_idx]
            show_row_detail_modal(selected_row, detail_data)
```

## 3. 実装における技術的考慮事項

### 3.1 パフォーマンス最適化
- 大量データでの表示性能を考慮したページネーション
- 詳細情報の遅延読み込み
- キャッシュ機能の活用

### 3.2 ユーザビリティ
- 直感的なUI/UX設計
- レスポンシブデザイン
- エラーハンドリングの充実

### 3.3 データ整合性
- CSVデータと詳細情報の同期
- エラー状態の適切な表示
- データ更新時の整合性保持

## 4. 段階的実装計画

### Phase 1: 基本詳細カラムの追加
1. `prepare_grid_data_with_details`関数の実装
2. 新しいカラム（H-N）の表示対応
3. 基本統計情報の拡張

### Phase 2: 詳細分析表示の実装
1. 重複分析表示機能
2. 勤怠超過分析表示機能
3. 時間帯・職員負荷分析機能

### Phase 3: インタラクティブ機能の実装
1. 行選択機能
2. 詳細情報モーダル表示
3. 動的フィルタリング機能

この設計により、ユーザーは段階的に詳細な情報にアクセスでき、効率的な問題分析と対応が可能になります。
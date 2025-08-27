import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

# ページ設定
st.set_page_config(
    page_title="重複チェック アプリ",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# タイトル
st.title("🔍 重複チェック アプリ")
st.markdown("---")

# サイドバー
st.sidebar.header("設定")

# メイン機能
tab1, tab2, tab3 = st.tabs(["データアップロード", "重複チェック", "結果表示"])

with tab1:
    st.header("📁 データアップロード")
    
    uploaded_file = st.file_uploader(
        "CSVファイルをアップロードしてください",
        type=['csv'],
        help="重複チェックを行いたいCSVファイルを選択してください"
    )
    
    if uploaded_file is not None:
        try:
            df = pd.read_csv(uploaded_file)
            st.success(f"ファイルが正常にアップロードされました！ ({df.shape[0]}行, {df.shape[1]}列)")
            
            # データプレビュー
            st.subheader("データプレビュー")
            st.dataframe(df.head(10))
            
            # 基本統計
            st.subheader("基本統計")
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("総行数", df.shape[0])
            with col2:
                st.metric("列数", df.shape[1])
            with col3:
                st.metric("欠損値", df.isnull().sum().sum())
            with col4:
                st.metric("重複行数", df.duplicated().sum())
                
        except Exception as e:
            st.error(f"ファイルの読み込みでエラーが発生しました: {str(e)}")

with tab2:
    st.header("🔍 重複チェック")
    
    if 'df' in locals():
        # 重複チェック対象列の選択
        st.subheader("重複チェック設定")
        
        check_columns = st.multiselect(
            "重複チェックを行う列を選択してください",
            options=df.columns.tolist(),
            default=df.columns.tolist()
        )
        
        if check_columns:
            # 重複チェック実行
            if st.button("重複チェック実行", type="primary"):
                duplicates = df[df.duplicated(subset=check_columns, keep=False)]
                
                if len(duplicates) > 0:
                    st.warning(f"重複データが {len(duplicates)} 件見つかりました")
                    
                    # 重複データの表示
                    st.subheader("重複データ")
                    st.dataframe(duplicates)
                    
                    # 重複データのダウンロード
                    csv = duplicates.to_csv(index=False)
                    st.download_button(
                        label="重複データをCSVでダウンロード",
                        data=csv,
                        file_name="duplicate_data.csv",
                        mime="text/csv"
                    )
                else:
                    st.success("重複データは見つかりませんでした！")
    else:
        st.info("まずはデータをアップロードしてください")

with tab3:
    st.header("📊 結果表示")
    
    if 'df' in locals():
        # 重複統計の可視化
        st.subheader("重複統計")
        
        # 列ごとの重複数
        duplicate_counts = {}
        for col in df.columns:
            duplicate_counts[col] = df[col].duplicated().sum()
        
        if any(duplicate_counts.values()):
            fig = px.bar(
                x=list(duplicate_counts.keys()),
                y=list(duplicate_counts.values()),
                title="列ごとの重複数",
                labels={'x': '列名', 'y': '重複数'}
            )
            st.plotly_chart(fig, use_container_width=True)
        
        # データ品質サマリー
        st.subheader("データ品質サマリー")
        
        quality_metrics = {
            "総行数": df.shape[0],
            "重複行数": df.duplicated().sum(),
            "欠損値数": df.isnull().sum().sum(),
            "完全行数": df.dropna().shape[0]
        }
        
        col1, col2 = st.columns(2)
        with col1:
            for metric, value in list(quality_metrics.items())[:2]:
                st.metric(metric, value)
        with col2:
            for metric, value in list(quality_metrics.items())[2:]:
                st.metric(metric, value)
                
        # データ品質スコア
        quality_score = ((df.shape[0] - df.duplicated().sum() - df.isnull().sum().sum()) / df.shape[0]) * 100
        st.metric("データ品質スコア", f"{quality_score:.1f}%")
        
    else:
        st.info("まずはデータをアップロードしてください")

# フッター
st.markdown("---")
st.markdown("**重複チェック アプリ** - データの品質管理をサポートします")
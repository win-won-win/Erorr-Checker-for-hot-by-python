import pandas as pd

from src import CoverageInfo, OverlapInfo, update_coverage_details_in_csv, update_overlap_details_in_csv


def test_update_overlap_details_handles_strict_string_dtype_numeric_column():
    with pd.option_context("future.infer_string", True):
        df = pd.DataFrame(
            {
                "重複時間（分）": [""],
                "重複相手施設": [""],
                "重複相手担当者": [""],
                "重複利用者名": [""],
                "重複タイプ": [""],
                "重複サービス時間": [""],
            }
        )
        overlap_info = OverlapInfo(
            idx1=0,
            idx2=1,
            facility1="施設A",
            facility2="施設B",
            staff1="担当A",
            staff2="担当B",
            user1="利用者A",
            user2="利用者B",
            start1=pd.Timestamp("2024-12-01 09:00").to_pydatetime(),
            end1=pd.Timestamp("2024-12-01 10:00").to_pydatetime(),
            start2=pd.Timestamp("2024-12-01 09:30").to_pydatetime(),
            end2=pd.Timestamp("2024-12-01 10:30").to_pydatetime(),
            overlap_start=pd.Timestamp("2024-12-01 09:30").to_pydatetime(),
            overlap_end=pd.Timestamp("2024-12-01 10:00").to_pydatetime(),
            overlap_minutes=30,
            overlap_type="部分重複",
        )

        update_overlap_details_in_csv(df, 0, overlap_info, "施設B")

        assert df.at[0, "重複時間（分）"] == 30


def test_update_coverage_details_assigns_numeric_values_to_numeric_columns():
    df = pd.DataFrame(
        {
            "超過時間（分）": [0],
            "カバー状況": [""],
            "勤務区間数": [0],
            "勤務時間詳細": [""],
            "カバー済み区間": [""],
            "未カバー区間": [""],
            "代替職員勤務時間": [""],
            "エラー職員勤務時間": [""],
        }
    )
    coverage_info = CoverageInfo(
        is_fully_covered=False,
        coverage_status="カバー不足",
        total_service_minutes=60,
        covered_minutes=30,
        uncovered_minutes=30,
        work_intervals=["09:00-10:00"],
        covered_intervals=["09:00-09:30"],
        uncovered_intervals=["09:30-10:00"],
        work_interval_count=1,
    )

    update_coverage_details_in_csv(df, 0, coverage_info, staff_name="担当A", att_map={})

    assert df.at[0, "超過時間（分）"] == 30
    assert df.at[0, "勤務区間数"] == 1

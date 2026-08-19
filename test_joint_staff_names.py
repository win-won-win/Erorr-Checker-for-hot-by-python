from datetime import datetime
from pathlib import Path

import pandas as pd

from src import (
    Interval,
    analyze_staff_group_coverage,
    build_service_records,
    find_overlaps_with_details,
    split_staff_names,
    staff_names_for_row,
)


def test_comma_separated_staff_are_recognized_as_two_people():
    assert split_staff_names("山本　裕貴,源田　幸子") == ["山本 裕貴", "源田 幸子"]


def test_joint_staff_are_checked_individually_against_attendance():
    service_df = pd.DataFrame([{
        "西暦日付": "2026/08/19",
        "開始時間": "09:00",
        "終了時間": "10:00",
        "担当所員": "山本　裕貴,源田　幸子",
    }])
    records = build_service_records(Path("service.csv"), service_df, "テスト事業所")
    row = records.iloc[0]

    assert staff_names_for_row(row) == ["山本 裕貴", "源田 幸子"]
    assert row["担当形態"] == "連名（元データ: カンマ区切り）"

    work = Interval(datetime(2026, 8, 19, 8), datetime(2026, 8, 19, 18))
    attendance = {"山本裕貴": [work], "源田幸子": [work]}
    coverage = analyze_staff_group_coverage(
        Interval(row["_開始DT"], row["_終了DT"]),
        staff_names_for_row(row),
        attendance,
    )

    assert coverage.is_fully_covered is True
    assert coverage.coverage_status == "完全カバー"


def test_joint_staff_fails_when_either_person_is_not_covered():
    target = Interval(datetime(2026, 8, 19, 9), datetime(2026, 8, 19, 10))
    work = Interval(datetime(2026, 8, 19, 8), datetime(2026, 8, 19, 18))
    coverage = analyze_staff_group_coverage(
        target,
        ["山本 裕貴", "源田 幸子"],
        {"山本裕貴": [work]},
    )

    assert coverage.is_fully_covered is False
    assert any("源田 幸子" in item for item in coverage.uncovered_intervals)


def test_joint_staff_member_is_used_for_service_overlap_detection():
    common = {"西暦日付": "2026/08/19", "開始時間": "09:00", "終了時間": "10:00"}
    group = build_service_records(
        Path("group.csv"),
        pd.DataFrame([{**common, "担当所員": "山本　裕貴,源田　幸子"}]),
        "A",
    )
    single = build_service_records(
        Path("single.csv"),
        pd.DataFrame([{**common, "担当所員": "源田幸子"}]),
        "B",
    )

    overlaps = find_overlaps_with_details(group, single, "A", "B")
    assert len(overlaps) == 1

from datetime import datetime
from pathlib import Path
import time

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


def test_single_staff_overlap_results_remain_correct():
    first = build_service_records(
        Path("first.csv"),
        pd.DataFrame([
            {"西暦日付": "2026/08/20", "開始時間": "09:00", "終了時間": "10:00", "担当所員": "山本 裕貴"},
            {"西暦日付": "2026/08/20", "開始時間": "10:00", "終了時間": "11:00", "担当所員": "山本 裕貴"},
        ]),
        "A",
    )
    second = build_service_records(
        Path("second.csv"),
        pd.DataFrame([
            {"西暦日付": "2026/08/20", "開始時間": "09:30", "終了時間": "10:00", "担当所員": "山本裕貴"},
            {"西暦日付": "2026/08/20", "開始時間": "11:00", "終了時間": "12:00", "担当所員": "山本裕貴"},
        ]),
        "B",
    )

    overlaps = find_overlaps_with_details(first, second, "A", "B")
    assert [(item.idx1, item.idx2, item.overlap_minutes) for item in overlaps] == [(0, 0, 30)]


def test_single_staff_large_non_overlapping_data_finishes_quickly():
    rows = []
    for i in range(500):
        minute = i * 2
        hour, minute_of_hour = divmod(minute, 60)
        end_hour, end_minute = divmod(minute + 1, 60)
        rows.append({
            "西暦日付": "2026/08/20",
            "開始時間": f"{hour:02}:{minute_of_hour:02}",
            "終了時間": f"{end_hour:02}:{end_minute:02}",
            "担当所員": "山本 裕貴",
        })
    records = build_service_records(Path("large.csv"), pd.DataFrame(rows), "A")

    started = time.perf_counter()
    overlaps = find_overlaps_with_details(records, records, "A", "A")
    elapsed = time.perf_counter() - started

    assert len(overlaps) == 500  # 各行の自己比較のみ（呼び出し側で除外される）
    assert elapsed < 5.0

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
勤務時間最適化提案機能
既存のsrc.pyの機能を活用して、従業員の勤務時間を最適化する提案を生成
"""

import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, NamedTuple
from dataclasses import dataclass
import numpy as np
from src import (
    Interval, normalize_name, parse_date_any, parse_minute_of_day,
    minute_to_datetimetetime, build_work_intervals, build_service_records,
    interval_fully_covered, find_overlaps, build_staff_busy_map
)

@dataclass
class WorkPattern:
    """勤務パターンを表現するクラス"""
    employee_name: str
    date: datetime
    work_start: int  # 分単位（0-1440+）
    work_end: int    # 分単位（0-1440+）
    break_periods: List[Tuple[int, int]]  # 休憩時間のリスト（開始分, 終了分）
    
    def total_work_minutes(self) -> int:
        """実働時間を分で返す"""
        total = self.work_end - self.work_start
        for break_start, break_end in self.break_periods:
            total -= (break_end - break_start)
        return max(0, total)

@dataclass
class OptimizationResult:
    """最適化結果を表現するクラス"""
    pattern_name: str
    description: str
    current_pattern: WorkPattern
    proposed_pattern: WorkPattern
    benefits: List[str]
    error_reduction: int
    work_time_change: int  # 分単位での変更（正の値は増加、負の値は減少）
    feasibility_score: float  # 0-1の実現可能性スコア

class WorkOptimizer:
    """勤務時間最適化エンジン"""
    
    def __init__(self, att_df: pd.DataFrame, service_dfs: Dict[str, pd.DataFrame]):
        self.att_df = att_df
        self.service_dfs = service_dfs
        self.att_map, self.att_name_index = build_work_intervals(att_df)
        self.busy_map = build_staff_busy_map(service_dfs)
        
    def analyze_employee_patterns(self, employee_name: str) -> Dict[str, any]:
        """従業員の勤務パターンを分析"""
        normalized_name = normalize_name(employee_name)
        
        # 勤怠データから該当従業員の情報を抽出
        employee_att = self.att_df[
            self.att_df['名前'].apply(normalize_name) == normalized_name
        ].copy()
        
        if employee_att.empty:
            return {"error": "従業員が見つかりません"}
        
        # サービス提供データから該当従業員の情報を抽出
        employee_services = []
        for facility, df in self.service_dfs.items():
            facility_services = df[
                df['_担当所員_norm'] == normalized_name
            ].copy()
            if not facility_services.empty:
                facility_services['施設'] = facility
                employee_services.append(facility_services)
        
        all_services = pd.concat(employee_services, ignore_index=True) if employee_services else pd.DataFrame()
        
        # 勤務パターンの統計
        work_intervals = self.att_map.get(normalized_name, [])
        total_work_days = len(employee_att)
        total_work_hours = sum(iv.duration_minutes() for iv in work_intervals) / 60
        
        # エラー分析
        error_analysis = self._analyze_errors(normalized_name, all_services)
        
        return {
            "employee_name": employee_name,
            "normalized_name": normalized_name,
            "total_work_days": total_work_days,
            "total_work_hours": total_work_hours,
            "avg_daily_hours": total_work_hours / max(1, total_work_days),
            "work_intervals": work_intervals,
            "service_records": all_services,
            "error_analysis": error_analysis,
            "attendance_data": employee_att
        }
    
    def _analyze_errors(self, normalized_name: str, services_df: pd.DataFrame) -> Dict[str, any]:
        """エラー分析を実行"""
        if services_df.empty:
            return {"total_errors": 0, "error_types": {}}
        
        work_intervals = self.att_map.get(normalized_name, [])
        errors = {
            "勤怠履歴超過": 0,
            "施設間重複": 0,
            "事業所内重複": 0
        }
        
        # 勤怠履歴超過のチェック
        for _, service in services_df.iterrows():
            if pd.isna(service["_開始DT"]) or pd.isna(service["_終了DT"]):
                continue
            service_interval = Interval(service["_開始DT"], service["_終了DT"])
            if not interval_fully_covered(service_interval, work_intervals):
                errors["勤怠履歴超過"] += 1
        
        # 重複エラーのチェック（簡略版）
        for facility, facility_services in services_df.groupby('施設'):
            overlaps = find_overlaps(facility_services, facility_services)
            errors["事業所内重複"] += len([o for o in overlaps if o[0] != o[1]]) // 2
        
        return {
            "total_errors": sum(errors.values()),
            "error_types": errors
        }
    
    def generate_optimization_patterns(self, employee_name: str) -> List[OptimizationResult]:
        """複数の最適化パターンを生成"""
        analysis = self.analyze_employee_patterns(employee_name)
        if "error" in analysis:
            return []
        
        patterns = []
        
        # パターン1: 現在の勤務時間を基準とした微調整
        pattern1 = self._generate_fine_tuning_pattern(analysis)
        if pattern1:
            patterns.append(pattern1)
        
        # パターン2: サービス提供時間に最適化
        pattern2 = self._generate_service_optimized_pattern(analysis)
        if pattern2:
            patterns.append(pattern2)
        
        # パターン3: 他の従業員との重複を最小化
        pattern3 = self._generate_conflict_minimized_pattern(analysis)
        if pattern3:
            patterns.append(pattern3)
        
        # パターン4: 労働時間の均等化
        pattern4 = self._generate_balanced_pattern(analysis)
        if pattern4:
            patterns.append(pattern4)
        
        return patterns
    
    def _generate_fine_tuning_pattern(self, analysis: Dict) -> Optional[OptimizationResult]:
        """現在の勤務時間を基準とした微調整パターン"""
        att_data = analysis["attendance_data"]
        if att_data.empty:
            return None
        
        # 最も一般的な勤務パターンを特定
        work_starts = []
        work_ends = []
        
        for _, row in att_data.iterrows():
            start_time = parse_minute_of_day(row.get("出勤1"))
            end_time = parse_minute_of_day(row.get("退勤1"))
            if start_time is not None and end_time is not None:
                work_starts.append(start_time)
                work_ends.append(end_time)
        
        if not work_starts:
            return None
        
        # 平均的な勤務時間を計算
        avg_start = int(np.mean(work_starts))
        avg_end = int(np.mean(work_ends))
        
        # 微調整：15分単位で調整
        adjusted_start = (avg_start // 15) * 15
        adjusted_end = ((avg_end + 14) // 15) * 15
        
        # 現在のパターンと提案パターンを作成
        current_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=avg_start,
            work_end=avg_end,
            break_periods=[(12*60, 13*60)]  # デフォルト昼休み
        )
        
        proposed_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=adjusted_start,
            work_end=adjusted_end,
            break_periods=[(12*60, 13*60)]
        )
        
        benefits = [
            "勤務時間を15分単位に整理",
            "管理しやすい時間設定",
            "現在のパターンからの最小限の変更"
        ]
        
        return OptimizationResult(
            pattern_name="微調整パターン",
            description="現在の勤務時間を基準に15分単位で調整",
            current_pattern=current_pattern,
            proposed_pattern=proposed_pattern,
            benefits=benefits,
            error_reduction=1,
            work_time_change=proposed_pattern.total_work_minutes() - current_pattern.total_work_minutes(),
            feasibility_score=0.9
        )
    
    def _generate_service_optimized_pattern(self, analysis: Dict) -> Optional[OptimizationResult]:
        """サービス提供時間に最適化したパターン"""
        services = analysis["service_records"]
        if services.empty:
            return None
        
        # サービス提供時間の範囲を分析
        service_starts = []
        service_ends = []
        
        for _, service in services.iterrows():
            if pd.notna(service["_開始DT"]) and pd.notna(service["_終了DT"]):
                start_dt = service["_開始DT"]
                end_dt = service["_終了DT"]
                service_starts.append(start_dt.hour * 60 + start_dt.minute)
                service_ends.append(end_dt.hour * 60 + end_dt.minute)
        
        if not service_starts:
            return None
        
        # サービス提供時間に合わせた勤務時間を提案
        earliest_service = min(service_starts)
        latest_service = max(service_ends)
        
        # 30分のバッファを追加
        proposed_start = max(0, earliest_service - 30)
        proposed_end = min(24*60, latest_service + 30)
        
        # 現在の平均的なパターンを計算
        att_data = analysis["attendance_data"]
        current_starts = [parse_minute_of_day(row.get("出勤1")) for _, row in att_data.iterrows()]
        current_ends = [parse_minute_of_day(row.get("退勤1")) for _, row in att_data.iterrows()]
        current_starts = [s for s in current_starts if s is not None]
        current_ends = [e for e in current_ends if e is not None]
        
        avg_current_start = int(np.mean(current_starts)) if current_starts else 9*60
        avg_current_end = int(np.mean(current_ends)) if current_ends else 17*60
        
        current_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=avg_current_start,
            work_end=avg_current_end,
            break_periods=[(12*60, 13*60)]
        )
        
        proposed_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=proposed_start,
            work_end=proposed_end,
            break_periods=[(12*60, 13*60)]
        )
        
        benefits = [
            "サービス提供時間を完全にカバー",
            "勤怠履歴超過エラーの削減",
            "効率的な業務時間配分"
        ]
        
        error_reduction = analysis["error_analysis"]["error_types"].get("勤怠履歴超過", 0)
        
        return OptimizationResult(
            pattern_name="サービス最適化パターン",
            description="サービス提供時間に合わせて勤務時間を最適化",
            current_pattern=current_pattern,
            proposed_pattern=proposed_pattern,
            benefits=benefits,
            error_reduction=error_reduction,
            work_time_change=proposed_pattern.total_work_minutes() - current_pattern.total_work_minutes(),
            feasibility_score=0.8
        )
    
    def _generate_conflict_minimized_pattern(self, analysis: Dict) -> Optional[OptimizationResult]:
        """他の従業員との重複を最小化するパターン"""
        normalized_name = analysis["normalized_name"]
        
        # 他の従業員の繁忙時間を分析
        busy_intervals = []
        for name, intervals in self.busy_map.items():
            if name != normalized_name:
                busy_intervals.extend(intervals)
        
        if not busy_intervals:
            return None
        
        # 繁忙時間を避けた勤務時間を提案
        # 簡略化：最も空いている時間帯を特定
        hour_usage = [0] * 24
        for interval in busy_intervals:
            start_hour = interval.start.hour
            end_hour = interval.end.hour
            for h in range(start_hour, min(end_hour + 1, 24)):
                hour_usage[h] += 1
        
        # 最も使用率の低い8時間を特定
        min_usage_hours = sorted(range(24), key=lambda h: hour_usage[h])[:8]
        min_usage_hours.sort()
        
        # 連続する時間帯を優先
        best_start = min_usage_hours[0]
        proposed_start = best_start * 60
        proposed_end = (best_start + 8) * 60
        
        # 現在のパターン
        att_data = analysis["attendance_data"]
        current_starts = [parse_minute_of_day(row.get("出勤1")) for _, row in att_data.iterrows()]
        current_ends = [parse_minute_of_day(row.get("退勤1")) for _, row in att_data.iterrows()]
        current_starts = [s for s in current_starts if s is not None]
        current_ends = [e for e in current_ends if e is not None]
        
        avg_current_start = int(np.mean(current_starts)) if current_starts else 9*60
        avg_current_end = int(np.mean(current_ends)) if current_ends else 17*60
        
        current_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=avg_current_start,
            work_end=avg_current_end,
            break_periods=[(12*60, 13*60)]
        )
        
        proposed_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=proposed_start,
            work_end=proposed_end,
            break_periods=[(12*60, 13*60)]
        )
        
        benefits = [
            "他の従業員との重複を最小化",
            "施設間重複エラーの削減",
            "リソースの効率的な配分"
        ]
        
        conflict_errors = (analysis["error_analysis"]["error_types"].get("施設間重複", 0) + 
                          analysis["error_analysis"]["error_types"].get("事業所内重複", 0))
        
        return OptimizationResult(
            pattern_name="重複最小化パターン",
            description="他の従業員との重複を避けた勤務時間",
            current_pattern=current_pattern,
            proposed_pattern=proposed_pattern,
            benefits=benefits,
            error_reduction=conflict_errors,
            work_time_change=proposed_pattern.total_work_minutes() - current_pattern.total_work_minutes(),
            feasibility_score=0.7
        )
    
    def _generate_balanced_pattern(self, analysis: Dict) -> Optional[OptimizationResult]:
        """労働時間の均等化パターン"""
        # 全従業員の平均労働時間を計算
        all_work_hours = []
        for name, intervals in self.att_map.items():
            total_minutes = sum(iv.duration_minutes() for iv in intervals)
            all_work_hours.append(total_minutes / 60)
        
        if not all_work_hours:
            return None
        
        target_daily_hours = np.mean(all_work_hours) / max(1, len(analysis["attendance_data"]))
        target_minutes = int(target_daily_hours * 60)
        
        # 標準的な勤務時間（9:00-18:00）をベースに調整
        standard_start = 9 * 60  # 9:00
        proposed_end = standard_start + target_minutes + 60  # 昼休み1時間を追加
        
        # 現在のパターン
        current_total_minutes = sum(iv.duration_minutes() for iv in analysis["work_intervals"])
        current_daily_minutes = current_total_minutes // max(1, analysis["total_work_days"])
        
        current_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=9*60,
            work_end=9*60 + current_daily_minutes + 60,
            break_periods=[(12*60, 13*60)]
        )
        
        proposed_pattern = WorkPattern(
            employee_name=analysis["employee_name"],
            date=datetime.now().date(),
            work_start=standard_start,
            work_end=proposed_end,
            break_periods=[(12*60, 13*60)]
        )
        
        benefits = [
            "全従業員の労働時間を均等化",
            "公平な労働時間配分",
            "標準的な勤務時間への調整"
        ]
        
        return OptimizationResult(
            pattern_name="均等化パターン",
            description="全従業員の労働時間を均等化",
            current_pattern=current_pattern,
            proposed_pattern=proposed_pattern,
            benefits=benefits,
            error_reduction=0,
            work_time_change=proposed_pattern.total_work_minutes() - current_pattern.total_work_minutes(),
            feasibility_score=0.6
        )

def format_time_minutes(minutes: int) -> str:
    """分を時:分形式に変換"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

def calculate_optimization_impact(results: List[OptimizationResult]) -> Dict[str, any]:
    """最適化結果の影響を計算"""
    if not results:
        return {}
    
    total_error_reduction = sum(r.error_reduction for r in results)
    avg_feasibility = np.mean([r.feasibility_score for r in results])
    work_time_changes = [r.work_time_change for r in results]
    
    return {
        "total_patterns": len(results),
        "total_error_reduction": total_error_reduction,
        "average_feasibility": avg_feasibility,
        "work_time_changes": work_time_changes,
        "recommended_pattern": max(results, key=lambda r: r.feasibility_score * (1 + r.error_reduction/10))
    }
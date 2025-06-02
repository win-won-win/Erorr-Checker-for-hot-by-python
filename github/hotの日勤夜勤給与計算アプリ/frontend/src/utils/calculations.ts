import { ShiftEntry, CalculationResult, Employee } from '../types';
import { format, parseISO, differenceInHours, differenceInMinutes, isWithinInterval, set } from 'date-fns';
import { getEmployeeById, getEmployeeByName } from '../data/employees';

// Constants for calculations
const DAY_SHIFT_HOURLY_RATE = 1300;
const NIGHT_SHIFT_HOURLY_RATE = 1200;
const NIGHT_SHIFT_ALLOWANCE = 3000; // per day
const OVERTIME_MULTIPLIER = 1.25;
const LATE_NIGHT_MULTIPLIER = 1.25;

/**
 * Calculate work hours with precision
 */
export const calculateWorkHours = (start: Date, end: Date): number => {
  try {
    // 日付オブジェクトをログに出力
    console.log(`計算開始 - 開始時間: ${start.toISOString()}, 終了時間: ${end.toISOString()}`);
    
    // 日付が有効かチェック
    if (!(start instanceof Date) || isNaN(start.getTime())) {
      console.error('開始時間が無効です:', start);
      return 0;
    }
    
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      console.error('終了時間が無効です:', end);
      return 0;
    }
    
    // 終了時間が開始時間より前の場合
    if (end < start) {
      console.warn('終了時間が開始時間より前です。正確な計算ができません。');
      console.warn(`開始時間: ${start.toISOString()}, 終了時間: ${end.toISOString()}`);
      return 0;
    }
    
    // date-fnsのdifferenceInMinutesを使用して分単位の差分を計算
    const diffMinutes = differenceInMinutes(end, start);
    console.log(`分単位の差分: ${diffMinutes}分`);
    
    // ミリ秒単位の差分も計算して比較
    const diffMs = end.getTime() - start.getTime();
    const diffHoursMs = diffMs / (1000 * 60 * 60);
    console.log(`ミリ秒からの時間計算: ${diffHoursMs}時間`);
    
    // 分を時間に変換（小数点以下2桁まで）
    const hours = Math.round((diffMinutes / 60) * 100) / 100;
    console.log(`最終計算結果: ${hours}時間`);
    
    return hours;
  } catch (error) {
    console.error('勤務時間計算エラー:', error);
    return 0;
  }
};

/**
 * Calculate late night hours (10 PM to 5 AM)
 */
export const calculateLateNightHours = (start: Date, end: Date): number => {
  // 日付オブジェクトをログに出力
  console.log(`深夜時間計算 - 開始時間: ${start.toISOString()}, 終了時間: ${end.toISOString()}`);
  
  let lateNightHours = 0;
  
  // Function to check if specific hour is between 22:00 and 05:00
  const isLateNightHour = (hour: Date): boolean => {
    const hourNum = hour.getHours();
    const isLateNight = hourNum >= 22 || hourNum < 5;
    console.log(`時刻 ${hour.toISOString()} は深夜時間${isLateNight ? 'です' : 'ではありません'} (${hourNum}時)`);
    return isLateNight;
  };
  
  // Check each hour between start and end
  let currentHour = new Date(start);
  while (currentHour < end) {
    const nextHour = new Date(currentHour);
    nextHour.setHours(nextHour.getHours() + 1);
    
    // If next hour exceeds end time, use end time instead
    const checkEnd = nextHour > end ? end : nextHour;
    
    // If current hour is late night, add the fraction of hour
    if (isLateNightHour(currentHour)) {
      const hourFraction = differenceInMinutes(checkEnd, currentHour) / 60;
      lateNightHours += hourFraction;
    }
    
    currentHour = nextHour;
  }
  
  return Math.round(lateNightHours * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate overtime hours (beyond 8 hours in a shift)
 */
export const calculateOvertimeHours = (totalHours: number): number => {
  // 勤務時間が負の値や無効な値の場合は0を返す
  if (isNaN(totalHours) || totalHours <= 0) {
    console.warn(`無効な勤務時間: ${totalHours}`);
    return 0;
  }
  
  const overtimeHours = totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0;
  console.log(`残業時間計算: 合計${totalHours}時間 -> 残業${overtimeHours}時間`);
  return overtimeHours;
};

/**
 * Calculate day shift payment
 */
export const calculateDayShiftPay = (shifts: ShiftEntry[]): CalculationResult[] => {
  // Group shifts by employee
  const employeeShifts: Record<string, ShiftEntry[]> = {};
  
  shifts.forEach(shift => {
    if (shift.シフト種別 !== 'day') return;
    
    if (!employeeShifts[shift.従業員名]) {
      employeeShifts[shift.従業員名] = [];
    }
    employeeShifts[shift.従業員名].push(shift);
  });
  
  // Calculate totals for each employee
  return Object.entries(employeeShifts).map(([従業員名, shifts]) => {
    const employee = getEmployeeByName(従業員名);
    const totalHours = shifts.reduce((sum, shift) => 
      sum + calculateWorkHours(shift.開始時間, shift.終了時間), 0);
    const totalDays = shifts.length;
    const totalPay = Math.round(totalHours * DAY_SHIFT_HOURLY_RATE);
    
    return {
      従業員ID: employee?.id || '',
      従業員名,
      合計時間: totalHours,
      合計日数: totalDays,
      合計給与: totalPay,
      詳細: {
        時給基本給: DAY_SHIFT_HOURLY_RATE,
        基本給合計: totalPay
      }
    };
  });
};

/**
 * Calculate night shift payment with all allowances
 */
export const calculateNightShiftPay = (shifts: ShiftEntry[]): CalculationResult[] => {
  // Group shifts by employee
  const employeeShifts: Record<string, ShiftEntry[]> = {};
  
  shifts.forEach(shift => {
    if (shift.シフト種別 !== 'night') return;
    
    if (!employeeShifts[shift.従業員名]) {
      employeeShifts[shift.従業員名] = [];
    }
    employeeShifts[shift.従業員名].push(shift);
  });
  
  // Calculate totals for each employee
  return Object.entries(employeeShifts).map(([従業員名, shifts]) => {
    const employee = getEmployeeByName(従業員名);
    const totalHours = shifts.reduce((sum, shift) => 
      sum + calculateWorkHours(shift.開始時間, shift.終了時間), 0);
    const totalDays = shifts.length;
    
    // Calculate allowances
    const nightShiftAllowance = totalDays * NIGHT_SHIFT_ALLOWANCE;
    
    let overtimeAllowance = 0;
    let lateNightAllowance = 0;
    
    shifts.forEach(shift => {
      const hours = calculateWorkHours(shift.開始時間, shift.終了時間);
      const overtimeHours = calculateOvertimeHours(hours);
      const lateNightHours = calculateLateNightHours(shift.開始時間, shift.終了時間);
      
      overtimeAllowance += overtimeHours * NIGHT_SHIFT_HOURLY_RATE * (OVERTIME_MULTIPLIER - 1);
      lateNightAllowance += lateNightHours * NIGHT_SHIFT_HOURLY_RATE * (LATE_NIGHT_MULTIPLIER - 1);
    });
    
    // Calculate base pay (excluding overtime hours which are calculated separately)
    const basePayTotal = totalHours * NIGHT_SHIFT_HOURLY_RATE;
    
    // Calculate improvement allowance if employee has percentage set
    const improvementAllowancePercent = employee?.改善手当パーセント || 0;
    const improvementAllowance = basePayTotal * (improvementAllowancePercent / 100);
    
    // Calculate total pay
    const totalPay = Math.round(
      basePayTotal + 
      nightShiftAllowance + 
      overtimeAllowance + 
      lateNightAllowance + 
      improvementAllowance
    );
    
    return {
      従業員ID: employee?.id || '',
      従業員名,
      合計時間: totalHours,
      合計日数: totalDays,
      合計給与: totalPay,
      詳細: {
        時給基本給: NIGHT_SHIFT_HOURLY_RATE,
        基本給合計: Math.round(basePayTotal),
        夜勤手当: Math.round(nightShiftAllowance),
        残業手当: Math.round(overtimeAllowance),
        深夜手当: Math.round(lateNightAllowance),
        改善手当: Math.round(improvementAllowance)
      }
    };
  });
};
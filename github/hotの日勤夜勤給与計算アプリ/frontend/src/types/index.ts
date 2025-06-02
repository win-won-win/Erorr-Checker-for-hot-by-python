export interface Employee {
  id?: string;
  従業員ID: string;
  従業員名: string;
  時給: number;
  深夜時給: number;
  改善手当パーセント?: number;
}

export interface ShiftEntry {
  id?: string;
  従業員ID: string;
  従業員名: string;
  シフト種別: 'day' | 'night';
  開始時間: Date;
  終了時間: Date;
  勤務時間?: number;
}

export interface CalculationResult {
  従業員ID: string;
  従業員名: string;
  合計時間: number;
  合計日数: number;
  合計給与: number;
  詳細?: {
    時給基本給: number;
    基本給合計: number;
    夜勤手当?: number;
    残業手当?: number;
    深夜手当?: number;
    改善手当?: number;
  };
}

export interface MonthlyReport {
  月: string;
  年: string;
  従業員一覧: CalculationResult[];
}
export interface Employee {
  id?: string;
  従業員ID: string;
  従業員名: string;
  時給: number;
  深夜時給: number;
}

export interface ShiftEntry {
  id?: string;
  従業員ID: string;
  従業員名: string;
  シフト種別: 'day' | 'night';
  開始時間: Date;
  終了時間: Date;
  勤務時間: number;
}
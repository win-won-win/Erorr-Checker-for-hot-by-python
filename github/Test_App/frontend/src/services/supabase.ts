import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 従業員関連のAPI
export const employeeApi = {
  // 従業員一覧の取得
  async getEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 従業員の取得
  async getEmployee(id: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // 従業員の作成
  async createEmployee(employee: any) {
    const { data, error } = await supabase
      .from('employees')
      .insert(employee)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 従業員の更新
  async updateEmployee(id: string, employee: any) {
    const { data, error } = await supabase
      .from('employees')
      .update(employee)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 従業員の削除
  async deleteEmployee(id: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// 給与計算関連のAPI
export const salaryApi = {
  // 給与計算の実行と保存
  async calculateAndSaveSalary(employeeId: string, year: number, month: number) {
    const { data, error } = await supabase
      .from('salary_calculations')
      .insert({
        employee_id: employeeId,
        year,
        month,
        // 実際の計算ロジックはバックエンドで実装
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 給与計算履歴の取得
  async getSalaryHistory(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_calculations')
      .select('*')
      .eq('employee_id', employeeId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    return data;
  }
};
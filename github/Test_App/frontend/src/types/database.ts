export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          employee_code: string
          department: string
          position: string
          employment_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
          start_date: string
          salary_base: number
          salary_hourly_rate: number | null
          tax_category: string
          dependents: number
          social_insurance: boolean
          bank_name: string
          branch_name: string
          account_type: 'SAVINGS' | 'CHECKING'
          account_number: string
          account_holder: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      salary_calculations: {
        Row: {
          id: string
          employee_id: string
          year: number
          month: number
          base_salary: number
          overtime_pay: number
          allowances: Json
          deductions: Json
          gross_pay: number
          net_pay: number
          tax_deductions: Json
          calculated_at: string
        }
        Insert: Omit<Database['public']['Tables']['salary_calculations']['Row'], 'id' | 'calculated_at'>
        Update: Partial<Database['public']['Tables']['salary_calculations']['Insert']>
      }
      allowances: {
        Row: {
          id: string
          employee_id: string
          type: string
          amount: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['allowances']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['allowances']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
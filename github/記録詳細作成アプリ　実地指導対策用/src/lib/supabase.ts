import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if environment variables are not set
const defaultUrl = 'https://placeholder.supabase.co';
const defaultKey = 'placeholder-anon-key';

export const supabase = createClient(
  supabaseUrl || defaultUrl,
  supabaseAnonKey || defaultKey
);

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && 
         supabaseAnonKey && 
         supabaseUrl !== 'https://placeholder.supabase.co' && 
         supabaseAnonKey !== 'placeholder-anon-key';
};

// Helper function to test database connection
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error as Error };
  }
};
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          name_kana: string;
          user_code: string;
          care_level: string;
          insurance_number: string;
          insured_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_kana: string;
          user_code: string;
          care_level?: string;
          insurance_number?: string;
          insured_number?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_kana?: string;
          user_code?: string;
          care_level?: string;
          insurance_number?: string;
          insured_number?: string;
          updated_at?: string;
        };
      };
      staff: {
        Row: {
          id: string;
          name: string;
          staff_code: string;
          email: string;
          is_service_manager: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          staff_code: string;
          email?: string;
          is_service_manager?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          staff_code?: string;
          email?: string;
          is_service_manager?: boolean;
          updated_at?: string;
        };
      };
      service_patterns: {
        Row: {
          id: string;
          pattern_name: string;
          pattern_details: any;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pattern_name: string;
          pattern_details?: any;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pattern_name?: string;
          pattern_details?: any;
          description?: string;
          updated_at?: string;
        };
      };
      csv_service_records: {
        Row: {
          id: string;
          user_id: string | null;
          staff_id: string | null;
          facility_id: string | null;
          pattern_id: string | null;
          comment_template_id: string | null;
          user_name: string;
          user_code: string;
          staff_name: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          service_date: string;
          service_content: string;
          special_notes: string;
          record_created_at: string | null;
          print_datetime: string | null;
          service_details: any;
          is_manually_created: boolean;
          is_pattern_assigned: boolean;
          csv_import_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          staff_id?: string | null;
          facility_id?: string | null;
          pattern_id?: string | null;
          comment_template_id?: string | null;
          user_name: string;
          user_code?: string;
          staff_name: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          service_date: string;
          service_content?: string;
          special_notes?: string;
          record_created_at?: string | null;
          print_datetime?: string | null;
          service_details?: any;
          is_manually_created?: boolean;
          is_pattern_assigned?: boolean;
          csv_import_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          staff_id?: string | null;
          facility_id?: string | null;
          pattern_id?: string | null;
          comment_template_id?: string | null;
          user_name?: string;
          user_code?: string;
          staff_name?: string;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          service_date?: string;
          service_content?: string;
          special_notes?: string;
          record_created_at?: string | null;
          print_datetime?: string | null;
          service_details?: any;
          is_manually_created?: boolean;
          is_pattern_assigned?: boolean;
          csv_import_batch_id?: string | null;
          updated_at?: string;
        };
      };
      csv_import_logs: {
        Row: {
          id: string;
          filename: string;
          import_count: number;
          success_count: number;
          error_count: number;
          import_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          import_count?: number;
          success_count?: number;
          error_count?: number;
          import_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          filename?: string;
          import_count?: number;
          success_count?: number;
          error_count?: number;
          import_user_id?: string | null;
        };
      };
    };
    user_time_patterns: {
      Row: {
        id: string;
        user_id: string;
        pattern_id: string;
        start_time: string;
        end_time: string;
        day_of_week: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        pattern_id: string;
        start_time: string;
        end_time: string;
        day_of_week: number;
        is_active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        pattern_id?: string;
        start_time?: string;
        end_time?: string;
        day_of_week?: number;
        is_active?: boolean;
        updated_at?: string;
      };
    };
  };
};
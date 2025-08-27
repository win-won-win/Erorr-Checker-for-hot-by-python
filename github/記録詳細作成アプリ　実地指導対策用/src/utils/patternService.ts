/**
 * パターン管理サービス（シンプル版）
 * パターンの作成、保存、管理機能を提供
 */

import {
  ServicePattern,
  PatternDetails,
  UserTimePattern
} from '../types/pattern';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * シンプルなパターン管理サービス
 */
export class PatternService {
  private patterns: ServicePattern[] = [];
  private userTimePatterns: UserTimePattern[] = [];

  constructor() {
    this.loadSampleData();
  }

  /**
   * サンプルデータの読み込み
   */
  private loadSampleData(): void {
    // サンプルパターンデータ
    this.patterns = [
      {
        id: '1',
        pattern_name: '排泄介助＋食事介助',
        description: '排泄介助と食事介助を組み合わせた基本的なケアパターン',
        pattern_details: {
          pre_check: { health_check: true, environment_setup: false, consultation_record: false },
          excretion: { toilet_assistance: true, portable_toilet: false, diaper_change: true, pad_change: false, cleaning: true, bowel_movement_count: 1, urination_count: 2 },
          meal: { full_assistance: true, completion_status: '完食', water_intake: 200 },
          body_care: { body_wipe: '', full_body_bath: false, partial_bath_hand: false, partial_bath_foot: false, hair_wash: false, face_wash: false, grooming: false, oral_care: false },
          body_grooming: { nail_care_hand: false, nail_care_foot: false, clothing_assistance: false },
          transfer_movement: { transfer_assistance: false, movement_assistance: false, outing_assistance: false, position_change: false },
          sleep_wake: { wake_assistance: false, sleep_assistance: false },
          medication: { medication_assistance: false, ointment_eye_drops: false, sputum_suction: false },
          self_support: { cooking_together: false, safety_monitoring: false, housework_together: false, motivation_support: false },
          life_support: { 
            cleaning: { room_cleaning: false, toilet_cleaning: false, table_cleaning: false }, 
            garbage_disposal: false, 
            preparation_cleanup: false, 
            laundry: { washing_drying: false, folding_storage: false, ironing: false }, 
            bedding: { sheet_change: false, cover_change: false, bed_making: false, futon_airing: false }, 
            clothing: { organization: false, repair: false }, 
            cooking: { general_cooking: false, serving: false, cleanup: false }, 
            shopping: { daily_items: false, medicine_pickup: false } 
          },
          exit_check: { fire_check: true, electricity_check: true, water_check: true, door_lock_check: true }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        pattern_name: '入浴介助＋水分補給',
        description: '入浴介助と水分補給を中心としたケアパターン',
        pattern_details: {
          pre_check: { health_check: true, environment_setup: true, consultation_record: false },
          excretion: { toilet_assistance: false, portable_toilet: false, diaper_change: false, pad_change: false, cleaning: false, bowel_movement_count: 0, urination_count: 0 },
          meal: { full_assistance: false, completion_status: '', water_intake: 300 },
          body_care: { body_wipe: '', full_body_bath: true, partial_bath_hand: false, partial_bath_foot: false, hair_wash: true, face_wash: true, grooming: true, oral_care: true },
          body_grooming: { nail_care_hand: false, nail_care_foot: false, clothing_assistance: true },
          transfer_movement: { transfer_assistance: true, movement_assistance: false, outing_assistance: false, position_change: false },
          sleep_wake: { wake_assistance: false, sleep_assistance: false },
          medication: { medication_assistance: false, ointment_eye_drops: false, sputum_suction: false },
          self_support: { cooking_together: false, safety_monitoring: true, housework_together: false, motivation_support: false },
          life_support: { 
            cleaning: { room_cleaning: false, toilet_cleaning: false, table_cleaning: false }, 
            garbage_disposal: false, 
            preparation_cleanup: false, 
            laundry: { washing_drying: false, folding_storage: false, ironing: false }, 
            bedding: { sheet_change: false, cover_change: false, bed_making: false, futon_airing: false }, 
            clothing: { organization: false, repair: false }, 
            cooking: { general_cooking: false, serving: false, cleanup: false }, 
            shopping: { daily_items: false, medicine_pickup: false } 
          },
          exit_check: { fire_check: true, electricity_check: true, water_check: true, door_lock_check: true }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '3',
        pattern_name: '清拭＋服薬介助',
        description: '清拭と服薬介助を組み合わせたケアパターン',
        pattern_details: {
          pre_check: { health_check: true, environment_setup: false, consultation_record: true },
          excretion: { toilet_assistance: false, portable_toilet: false, diaper_change: false, pad_change: false, cleaning: false, bowel_movement_count: 0, urination_count: 0 },
          meal: { full_assistance: false, completion_status: '', water_intake: 0 },
          body_care: { body_wipe: '全身', full_body_bath: false, partial_bath_hand: false, partial_bath_foot: false, hair_wash: false, face_wash: true, grooming: false, oral_care: true },
          body_grooming: { nail_care_hand: false, nail_care_foot: false, clothing_assistance: true },
          transfer_movement: { transfer_assistance: false, movement_assistance: false, outing_assistance: false, position_change: false },
          sleep_wake: { wake_assistance: false, sleep_assistance: false },
          medication: { medication_assistance: true, ointment_eye_drops: false, sputum_suction: false },
          self_support: { cooking_together: false, safety_monitoring: true, housework_together: false, motivation_support: false },
          life_support: { 
            cleaning: { room_cleaning: false, toilet_cleaning: false, table_cleaning: false }, 
            garbage_disposal: false, 
            preparation_cleanup: false, 
            laundry: { washing_drying: false, folding_storage: false, ironing: false }, 
            bedding: { sheet_change: false, cover_change: false, bed_making: false, futon_airing: false }, 
            clothing: { organization: false, repair: false }, 
            cooking: { general_cooking: false, serving: false, cleanup: false }, 
            shopping: { daily_items: false, medicine_pickup: false } 
          },
          exit_check: { fire_check: true, electricity_check: true, water_check: true, door_lock_check: true }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // サンプル利用者時間パターンデータ
    this.userTimePatterns = [
      {
        id: '1',
        user_id: '1',
        user_name: '田中 花子',
        pattern_id: '1',
        pattern_name: '排泄介助＋食事介助',
        start_time: '09:00',
        end_time: '10:00',
        day_of_week: 1, // 月曜日
        is_active: true,
        pattern_details: this.patterns[0].pattern_details,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        user_id: '1',
        user_name: '田中 花子',
        pattern_id: '2',
        pattern_name: '入浴介助＋水分補給',
        start_time: '14:00',
        end_time: '15:00',
        day_of_week: 3, // 水曜日
        is_active: true,
        pattern_details: this.patterns[1].pattern_details,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '3',
        user_id: '2',
        user_name: '山田 次郎',
        pattern_id: '3',
        pattern_name: '清拭＋服薬介助',
        start_time: '10:30',
        end_time: '11:30',
        day_of_week: 2, // 火曜日
        is_active: true,
        pattern_details: this.patterns[2].pattern_details,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  /**
   * パターンを作成
   */
  async createPattern(pattern: Omit<ServicePattern, 'id' | 'created_at' | 'updated_at'>): Promise<ServicePattern> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルに保存
        const newPattern: ServicePattern = {
          ...pattern,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.patterns.push(newPattern);
        return newPattern;
      }

      const { data, error } = await supabase
        .from('service_patterns')
        .insert([{
          pattern_name: pattern.pattern_name,
          description: pattern.description,
          pattern_details: pattern.pattern_details
        }])
        .select()
        .single();

      if (error) {
        console.error('パターン作成エラー:', error);
        throw new Error('パターンの作成に失敗しました');
      }

      return data;
    } catch (error) {
      console.error('パターン作成エラー:', error);
      throw error;
    }
  }

  /**
   * パターンを更新
   */
  async updatePattern(id: string, updates: Partial<ServicePattern>): Promise<ServicePattern> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルで更新
        const index = this.patterns.findIndex(p => p.id === id);
        if (index === -1) {
          throw new Error(`Pattern with id ${id} not found`);
        }

        const updatedPattern = {
          ...this.patterns[index],
          ...updates,
          updated_at: new Date().toISOString()
        };

        this.patterns[index] = updatedPattern;
        return updatedPattern;
      }

      const { data, error } = await supabase
        .from('service_patterns')
        .update({
          pattern_name: updates.pattern_name,
          description: updates.description,
          pattern_details: updates.pattern_details,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('パターン更新エラー:', error);
        throw new Error('パターンの更新に失敗しました');
      }

      return data;
    } catch (error) {
      console.error('パターン更新エラー:', error);
      throw error;
    }
  }

  /**
   * パターンを削除
   */
  async deletePattern(id: string): Promise<boolean> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルで削除
        const index = this.patterns.findIndex(p => p.id === id);
        if (index === -1) {
          return false;
        }

        this.patterns.splice(index, 1);
        this.userTimePatterns = this.userTimePatterns.filter(utp => utp.pattern_id !== id);
        return true;
      }

      const { error } = await supabase
        .from('service_patterns')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('パターン削除エラー:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('パターン削除エラー:', error);
      return false;
    }
  }

  /**
   * パターンを取得
   */
  async getPattern(id: string): Promise<ServicePattern | null> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルデータから取得
        return this.patterns.find(p => p.id === id) || null;
      }

      const { data, error } = await supabase
        .from('service_patterns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('パターン取得エラー:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('パターン取得エラー:', error);
      return null;
    }
  }

  /**
   * パターン一覧を取得
   */
  async listPatterns(): Promise<ServicePattern[]> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルデータを返す
        return [...this.patterns];
      }

      const { data, error } = await supabase
        .from('service_patterns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('パターン取得エラー:', error);
        // エラーの場合はローカルデータを返す
        return [...this.patterns];
      }

      return data || [];
    } catch (error) {
      console.error('パターン取得エラー:', error);
      // エラーの場合はローカルデータを返す
      return [...this.patterns];
    }
  }

  /**
   * 利用者時間パターンを作成
   */
  async createUserTimePattern(userTimePattern: Omit<UserTimePattern, 'id' | 'created_at' | 'updated_at'>): Promise<UserTimePattern> {
    const pattern = await this.getPattern(userTimePattern.pattern_id);
    if (!pattern) {
      throw new Error(`Pattern with id ${userTimePattern.pattern_id} not found`);
    }

    const newUserTimePattern: UserTimePattern = {
      ...userTimePattern,
      pattern_name: pattern.pattern_name,
      pattern_details: pattern.pattern_details,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.userTimePatterns.push(newUserTimePattern);
    return newUserTimePattern;
  }

  /**
   * 利用者時間パターンを更新
   */
  async updateUserTimePattern(id: string, updates: Partial<UserTimePattern>): Promise<UserTimePattern> {
    const index = this.userTimePatterns.findIndex(utp => utp.id === id);
    if (index === -1) {
      throw new Error(`UserTimePattern with id ${id} not found`);
    }

    // パターンIDが変更された場合、パターン詳細も更新
    if (updates.pattern_id && updates.pattern_id !== this.userTimePatterns[index].pattern_id) {
      const pattern = await this.getPattern(updates.pattern_id);
      if (pattern) {
        updates.pattern_name = pattern.pattern_name;
        updates.pattern_details = pattern.pattern_details;
      }
    }

    const updatedUserTimePattern = {
      ...this.userTimePatterns[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.userTimePatterns[index] = updatedUserTimePattern;
    return updatedUserTimePattern;
  }

  /**
   * 利用者時間パターンを削除
   */
  async deleteUserTimePattern(id: string): Promise<boolean> {
    const index = this.userTimePatterns.findIndex(utp => utp.id === id);
    if (index === -1) {
      return false;
    }

    this.userTimePatterns.splice(index, 1);
    return true;
  }

  /**
   * 利用者時間パターンを取得
   */
  async getUserTimePattern(id: string): Promise<UserTimePattern | null> {
    return this.userTimePatterns.find(utp => utp.id === id) || null;
  }

  /**
   * 利用者時間パターン一覧を取得
   */
  async listUserTimePatterns(filter?: {
    user_id?: string;
    day_of_week?: number;
    is_active?: boolean;
  }): Promise<UserTimePattern[]> {
    let result = [...this.userTimePatterns];

    if (filter) {
      if (filter.user_id) {
        result = result.filter(utp => utp.user_id === filter.user_id);
      }
      if (filter.day_of_week !== undefined) {
        result = result.filter(utp => utp.day_of_week === filter.day_of_week);
      }
      if (filter.is_active !== undefined) {
        result = result.filter(utp => utp.is_active === filter.is_active);
      }
    }

    return result;
  }

  /**
   * 特定の利用者と曜日のパターンを取得
   */
  async getUserPatternsForDay(userId: string, dayOfWeek: number): Promise<UserTimePattern[]> {
    return this.userTimePatterns.filter(
      utp => utp.user_id === userId && utp.day_of_week === dayOfWeek && utp.is_active
    );
  }

  /**
   * 週間スケジュールデータを取得
   */
  async getWeeklyScheduleData(): Promise<{ [key: string]: UserTimePattern[] }> {
    const scheduleData: { [key: string]: UserTimePattern[] } = {};
    
    this.userTimePatterns.forEach(utp => {
      if (utp.is_active) {
        const key = `${utp.user_id}_${utp.day_of_week}`;
        if (!scheduleData[key]) {
          scheduleData[key] = [];
        }
        scheduleData[key].push(utp);
      }
    });

    return scheduleData;
  }

  /**
   * パターンの使用統計を取得
   */
  async getPatternUsageStats(patternId: string): Promise<{
    total_usage: number;
    active_usage: number;
    users: string[];
    days: number[];
  }> {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はローカルデータから取得
        const usages = this.userTimePatterns.filter(utp => utp.pattern_id === patternId);
        const activeUsages = usages.filter(utp => utp.is_active);
        
        return {
          total_usage: usages.length,
          active_usage: activeUsages.length,
          users: [...new Set(usages.map(utp => utp.user_name))],
          days: [...new Set(usages.map(utp => utp.day_of_week))]
        };
      }

      // Supabaseからパターンの使用統計を取得
      // service_recordsテーブルからpattern_idで検索
      const { data, error } = await supabase
        .from('service_records')
        .select('user_name, service_date')
        .eq('pattern_id', patternId);

      if (error) {
        console.error('パターン使用統計取得エラー:', error);
        return {
          total_usage: 0,
          active_usage: 0,
          users: [],
          days: []
        };
      }

      const records = data || [];
      const users = [...new Set(records.map(r => r.user_name))];
      const days = [...new Set(records.map(r => new Date(r.service_date).getDay()))];

      return {
        total_usage: records.length,
        active_usage: records.length, // 実際のレコードは全てアクティブとみなす
        users,
        days
      };
    } catch (error) {
      console.error('パターン使用統計取得エラー:', error);
      return {
        total_usage: 0,
        active_usage: 0,
        users: [],
        days: []
      };
    }
  }
}

// シングルトンインスタンス
export const patternService = new PatternService();
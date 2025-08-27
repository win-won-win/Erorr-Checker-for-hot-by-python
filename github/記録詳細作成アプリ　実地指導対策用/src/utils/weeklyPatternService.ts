/**
 * 週間パターン自動作成サービス（新仕様対応版）
 * 同じ利用者・同じ時間のデータをグループ化し、一括記録作成とパターン保存機能を提供
 */

import { supabase } from '../lib/supabase';
import { ServicePattern, PatternDetails } from '../types/pattern';

/**
 * グループ化されたデータの型定義
 */
export interface GroupedTimeData {
  id: string;
  user_name: string;
  start_time: string;
  count: number;
  sample_records: CSVRecord[]; // 表示用の最初の5件
  all_records: CSVRecord[]; // 実際の全レコード（記録作成用）
  main_service_type: string;
  suggested_pattern_name: string;
  is_pattern_created: boolean;
  pattern_id?: string;
}

/**
 * CSVレコードの型定義
 */
export interface CSVRecord {
  id: string;
  user_name: string;
  staff_name?: string;
  service_date: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  service_content?: string;
  service_details?: PatternDetails;
  is_pattern_assigned: boolean;
  pattern_id?: string | null;
  created_at: string;
}

/**
 * 一括記録作成用のデータ型
 */
export interface BulkRecordCreationData {
  user_name: string;
  start_time: string;
  records: CSVRecord[];
  pattern_details: PatternDetails;
  pattern_name: string;
}

/**
 * 週間パターン自動作成サービス（新仕様）
 */
export class WeeklyPatternService {
  /**
   * 同じ利用者・同じ時間のデータをグループ化して取得
   */
  async getGroupedTimeData(): Promise<GroupedTimeData[]> {
    try {
      const { data, error } = await supabase
        .from('csv_service_records')
        .select(`
          id,
          user_name,
          staff_name,
          service_date,
          start_time,
          end_time,
          duration_minutes,
          service_content,
          service_details,
          is_pattern_assigned,
          pattern_id,
          created_at
        `)
        .order('service_date', { ascending: false });

      if (error) {
        throw new Error(`データ取得エラー: ${error.message}`);
      }

      // 利用者名 + 開始時間でグループ化
      const grouped: Record<string, CSVRecord[]> = {};
      
      (data || []).forEach(record => {
        const key = `${record.user_name}_${record.start_time}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(record);
      });

      // グループ化されたデータを変換
      const result: GroupedTimeData[] = [];
      
      Object.entries(grouped).forEach(([key, records]) => {
        const [user_name, start_time] = key.split('_');
        const mainServiceType = this.extractMainServiceType(records);
        const suggestedPatternName = `${user_name}_${start_time}_${mainServiceType}`;
        
        // パターンが既に作成されているかチェック
        const hasPattern = records.some(r => r.pattern_id);
        const patternId = hasPattern ? records.find(r => r.pattern_id)?.pattern_id : undefined;

        result.push({
          id: key,
          user_name,
          start_time,
          count: records.length,
          sample_records: records.slice(0, 5), // 最初の5件をサンプルとして表示
          all_records: records, // 全レコード（記録作成用）
          main_service_type: mainServiceType,
          suggested_pattern_name: suggestedPatternName,
          is_pattern_created: hasPattern,
          pattern_id: patternId || undefined
        });
      });

      // 件数の多い順にソート
      return result.sort((a, b) => b.count - a.count);

    } catch (error) {
      console.error('グループ化データ取得エラー:', error);
      throw error;
    }
  }

  /**
   * メインサービスタイプを抽出
   */
  private extractMainServiceType(records: CSVRecord[]): string {
    const serviceTypes: Record<string, number> = {};
    
    records.forEach(record => {
      const content = record.service_content?.toLowerCase() || '';
      
      if (content.includes('食事') || content.includes('食べ')) {
        serviceTypes['食事介助'] = (serviceTypes['食事介助'] || 0) + 1;
      } else if (content.includes('入浴') || content.includes('お風呂')) {
        serviceTypes['入浴介助'] = (serviceTypes['入浴介助'] || 0) + 1;
      } else if (content.includes('トイレ') || content.includes('排泄')) {
        serviceTypes['排泄介助'] = (serviceTypes['排泄介助'] || 0) + 1;
      } else if (content.includes('清拭')) {
        serviceTypes['清拭'] = (serviceTypes['清拭'] || 0) + 1;
      } else if (content.includes('服薬') || content.includes('薬')) {
        serviceTypes['服薬介助'] = (serviceTypes['服薬介助'] || 0) + 1;
      } else if (content.includes('掃除') || content.includes('清掃')) {
        serviceTypes['掃除'] = (serviceTypes['掃除'] || 0) + 1;
      } else if (content.includes('洗濯')) {
        serviceTypes['洗濯'] = (serviceTypes['洗濯'] || 0) + 1;
      } else if (content.includes('調理') || content.includes('料理')) {
        serviceTypes['調理'] = (serviceTypes['調理'] || 0) + 1;
      } else {
        serviceTypes['その他'] = (serviceTypes['その他'] || 0) + 1;
      }
    });

    // 最も多いサービスタイプを返す
    const sortedTypes = Object.entries(serviceTypes).sort((a, b) => b[1] - a[1]);
    return sortedTypes.length > 0 ? sortedTypes[0][0] : 'その他';
  }

  /**
   * 一括記録作成用のパターン詳細を生成
   */
  async generatePatternForBulkCreation(records: CSVRecord[]): Promise<PatternDetails> {
    const pattern = this.getDefaultPatternDetails();
    
    // レコードからサービス内容を分析してパターンを生成
    records.forEach(record => {
      const content = record.service_content?.toLowerCase() || '';
      
      // 排泄関連
      if (content.includes('トイレ') || content.includes('排泄')) {
        pattern.excretion.toilet_assistance = true;
      }
      if (content.includes('おむつ') || content.includes('オムツ')) {
        pattern.excretion.diaper_change = true;
      }
      if (content.includes('パッド')) {
        pattern.excretion.pad_change = true;
      }

      // 食事関連
      if (content.includes('食事') || content.includes('食べ')) {
        pattern.meal.full_assistance = true;
        pattern.meal.completion_status = '完食';
        pattern.meal.water_intake = 200;
      }

      // 身体介護関連
      if (content.includes('入浴') || content.includes('お風呂')) {
        pattern.body_care.full_body_bath = true;
      }
      if (content.includes('清拭')) {
        pattern.body_care.body_wipe = '部分';
      }
      if (content.includes('洗髪')) {
        pattern.body_care.hair_wash = true;
      }
      if (content.includes('口腔') || content.includes('歯磨き')) {
        pattern.body_care.oral_care = true;
      }

      // 服薬関連
      if (content.includes('服薬') || content.includes('薬')) {
        pattern.medication.medication_assistance = true;
      }

      // 生活援助関連
      if (content.includes('掃除') || content.includes('清掃')) {
        pattern.life_support.cleaning.room_cleaning = true;
      }
      if (content.includes('洗濯')) {
        pattern.life_support.laundry.washing_drying = true;
      }
      if (content.includes('調理') || content.includes('料理')) {
        pattern.life_support.cooking.general_cooking = true;
      }
    });

    return pattern;
  }

  /**
   * 仕様書に則ったランダム時間を生成
   */
  generateRandomTimes(baseStartTime: string, count: number): Array<{ start_time: string; end_time: string }> {
    const times: Array<{ start_time: string; end_time: string }> = [];
    const [baseHour, baseMinute] = baseStartTime.split(':').map(Number);
    
    for (let i = 0; i < count; i++) {
      // ベース時間から±30分の範囲でランダムに調整
      const minuteVariation = Math.floor(Math.random() * 61) - 30; // -30 to +30
      const totalMinutes = baseHour * 60 + baseMinute + minuteVariation;
      
      // 時間を正規化（0-23時間、0-59分）
      const startHour = Math.max(0, Math.min(23, Math.floor(totalMinutes / 60)));
      const startMinute = Math.max(0, Math.min(59, totalMinutes % 60));
      
      // サービス時間は30分〜120分の範囲でランダム
      const serviceDuration = 30 + Math.floor(Math.random() * 91); // 30-120分
      const endTotalMinutes = startHour * 60 + startMinute + serviceDuration;
      const endHour = Math.min(23, Math.floor(endTotalMinutes / 60));
      const endMinute = Math.min(59, endTotalMinutes % 60);
      
      times.push({
        start_time: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
        end_time: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
      });
    }
    
    return times;
  }

  /**
   * パターンを作成・保存
   */
  async createAndSavePattern(
    patternName: string,
    patternDetails: PatternDetails,
    description: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('service_patterns')
        .insert({
          pattern_name: patternName,
          description: description,
          pattern_details: patternDetails
        })
        .select()
        .single();

      if (error) {
        throw new Error(`パターン作成エラー: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('パターン保存エラー:', error);
      throw error;
    }
  }

  /**
   * レコードにパターンを紐付け
   */
  async linkPatternToRecords(recordIds: string[], patternId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('csv_service_records')
        .update({
          pattern_id: patternId,
          is_pattern_assigned: true
        })
        .in('id', recordIds);

      if (error) {
        throw new Error(`パターン紐付けエラー: ${error.message}`);
      }
    } catch (error) {
      console.error('パターン紐付けエラー:', error);
      throw error;
    }
  }

  /**
   * 利用者の健康基準値を取得してランダム値を生成
   */
  async generateHealthCheckValues(userName: string) {
    try {
      const { data: userMaster, error } = await supabase
        .from('users_master')
        .select('temperature_min, temperature_max, blood_pressure_systolic_min, blood_pressure_systolic_max, blood_pressure_diastolic_min, blood_pressure_diastolic_max, pulse_min, pulse_max')
        .eq('name', userName)
        .single();

      if (error || !userMaster) {
        console.log('利用者マスタが見つからないため、デフォルト値を使用します:', userName);
        // デフォルト値を使用
        const temperature = (36.0 + Math.random() * 1.5).toFixed(1);
        const systolic = Math.floor(100 + Math.random() * 40);
        const diastolic = Math.floor(60 + Math.random() * 30);
        const pulse = Math.floor(60 + Math.random() * 40);
        
        return {
          temperature,
          blood_pressure: `${systolic}/${diastolic}`,
          pulse: pulse.toString()
        };
      }

      // 利用者固有の基準値を使用してランダム値を生成
      const tempMin = userMaster.temperature_min || 36.0;
      const tempMax = userMaster.temperature_max || 37.5;
      const temperature = (tempMin + Math.random() * (tempMax - tempMin)).toFixed(1);

      const systolicMin = userMaster.blood_pressure_systolic_min || 100;
      const systolicMax = userMaster.blood_pressure_systolic_max || 140;
      const systolic = Math.floor(systolicMin + Math.random() * (systolicMax - systolicMin));

      const diastolicMin = userMaster.blood_pressure_diastolic_min || 60;
      const diastolicMax = userMaster.blood_pressure_diastolic_max || 90;
      const diastolic = Math.floor(diastolicMin + Math.random() * (diastolicMax - diastolicMin));

      const pulseMin = userMaster.pulse_min || 60;
      const pulseMax = userMaster.pulse_max || 100;
      const pulse = Math.floor(pulseMin + Math.random() * (pulseMax - pulseMin));

      return {
        temperature,
        blood_pressure: `${systolic}/${diastolic}`,
        pulse: pulse.toString()
      };
    } catch (error) {
      console.error('健康チェック値生成エラー:', error);
      // エラー時はデフォルト値を返す
      const temperature = (36.0 + Math.random() * 1.5).toFixed(1);
      const systolic = Math.floor(100 + Math.random() * 40);
      const diastolic = Math.floor(60 + Math.random() * 30);
      const pulse = Math.floor(60 + Math.random() * 40);
      
      return {
        temperature,
        blood_pressure: `${systolic}/${diastolic}`,
        pulse: pulse.toString()
      };
    }
  }

  /**
   * リアルな記録作成時間を生成
   * サービス提供時間の前後5分～1時間後の範囲でランダムに生成
   */
  generateRealisticRecordCreationTime(serviceDate: string, startTime: string, endTime: string): string {
    const serviceDateTime = new Date(`${serviceDate}T${startTime}`);
    const endDateTime = new Date(`${serviceDate}T${endTime}`);
    
    // 90%の確率でサービス提供時間の前後5分以内
    // 10%の確率で1時間後まで（忘れていて後で記録するパターン）
    const isImmediate = Math.random() < 0.9;
    
    let recordTime: Date;
    
    if (isImmediate) {
      // サービス開始5分前からサービス終了5分後の範囲
      const minTime = new Date(serviceDateTime.getTime() - 5 * 60 * 1000); // 5分前
      const maxTime = new Date(endDateTime.getTime() + 5 * 60 * 1000); // 5分後
      const randomTime = minTime.getTime() + Math.random() * (maxTime.getTime() - minTime.getTime());
      recordTime = new Date(randomTime);
    } else {
      // サービス終了後から1時間後の範囲
      const minTime = endDateTime;
      const maxTime = new Date(endDateTime.getTime() + 60 * 60 * 1000); // 1時間後
      const randomTime = minTime.getTime() + Math.random() * (maxTime.getTime() - minTime.getTime());
      recordTime = new Date(randomTime);
    }
    
    return recordTime.toISOString();
  }

  /**
   * パターンから実際の記録を作成
   */
  async createServiceRecordsFromPattern(
    patternId: string,
    csvRecords: CSVRecord[],
    patternDetails: PatternDetails,
    specialNotes: string,
    depositAmount: number,
    depositBreakdown: string,
    depositChange: number
  ): Promise<void> {
    try {
      console.log(`記録作成開始: ${csvRecords.length}件のCSVレコードを処理します`);
      console.log('CSVレコード詳細:', csvRecords.map(r => ({ id: r.id, user_name: r.user_name, service_date: r.service_date, start_time: r.start_time })));
      
      const recordsToCreate = [];

      for (const csvRecord of csvRecords) {
        console.log(`処理中: レコードID ${csvRecord.id}, 利用者: ${csvRecord.user_name}`);
        
        // 各記録に対してランダムな健康チェック値を生成
        const healthValues = await this.generateHealthCheckValues(csvRecord.user_name);
        
        // リアルな記録作成時間を生成
        const recordCreationTime = this.generateRealisticRecordCreationTime(
          csvRecord.service_date,
          csvRecord.start_time,
          csvRecord.end_time
        );
        
        // パターン詳細に健康チェック値を設定
        const recordPatternDetails = {
          ...patternDetails,
          pre_check: {
            ...patternDetails.pre_check,
            temperature: healthValues.temperature,
            blood_pressure: healthValues.blood_pressure,
            pulse: healthValues.pulse
          }
        };

        const serviceRecord = {
          user_name: csvRecord.user_name,
          staff_name: csvRecord.staff_name || '',
          service_date: csvRecord.service_date,
          start_time: csvRecord.start_time,
          end_time: csvRecord.end_time,
          duration_minutes: csvRecord.duration_minutes || 60,
          service_content: csvRecord.service_content || '',
          service_type: csvRecord.service_content || '', // CSVのサービス内容をservice_typeとして使用
          special_notes: specialNotes,
          deposit_amount: depositAmount,
          deposit_breakdown: depositBreakdown,
          deposit_change: depositChange,
          service_details: recordPatternDetails,
          pattern_id: patternId,
          csv_record_id: csvRecord.id,
          created_at: recordCreationTime,
          updated_at: recordCreationTime
        };

        recordsToCreate.push(serviceRecord);
      }

      console.log(`作成準備完了: ${recordsToCreate.length}件の記録を一括挿入します`);

      // バッチサイズを制限して一括挿入を実行（Supabaseの制限を考慮）
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < recordsToCreate.length; i += batchSize) {
        const batch = recordsToCreate.slice(i, i + batchSize);
        console.log(`バッチ ${Math.floor(i / batchSize) + 1}: ${batch.length}件を挿入中...`);
        
        const { data, error } = await supabase
          .from('service_records')
          .insert(batch)
          .select('id');

        if (error) {
          console.error(`バッチ挿入エラー (${i}-${i + batch.length - 1}):`, error);
          throw new Error(`記録作成エラー: ${error.message}`);
        }

        totalInserted += batch.length;
        console.log(`バッチ完了: ${batch.length}件挿入 (累計: ${totalInserted}件)`);
      }

      console.log(`記録作成完了: 合計${totalInserted}件の記録を作成しました`);
    } catch (error) {
      console.error('記録作成エラー:', error);
      throw error;
    }
  }

  /**
   * パターンの紐付けを解除
   */
  async unlinkPatternFromRecords(recordIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('csv_service_records')
        .update({
          pattern_id: null,
          is_pattern_assigned: false
        })
        .in('id', recordIds);

      if (error) {
        throw new Error(`パターン紐付け解除エラー: ${error.message}`);
      }
    } catch (error) {
      console.error('パターン紐付け解除エラー:', error);
      throw error;
    }
  }

  /**
   * パターンを削除
   */
  async deletePattern(patternId: string): Promise<void> {
    try {
      // まず関連するレコードの紐付けを解除
      await supabase
        .from('csv_service_records')
        .update({
          pattern_id: null,
          is_pattern_assigned: false
        })
        .eq('pattern_id', patternId);

      // パターンを削除
      const { error } = await supabase
        .from('service_patterns')
        .delete()
        .eq('id', patternId);

      if (error) {
        throw new Error(`パターン削除エラー: ${error.message}`);
      }
    } catch (error) {
      console.error('パターン削除エラー:', error);
      throw error;
    }
  }

  /**
   * 統計情報を取得
   */
  async getStatistics(): Promise<{
    total_groups: number;
    groups_with_patterns: number;
    groups_without_patterns: number;
    total_records: number;
  }> {
    try {
      const groupedData = await this.getGroupedTimeData();
      const groupsWithPatterns = groupedData.filter(g => g.is_pattern_created).length;
      const totalRecords = groupedData.reduce((sum, g) => sum + g.count, 0);

      return {
        total_groups: groupedData.length,
        groups_with_patterns: groupsWithPatterns,
        groups_without_patterns: groupedData.length - groupsWithPatterns,
        total_records: totalRecords
      };
    } catch (error) {
      console.error('統計情報取得エラー:', error);
      return {
        total_groups: 0,
        groups_with_patterns: 0,
        groups_without_patterns: 0,
        total_records: 0
      };
    }
  }

  /**
   * デフォルトのパターン詳細を取得
   */
  private getDefaultPatternDetails(): PatternDetails {
    return {
      pre_check: {
        health_check: false,
        environment_setup: false,
        consultation_record: false,
      },
      excretion: {
        toilet_assistance: false,
        portable_toilet: false,
        diaper_change: false,
        pad_change: false,
        cleaning: false,
        bowel_movement_count: 0,
        urination_count: 0,
      },
      meal: {
        full_assistance: false,
        completion_status: '',
        water_intake: 0,
      },
      body_care: {
        body_wipe: '',
        full_body_bath: false,
        partial_bath_hand: false,
        partial_bath_foot: false,
        hair_wash: false,
        face_wash: false,
        grooming: false,
        oral_care: false,
      },
      body_grooming: {
        nail_care_hand: false,
        nail_care_foot: false,
        clothing_assistance: false,
      },
      transfer_movement: {
        transfer_assistance: false,
        movement_assistance: false,
        outing_assistance: false,
        position_change: false,
      },
      sleep_wake: {
        wake_assistance: false,
        sleep_assistance: false,
      },
      medication: {
        medication_assistance: false,
        ointment_eye_drops: false,
        sputum_suction: false,
      },
      self_support: {
        cooking_together: false,
        safety_monitoring: false,
        housework_together: false,
        motivation_support: false,
      },
      life_support: {
        cleaning: {
          room_cleaning: false,
          toilet_cleaning: false,
          table_cleaning: false,
        },
        garbage_disposal: false,
        preparation_cleanup: false,
        laundry: {
          washing_drying: false,
          folding_storage: false,
          ironing: false,
        },
        bedding: {
          sheet_change: false,
          cover_change: false,
          bed_making: false,
          futon_airing: false,
        },
        clothing: {
          organization: false,
          repair: false,
        },
        cooking: {
          general_cooking: false,
          serving: false,
          cleanup: false,
        },
        shopping: {
          daily_items: false,
          medicine_pickup: false,
        },
      },
      exit_check: {
        fire_check: false,
        electricity_check: false,
        water_check: false,
        door_lock_check: false,
      },
    };
  }
}

// シングルトンインスタンス
export const weeklyPatternService = new WeeklyPatternService();
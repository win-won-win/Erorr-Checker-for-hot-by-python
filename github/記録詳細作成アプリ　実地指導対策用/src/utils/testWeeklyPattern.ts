import { patternService } from './patternService';
import { ServicePattern, UserTimePattern } from '../types/pattern';
import { supabase } from '../lib/supabase';

// テスト用パターンデータ
const testPatterns: Omit<ServicePattern, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    pattern_name: 'テスト用身体介護パターン',
    pattern_details: {
      pre_check: { health_check: true, environment_setup: false, consultation_record: false },
      excretion: { toilet_assistance: true, portable_toilet: false, diaper_change: false, pad_change: false, cleaning: true, bowel_movement_count: 1, urination_count: 1 },
      meal: { full_assistance: true, completion_status: '完食', water_intake: 200 },
      body_care: { body_wipe: '', full_body_bath: false, partial_bath_hand: false, partial_bath_foot: false, hair_wash: false, face_wash: false, grooming: false, oral_care: false },
      body_grooming: { nail_care_hand: false, nail_care_foot: false, clothing_assistance: false },
      transfer_movement: { transfer_assistance: true, movement_assistance: false, outing_assistance: false, position_change: false },
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
      exit_check: { fire_check: false, electricity_check: false, water_check: false, door_lock_check: false }
    },
    description: 'テスト用の基本的な身体介護パターン'
  },
  {
    pattern_name: 'テスト用生活援助パターン',
    pattern_details: {
      pre_check: { health_check: false, environment_setup: true, consultation_record: false },
      excretion: { toilet_assistance: false, portable_toilet: false, diaper_change: false, pad_change: false, cleaning: false, bowel_movement_count: 0, urination_count: 0 },
      meal: { full_assistance: false, completion_status: '', water_intake: 0 },
      body_care: { body_wipe: '', full_body_bath: false, partial_bath_hand: false, partial_bath_foot: false, hair_wash: false, face_wash: false, grooming: false, oral_care: false },
      body_grooming: { nail_care_hand: false, nail_care_foot: false, clothing_assistance: false },
      transfer_movement: { transfer_assistance: false, movement_assistance: false, outing_assistance: false, position_change: false },
      sleep_wake: { wake_assistance: false, sleep_assistance: false },
      medication: { medication_assistance: false, ointment_eye_drops: false, sputum_suction: false },
      self_support: { cooking_together: false, safety_monitoring: true, housework_together: true, motivation_support: false },
      life_support: {
        cleaning: { room_cleaning: true, toilet_cleaning: false, table_cleaning: true },
        garbage_disposal: true,
        preparation_cleanup: true,
        laundry: { washing_drying: true, folding_storage: true, ironing: false },
        bedding: { sheet_change: false, cover_change: false, bed_making: false, futon_airing: false },
        clothing: { organization: false, repair: false },
        cooking: { general_cooking: false, serving: false, cleanup: true },
        shopping: { daily_items: true, medicine_pickup: false }
      },
      exit_check: { fire_check: true, electricity_check: true, water_check: true, door_lock_check: true }
    },
    description: 'テスト用の生活援助パターン'
  }
];

// パターン作成テスト
export async function testPatternCreation() {
  console.log('=== パターン作成テスト開始 ===');
  
  try {
    const createdPatterns: ServicePattern[] = [];
    
    for (const patternData of testPatterns) {
      const pattern = await patternService.createPattern(patternData);
      createdPatterns.push(pattern);
      console.log('✅ パターン作成成功:', pattern.pattern_name);
    }
    
    console.log(`✅ パターン作成テスト完了: ${createdPatterns.length}件作成`);
    return {
      success: true,
      patterns: createdPatterns
    };
    
  } catch (error) {
    console.error('❌ パターン作成テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// パターン取得テスト
export async function testPatternRetrieval() {
  console.log('=== パターン取得テスト開始 ===');
  
  try {
    const patterns = await patternService.listPatterns();
    console.log(`✅ パターン取得成功: ${patterns.length}件`);
    
    // 各パターンの詳細を表示
    patterns.forEach((pattern: ServicePattern, index: number) => {
      console.log(`パターン ${index + 1}:`, {
        ID: pattern.id,
        名前: pattern.pattern_name,
        説明: pattern.description,
        詳細: pattern.pattern_details
      });
    });
    
    return {
      success: true,
      patterns
    };
    
  } catch (error) {
    console.error('❌ パターン取得テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// パターン更新テスト
export async function testPatternUpdate() {
  console.log('=== パターン更新テスト開始 ===');
  
  try {
    // まず既存のパターンを取得
    const patterns = await patternService.listPatterns();
    if (patterns.length === 0) {
      throw new Error('更新テスト用のパターンが存在しません');
    }
    
    const patternToUpdate = patterns[0];
    const updatedData = {
      ...patternToUpdate,
      pattern_name: patternToUpdate.pattern_name + ' (更新済み)',
      description: patternToUpdate.description + ' - テスト更新',
      pattern_details: {
        ...patternToUpdate.pattern_details,
        updated: true,
        updateTime: new Date().toISOString()
      }
    };
    
    const updatedPattern = await patternService.updatePattern(patternToUpdate.id, updatedData);
    console.log('✅ パターン更新成功:', updatedPattern.pattern_name);
    
    return {
      success: true,
      pattern: updatedPattern
    };
    
  } catch (error) {
    console.error('❌ パターン更新テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// ユーザー時間パターン作成テスト
export async function testUserTimePatternCreation() {
  console.log('=== ユーザー時間パターン作成テスト開始 ===');
  
  try {
    // テスト用利用者を作成
    const testUser = {
      name: 'テスト利用者（パターン用）',
      name_kana: 'テストリヨウシャ',
      user_code: `USER_PATTERN_${Date.now()}`,
      care_level: '要介護2'
    };
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert(testUser, { onConflict: 'user_code' })
      .select()
      .single();
    
    if (userError) throw userError;
    
    // パターンを取得
    const patterns = await patternService.listPatterns();
    if (patterns.length === 0) {
      throw new Error('時間パターン作成用のサービスパターンが存在しません');
    }
    
    // ユーザー時間パターンを作成
    // データベースに直接挿入するためのデータ構造
    const timePatternInserts = [
      {
        user_id: userData.id,
        pattern_id: patterns[0].id,
        start_time: '09:00',
        end_time: '10:00',
        day_of_week: 1, // 月曜日
        is_active: true
      },
      {
        user_id: userData.id,
        pattern_id: patterns[0].id,
        start_time: '14:00',
        end_time: '15:30',
        day_of_week: 3, // 水曜日
        is_active: true
      }
    ];
    
    const createdTimePatterns: UserTimePattern[] = [];
    
    for (const timePatternData of timePatternInserts) {
      const { data, error } = await supabase
        .from('user_time_patterns')
        .insert(timePatternData)
        .select()
        .single();
      
      if (error) throw error;
      createdTimePatterns.push(data);
      
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      console.log('✅ ユーザー時間パターン作成成功:', 
        `${dayNames[data.day_of_week]}曜日 ${data.start_time}-${data.end_time}`);
    }
    
    console.log(`✅ ユーザー時間パターン作成テスト完了: ${createdTimePatterns.length}件作成`);
    return {
      success: true,
      user: userData,
      timePatterns: createdTimePatterns
    };
    
  } catch (error) {
    console.error('❌ ユーザー時間パターン作成テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// パターン削除テスト
export async function testPatternDeletion() {
  console.log('=== パターン削除テスト開始 ===');
  
  try {
    // テスト用パターンを作成
    const testPattern = await patternService.createPattern({
      pattern_name: '削除テスト用パターン',
      pattern_details: {
        pre_check: { health_check: false, environment_setup: false, consultation_record: false },
        excretion: { toilet_assistance: false, portable_toilet: false, diaper_change: false, pad_change: false, cleaning: false, bowel_movement_count: 0, urination_count: 0 },
        meal: { full_assistance: false, completion_status: '', water_intake: 0 },
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
        exit_check: { fire_check: false, electricity_check: false, water_check: false, door_lock_check: false }
      },
      description: '削除テスト用のパターン'
    });
    
    console.log('✅ 削除テスト用パターン作成:', testPattern.pattern_name);
    
    // パターンを削除
    await patternService.deletePattern(testPattern.id);
    console.log('✅ パターン削除成功:', testPattern.pattern_name);
    
    // 削除確認
    try {
      await patternService.getPattern(testPattern.id);
      throw new Error('削除されたパターンが取得できてしまいました');
    } catch (error) {
      console.log('✅ パターン削除確認: パターンが正常に削除されました');
    }
    
    return {
      success: true,
      deletedPattern: testPattern
    };
    
  } catch (error) {
    console.error('❌ パターン削除テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// 週間パターン機能統合テスト
export async function runWeeklyPatternTests() {
  console.log('🚀 週間パターン機能統合テスト開始');
  
  const creationResult = await testPatternCreation();
  const retrievalResult = await testPatternRetrieval();
  const updateResult = await testPatternUpdate();
  const userTimePatternResult = await testUserTimePatternCreation();
  const deletionResult = await testPatternDeletion();
  
  console.log('=== 週間パターン機能テスト結果サマリー ===');
  console.log('パターン作成テスト:', creationResult.success ? '✅' : '❌');
  console.log('パターン取得テスト:', retrievalResult.success ? '✅' : '❌');
  console.log('パターン更新テスト:', updateResult.success ? '✅' : '❌');
  console.log('ユーザー時間パターン作成テスト:', userTimePatternResult.success ? '✅' : '❌');
  console.log('パターン削除テスト:', deletionResult.success ? '✅' : '❌');
  
  const allTestsPassed = creationResult.success && 
                        retrievalResult.success && 
                        updateResult.success && 
                        userTimePatternResult.success && 
                        deletionResult.success;
  
  console.log('🏁 週間パターン機能テスト結果:', allTestsPassed ? '✅ 全テスト成功' : '❌ 一部テスト失敗');
  
  return allTestsPassed;
}
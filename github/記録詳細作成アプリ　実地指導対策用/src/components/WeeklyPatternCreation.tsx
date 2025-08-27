import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Clock, User, Calendar, Plus, CheckCircle, AlertCircle, BarChart3, Edit, Trash2, Unlink, Save, X } from 'lucide-react';
import { weeklyPatternService, GroupedTimeData, BulkRecordCreationData } from '../utils/weeklyPatternService';
import { supabase } from '../lib/supabase';

interface FilterState {
  user_name: string;
  pattern_status: 'all' | 'created' | 'pending';
}

interface BulkRecordFormData {
  pattern_name: string;
  special_notes: string;
  deposit_amount: number;
  deposit_breakdown: string;
  deposit_change: number;
  service_details: {
    pre_check: {
      health_check: boolean;
      temperature: string;
      blood_pressure: string;
      pulse: string;
      environment_setup: boolean;
      consultation_record: boolean;
    };
    excretion: {
      toilet_assistance: boolean;
      portable_toilet: boolean;
      diaper_change: boolean;
      pad_change: boolean;
      cleaning: boolean;
      bowel_movement_count: number;
      urination_count: number;
    };
    meal: {
      full_assistance: boolean;
      completion_status: string;
      remaining_amount: string;
      water_intake: number;
    };
    body_care: {
      body_wipe: string;
      full_body_bath: boolean;
      partial_bath_hand: boolean;
      partial_bath_foot: boolean;
      hair_wash: boolean;
      face_wash: boolean;
      grooming: boolean;
      oral_care: boolean;
    };
    body_grooming: {
      nail_care_hand: boolean;
      nail_care_foot: boolean;
      clothing_assistance: boolean;
    };
    transfer_movement: {
      transfer_assistance: boolean;
      movement_assistance: boolean;
      outing_assistance: boolean;
      position_change: boolean;
    };
    sleep_wake: {
      wake_assistance: boolean;
      sleep_assistance: boolean;
    };
    medication: {
      medication_assistance: boolean;
      ointment_eye_drops: boolean;
      sputum_suction: boolean;
    };
    self_support: {
      cooking_together: boolean;
      safety_monitoring: boolean;
      housework_together: boolean;
      motivation_support: boolean;
    };
    life_support: {
      cleaning: {
        room_cleaning: boolean;
        toilet_cleaning: boolean;
        table_cleaning: boolean;
        garbage_disposal: boolean;
        preparation_cleanup: boolean;
      };
      laundry: {
        washing_drying: boolean;
        folding_storage: boolean;
        ironing: boolean;
      };
      bedding: {
        sheet_change: boolean;
        cover_change: boolean;
        bed_making: boolean;
        futon_airing: boolean;
      };
      clothing: {
        organization: boolean;
        repair: boolean;
      };
      cooking: {
        general_cooking: boolean;
        serving: boolean;
        cleanup: boolean;
      };
      shopping: {
        daily_items: boolean;
        medicine_pickup: boolean;
      };
    };
    exit_check: {
      fire_check: boolean;
      electricity_check: boolean;
      water_check: boolean;
      door_lock_check: boolean;
    };
  };
}

export function WeeklyPatternCreation() {
  const [groupedData, setGroupedData] = useState<GroupedTimeData[]>([]);
  const [filteredData, setFilteredData] = useState<GroupedTimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  const [filter, setFilter] = useState<FilterState>({
    user_name: '',
    pattern_status: 'all'
  });

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedTimeData | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<BulkRecordFormData>({
    defaultValues: {
      pattern_name: '',
      special_notes: '',
      deposit_amount: 0,
      deposit_breakdown: '',
      deposit_change: 0,
      service_details: {
        pre_check: {
          health_check: false,
          temperature: '',
          blood_pressure: '',
          pulse: '',
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
          remaining_amount: '',
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
            garbage_disposal: false,
            preparation_cleanup: false,
          },
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
      },
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [groupedData, filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const groupedDataResult = await weeklyPatternService.getGroupedTimeData();
      setGroupedData(groupedDataResult);
      
      // 統計情報を計算
      const totalGroups = groupedDataResult.length;
      const createdPatterns = groupedDataResult.filter(g => g.is_pattern_created).length;
      const pendingPatterns = totalGroups - createdPatterns;
      
      setStats({
        total_groups: totalGroups,
        created_patterns: createdPatterns,
        pending_patterns: pendingPatterns
      });
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...groupedData];

    if (filter.user_name) {
      filtered = filtered.filter(g => g.user_name.includes(filter.user_name));
    }

    if (filter.pattern_status !== 'all') {
      if (filter.pattern_status === 'created') {
        filtered = filtered.filter(g => g.is_pattern_created);
      } else if (filter.pattern_status === 'pending') {
        filtered = filtered.filter(g => !g.is_pattern_created);
      }
    }

    setFilteredData(filtered);
  };

  // 利用者の健康基準値を取得してランダム値を生成
  const generateHealthCheckValues = async (userName: string) => {
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
  };

  const handleGroupClick = async (group: GroupedTimeData) => {
    if (group.is_pattern_created) {
      // 既にパターンが作成されている場合は編集モード
      alert('このグループには既にパターンが作成されています。編集機能は今後実装予定です。');
      return;
    }

    // 一括記録作成フォームを表示
    setSelectedGroup(group);
    setValue('pattern_name', group.suggested_pattern_name);
    
    // 健康チェック項目を自動で有効化し、ランダム値を設定
    setValue('service_details.pre_check.health_check', true);
    
    // 利用者の基準値に基づいてランダム値を生成
    const healthValues = await generateHealthCheckValues(group.user_name);
    setValue('service_details.pre_check.temperature', healthValues.temperature);
    setValue('service_details.pre_check.blood_pressure', healthValues.blood_pressure);
    setValue('service_details.pre_check.pulse', healthValues.pulse);
    
    setShowBulkForm(true);
  };

  const onSubmit = async (data: BulkRecordFormData) => {
    if (!selectedGroup) return;

    setSaving(true);
    try {
      // PatternDetailsの完全な構造に合わせたサービス詳細を作成
      const simplifiedServiceDetails = {
        pre_check: {
          health_check: data.service_details.pre_check.health_check,
          environment_setup: data.service_details.pre_check.environment_setup,
          consultation_record: data.service_details.pre_check.consultation_record,
        },
        excretion: {
          toilet_assistance: data.service_details.excretion.toilet_assistance,
          portable_toilet: data.service_details.excretion.portable_toilet,
          diaper_change: data.service_details.excretion.diaper_change,
          pad_change: data.service_details.excretion.pad_change,
          cleaning: data.service_details.excretion.cleaning,
          bowel_movement_count: data.service_details.excretion.bowel_movement_count,
          urination_count: data.service_details.excretion.urination_count,
        },
        meal: {
          full_assistance: data.service_details.meal.full_assistance,
          completion_status: data.service_details.meal.completion_status,
          remaining_amount: data.service_details.meal.remaining_amount,
          water_intake: data.service_details.meal.water_intake,
        },
        body_care: {
          body_wipe: data.service_details.body_care.body_wipe,
          full_body_bath: data.service_details.body_care.full_body_bath,
          partial_bath_hand: data.service_details.body_care.partial_bath_hand,
          partial_bath_foot: data.service_details.body_care.partial_bath_foot,
          hair_wash: data.service_details.body_care.hair_wash,
          face_wash: data.service_details.body_care.face_wash,
          grooming: data.service_details.body_care.grooming,
          oral_care: data.service_details.body_care.oral_care,
        },
        body_grooming: {
          nail_care_hand: data.service_details.body_grooming.nail_care_hand,
          nail_care_foot: data.service_details.body_grooming.nail_care_foot,
          clothing_assistance: data.service_details.body_grooming.clothing_assistance,
        },
        transfer_movement: {
          transfer_assistance: data.service_details.transfer_movement.transfer_assistance,
          movement_assistance: data.service_details.transfer_movement.movement_assistance,
          outing_assistance: data.service_details.transfer_movement.outing_assistance,
          position_change: data.service_details.transfer_movement.position_change,
        },
        sleep_wake: {
          wake_assistance: data.service_details.sleep_wake.wake_assistance,
          sleep_assistance: data.service_details.sleep_wake.sleep_assistance,
        },
        medication: {
          medication_assistance: data.service_details.medication.medication_assistance,
          ointment_eye_drops: data.service_details.medication.ointment_eye_drops,
          sputum_suction: data.service_details.medication.sputum_suction,
        },
        self_support: {
          cooking_together: data.service_details.self_support.cooking_together,
          safety_monitoring: data.service_details.self_support.safety_monitoring,
          housework_together: data.service_details.self_support.housework_together,
          motivation_support: data.service_details.self_support.motivation_support,
        },
        life_support: {
          cleaning: {
            room_cleaning: data.service_details.life_support.cleaning.room_cleaning,
            toilet_cleaning: data.service_details.life_support.cleaning.toilet_cleaning,
            table_cleaning: data.service_details.life_support.cleaning.table_cleaning,
          },
          garbage_disposal: data.service_details.life_support.cleaning.garbage_disposal,
          preparation_cleanup: data.service_details.life_support.cleaning.preparation_cleanup,
          laundry: {
            washing_drying: data.service_details.life_support.laundry.washing_drying,
            folding_storage: data.service_details.life_support.laundry.folding_storage,
            ironing: data.service_details.life_support.laundry.ironing,
          },
          bedding: {
            sheet_change: data.service_details.life_support.bedding.sheet_change,
            cover_change: data.service_details.life_support.bedding.cover_change,
            bed_making: data.service_details.life_support.bedding.bed_making,
            futon_airing: data.service_details.life_support.bedding.futon_airing,
          },
          clothing: {
            organization: data.service_details.life_support.clothing.organization,
            repair: data.service_details.life_support.clothing.repair,
          },
          cooking: {
            general_cooking: data.service_details.life_support.cooking.general_cooking,
            serving: data.service_details.life_support.cooking.serving,
            cleanup: data.service_details.life_support.cooking.cleanup,
          },
          shopping: {
            daily_items: data.service_details.life_support.shopping.daily_items,
            medicine_pickup: data.service_details.life_support.shopping.medicine_pickup,
          },
        },
        exit_check: {
          fire_check: data.service_details.exit_check.fire_check,
          electricity_check: data.service_details.exit_check.electricity_check,
          water_check: data.service_details.exit_check.water_check,
          door_lock_check: data.service_details.exit_check.door_lock_check,
        },
      };

      // パターンを作成・保存
      const patternId = await weeklyPatternService.createAndSavePattern(
        data.pattern_name,
        simplifiedServiceDetails,
        data.special_notes
      );

      // 全てのレコードにパターンを紐付け
      const allRecordIds = selectedGroup.all_records.map(r => r.id);
      await weeklyPatternService.linkPatternToRecords(allRecordIds, patternId);

      // パターンから実際の記録を作成（各記録にランダムな健康チェック値を含む）
      await weeklyPatternService.createServiceRecordsFromPattern(
        patternId,
        selectedGroup.all_records,
        simplifiedServiceDetails,
        data.special_notes,
        data.deposit_amount,
        data.deposit_breakdown,
        data.deposit_change
      );

      alert(`パターンを作成し、${selectedGroup.all_records.length}件の記録を作成しました`);
      setShowBulkForm(false);
      setSelectedGroup(null);
      reset();
      await loadData(); // データを再読み込み
    } catch (error) {
      console.error('一括記録作成エラー:', error);
      alert('一括記録作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkPattern = async (group: GroupedTimeData) => {
    if (!group.pattern_id) return;

    if (confirm('このグループのパターン紐付けを解除しますか？')) {
      try {
        const allRecordIds = group.all_records.map(r => r.id);
        await weeklyPatternService.unlinkPatternFromRecords(allRecordIds);
        alert('パターンの紐付けを解除しました');
        await loadData();
      } catch (error) {
        console.error('紐付け解除エラー:', error);
        alert('紐付け解除に失敗しました');
      }
    }
  };

  const handleDeletePattern = async (group: GroupedTimeData) => {
    if (!group.pattern_id) return;

    if (confirm('このパターンを削除しますか？関連する全ての紐付けも解除されます。')) {
      try {
        await weeklyPatternService.deletePattern(group.pattern_id);
        alert('パターンを削除しました');
        await loadData();
      } catch (error) {
        console.error('パターン削除エラー:', error);
        alert('パターン削除に失敗しました');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">週間パターン自動作成</h2>
          <p className="text-sm text-gray-600 mt-1">
            同じ利用者・同じ時間のデータをグループ化して一括記録作成とパターン保存を行います
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '読み込み中...' : '更新'}
          </button>
        </div>
      </div>

      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">グループ総数</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_groups}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">パターン作成済み</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.groups_with_patterns}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">パターン未作成</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.groups_without_patterns}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <User className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">総レコード数</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_records}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">利用者名</label>
            <input
              type="text"
              value={filter.user_name}
              onChange={(e) => setFilter({ ...filter, user_name: e.target.value })}
              placeholder="利用者名で検索"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パターン作成状況</label>
            <select
              value={filter.pattern_status}
              onChange={(e) => setFilter({ ...filter, pattern_status: e.target.value as 'all' | 'created' | 'pending' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">全て</option>
              <option value="pending">パターン未作成</option>
              <option value="created">作成済み</option>
            </select>
          </div>
        </div>
      </div>

      {/* グループ化データ一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            グループ化データ一覧 ({filteredData.length}件)
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">データを読み込み中...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>条件に一致するグループがありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredData.map((group) => {
              const isCreating = creating === group.id;
              
              return (
                <div key={group.id} className="p-6 hover:bg-gray-50 cursor-pointer" onClick={() => handleGroupClick(group)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{group.user_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600">{group.start_time}〜</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600">{group.count}件</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>メインサービス: {group.main_service_type}</span>
                        {group.is_pattern_created ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            パターン作成済み
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            パターン未作成
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {group.is_pattern_created ? (
                        <>
                          <button
                            onClick={() => handleUnlinkPattern(group)}
                            className="p-2 text-yellow-600 hover:text-yellow-900"
                            title="紐付け解除"
                          >
                            <Unlink className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(group)}
                            className="p-2 text-red-600 hover:text-red-900"
                            title="パターン削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGroupClick(group)}
                          disabled={isCreating}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                          {isCreating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>作成中...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              <span>一括記録作成</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 一括記録作成フォーム */}
      {showBulkForm && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                パターン作成 - {selectedGroup.user_name} ({selectedGroup.start_time})
              </h3>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
              {/* 基本情報 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4">基本情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">パターン名</label>
                    <input
                      type="text"
                      {...register('pattern_name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">対象レコード数</label>
                    <p className="text-sm text-gray-900 py-2">{selectedGroup.count}件</p>
                  </div>
                </div>
              </div>

              {/* 事前チェック */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">事前チェック</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.pre_check.health_check')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">健康チェック</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">体温:</span>
                      <input
                        type="text"
                        {...register('service_details.pre_check.temperature')}
                        placeholder="°C"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-700">°C</span>
                      <span className="text-sm text-gray-700">・血圧:</span>
                      <input
                        type="text"
                        {...register('service_details.pre_check.blood_pressure')}
                        placeholder="　　　／　　　"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-700">・脈拍:</span>
                      <input
                        type="text"
                        {...register('service_details.pre_check.pulse')}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.pre_check.environment_setup')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">環境整備</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.pre_check.consultation_record')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">相談援助、記録等</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 排泄介助 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">排泄介助</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.excretion.toilet_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">トイレ</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.excretion.portable_toilet')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">ポータブル</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.excretion.diaper_change')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">おむつ交換</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.excretion.pad_change')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">パッド交換</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.excretion.cleaning')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">洗浄・清拭</span>
                  </label>
                </div>
                <div className="mt-4 flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">排便</span>
                    <input
                      type="number"
                      {...register('service_details.excretion.bowel_movement_count', { valueAsNumber: true })}
                      min="0"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">回</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">排尿</span>
                    <input
                      type="number"
                      {...register('service_details.excretion.urination_count', { valueAsNumber: true })}
                      min="0"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">回</span>
                  </div>
                </div>
              </div>

              {/* 食事介助 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">食事介助</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.meal.full_assistance')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">全介助</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">［</span>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          {...register('service_details.meal.completion_status')}
                          value="完食"
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-1 text-sm text-gray-700">完食</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          {...register('service_details.meal.completion_status')}
                          value="残量あり"
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-1 text-sm text-gray-700">残量（</span>
                      </label>
                      <input
                        type="text"
                        {...register('service_details.meal.remaining_amount')}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-700">）］</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">水分補給（</span>
                    <input
                      type="number"
                      {...register('service_details.meal.water_intake', { valueAsNumber: true })}
                      min="0"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">cc）</span>
                  </div>
                </div>
              </div>

              {/* 身体清拭・入浴 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">身体清拭・入浴</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">清拭</span>
                    <select
                      {...register('service_details.body_care.body_wipe')}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">選択</option>
                      <option value="全身">全身</option>
                      <option value="部分">部分</option>
                    </select>
                    <span className="text-sm text-gray-700">）</span>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_care.full_body_bath')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">全身入浴</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">部分浴</span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.body_care.partial_bath_hand')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">手</span>
                    </label>
                    <span className="text-sm text-gray-700">・</span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.body_care.partial_bath_foot')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">足</span>
                    </label>
                    <span className="text-sm text-gray-700">）</span>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_care.hair_wash')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">洗髪</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_care.face_wash')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">洗面</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_care.grooming')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">整容</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_care.oral_care')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">口腔ケア</span>
                  </label>
                </div>
              </div>

              {/* 身体整容 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">身体整容</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">爪切り</span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.body_grooming.nail_care_hand')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">手</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.body_grooming.nail_care_foot')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">足</span>
                    </label>
                    <span className="text-sm text-gray-700">）</span>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.body_grooming.clothing_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">更衣介助</span>
                  </label>
                </div>
              </div>

              {/* 移乗・移動 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">移乗・移動</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.transfer_movement.transfer_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">移乗介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.transfer_movement.movement_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">移動介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.transfer_movement.outing_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">外出介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.transfer_movement.position_change')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">体位変換</span>
                  </label>
                </div>
              </div>

              {/* 起床・就寝 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">起床・就寝</h4>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.sleep_wake.wake_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">起床介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.sleep_wake.sleep_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">就寝介助</span>
                  </label>
                </div>
              </div>

              {/* 服薬・医療行為 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">服薬・医療行為</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.medication.medication_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">服薬介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.medication.ointment_eye_drops')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">軟膏・湿布・目薬</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.medication.sputum_suction')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">痰吸引</span>
                  </label>
                </div>
              </div>

              {/* 自立支援 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">自立支援</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.self_support.cooking_together')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">共に行う調理</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.self_support.safety_monitoring')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">安全の見守り</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.self_support.housework_together')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">共に行う家事</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.self_support.motivation_support')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">意欲・関心の引き出し</span>
                  </label>
                </div>
              </div>

              {/* 生活援助 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">生活援助</h4>
                
                {/* 清掃 */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">清掃</h5>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cleaning.room_cleaning')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">居宅</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cleaning.toilet_cleaning')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">トイレ</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cleaning.table_cleaning')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">卓上の掃除</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cleaning.garbage_disposal')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">ゴミ出し</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cleaning.preparation_cleanup')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">準備・後片付け</span>
                    </label>
                  </div>
                </div>

                {/* 洗濯 */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">洗濯</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.laundry.washing_drying')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">洗濯乾燥</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.laundry.folding_storage')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">取り入れ・収納</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.laundry.ironing')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">アイロン掛け</span>
                    </label>
                  </div>
                </div>

                {/* 寝具の手入れ */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">寝具の手入れ</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.bedding.sheet_change')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">シーツ交換</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.bedding.cover_change')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">カバー交換</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.bedding.bed_making')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">ベッドメイク</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.bedding.futon_airing')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">布団干し</span>
                    </label>
                  </div>
                </div>

                {/* 衣類 */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">衣類</h5>
                  <div className="grid grid-cols-2 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.clothing.organization')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">衣類の整理</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.clothing.repair')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">衣類の補修</span>
                    </label>
                  </div>
                </div>

                {/* 調理・配下膳 */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">調理・配下膳</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cooking.general_cooking')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">一般的な調理</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cooking.serving')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">配下膳</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.cooking.cleanup')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">後片付け</span>
                    </label>
                  </div>
                </div>

                {/* 買い物等 */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">買い物等</h5>
                  <div className="grid grid-cols-2 gap-3 ml-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.shopping.daily_items')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">日常品等の買い物</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('service_details.life_support.shopping.medicine_pickup')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">薬の受取り</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 退出確認 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">退出確認</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.exit_check.fire_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">火元</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.exit_check.electricity_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">電気</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.exit_check.water_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">水道</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('service_details.exit_check.door_lock_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">戸締まり</span>
                  </label>
                </div>
              </div>

              {/* 特記・連絡事項・預り金 */}
              <div className="bg-white rounded-lg border p-4">
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">特記・連絡事項・預り金</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      特記・連絡事項
                    </label>
                    <textarea
                      {...register('special_notes')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        預り金
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          {...register('deposit_amount', { valueAsNumber: true })}
                          min="0"
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-sm text-gray-700">円</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        内訳
                      </label>
                      <input
                        type="text"
                        {...register('deposit_breakdown')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        買い物お釣り
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          {...register('deposit_change', { valueAsNumber: true })}
                          min="0"
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-sm text-gray-700">円</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* 対象レコード情報 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">対象レコード ({selectedGroup.count}件)</p>
                <div className="max-h-32 overflow-y-auto">
                  {selectedGroup.sample_records.slice(0, 5).map((record, index) => (
                    <div key={index} className="text-xs text-gray-600 mb-1">
                      {record.service_date} | {record.start_time} - {record.end_time} | {record.service_content}
                    </div>
                  ))}
                  {selectedGroup.count > 5 && (
                    <div className="text-xs text-gray-500">他 {selectedGroup.count - 5} 件</div>
                  )}
                </div>
              </div>

              {/* 保存ボタン */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkForm(false);
                    reset();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <X className="h-4 w-4 mr-2 inline" />
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  {saving ? '保存中...' : 'パターン作成・紐付け'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
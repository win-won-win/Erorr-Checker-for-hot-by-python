import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ServiceRecordFormData {
  schedule_id: string;
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

interface Schedule {
  id: string;
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  service_content: string;
  special_notes: string;
  deposit_amount: number;
  deposit_breakdown: string;
  deposit_change: number;
  service_details: any;
  pattern_id: string | null;
  csv_record_id: string | null;
  service_type: string | null;
  created_at: string;
  updated_at: string;
  // 予定/記録の判定用
  is_schedule: boolean;
  record_status: 'schedule' | 'completed_record';
}

export function ServiceRecordForm() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, watch, setValue } = useForm<ServiceRecordFormData>({
    defaultValues: {
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
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    try {
      if (!isSupabaseConfigured()) {
        loadSampleData();
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('csv_service_records')
        .select(`
          *,
          service_patterns(pattern_name)
        `)
        .gte('service_date', today) // 今日以降の予定を取得
        .order('service_date')
        .order('start_time');

      if (error) {
        console.error('予定データ取得エラー:', error);
        loadSampleData();
        return;
      }

      // 予定のみをフィルタリング（記録未作成のもの）
      const scheduleData = (data || [])
        .filter(record => !record.record_created_at) // 記録未作成のもののみ
        .map(record => ({
          ...record,
          pattern_name: record.service_patterns?.pattern_name || null,
          is_schedule: !record.is_pattern_assigned || record.pattern_id === null,
          record_status: 'schedule' as const
        }));

      setSchedules(scheduleData);
    } catch (error) {
      console.error('予定データ取得エラー:', error);
      loadSampleData();
    }
  };

  const loadSampleData = () => {
    const today = new Date().toISOString().split('T')[0];
    setSchedules([
      {
        id: '1',
        user_name: '田中 花子',
        staff_name: '佐藤 太郎',
        service_date: today,
        start_time: '09:00',
        end_time: '10:00',
        duration_minutes: 60,
        service_content: '身体介護',
        special_notes: '',
        deposit_amount: 0,
        deposit_breakdown: '',
        deposit_change: 0,
        service_details: null,
        pattern_id: null,
        csv_record_id: null,
        service_type: 'schedule',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_schedule: true,
        record_status: 'schedule'
      },
      {
        id: '2',
        user_name: '山田 次郎',
        staff_name: '鈴木 美香',
        service_date: today,
        start_time: '14:00',
        end_time: '15:00',
        duration_minutes: 60,
        service_content: '生活援助',
        special_notes: '',
        deposit_amount: 0,
        deposit_breakdown: '',
        deposit_change: 0,
        service_details: null,
        pattern_id: null,
        csv_record_id: null,
        service_type: 'schedule',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_schedule: true,
        record_status: 'schedule'
      }
    ]);
  };

  const onSubmit = async (data: ServiceRecordFormData) => {
    if (!selectedSchedule) return;

    setSaving(true);
    try {
      if (!isSupabaseConfigured()) {
        console.log('記録データ:', data);
        alert('記録を保存しました（サンプルモード）');
        reset();
        setSelectedSchedule(null);
        loadScheduleData(); // 予定リストを再読み込み
        return;
      }

      // service_recordsテーブルを更新（予定から記録に変更）
      const { error } = await supabase
        .from('service_records')
        .update({
          special_notes: data.special_notes,
          deposit_amount: data.deposit_amount,
          deposit_breakdown: data.deposit_breakdown,
          deposit_change: data.deposit_change,
          service_details: data.service_details,
          service_type: 'completed_record', // 記録として更新
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSchedule.id);

      if (error) {
        throw error;
      }

      alert('記録を保存しました');
      reset();
      setSelectedSchedule(null);
      loadScheduleData(); // 予定リストを再読み込み
    } catch (error) {
      console.error('記録の保存エラー:', error);
      alert('記録の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleSelect = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setValue('schedule_id', schedule.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 予定選択 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">記録作成対象の選択</h2>
        {schedules.length === 0 ? (
          <p className="text-gray-500">記録作成可能な予定がありません</p>
        ) : (
          <div className="grid gap-3">
            {schedules.map((schedule) => (
              <button
                key={schedule.id}
                onClick={() => handleScheduleSelect(schedule)}
                className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                  selectedSchedule?.id === schedule.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{schedule.user_name}</p>
                    <p className="text-sm text-gray-500">担当: {schedule.staff_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {schedule.start_time} - {schedule.end_time}
                    </p>
                    <p className="text-sm text-gray-500">{schedule.service_content}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 記録フォーム */}
      {selectedSchedule && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本情報 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">サービス実施記録票</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">事業所</label>
                <p className="mt-1 text-sm text-gray-900">さくらケアサービス</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">お客様名</label>
                <p className="mt-1 text-sm text-gray-900">{selectedSchedule.user_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">担当者</label>
                <p className="mt-1 text-sm text-gray-900">{selectedSchedule.staff_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">サービス実施日時</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedSchedule.service_date} {selectedSchedule.start_time}-{selectedSchedule.end_time}
                </p>
              </div>
            </div>
          </div>

          {/* 事前チェック */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">事前チェック</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.pre_check.health_check')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■健康チェック</span>
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
                  <span className="ml-2 text-sm text-gray-700">□環境整備</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.pre_check.consultation_record')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□相談援助、記録等</span>
                </label>
              </div>
            </div>
          </div>

          {/* 排泄介助 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">排泄介助</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.excretion.toilet_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□トイレ</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.excretion.portable_toilet')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□ポータブル</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.excretion.diaper_change')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□おむつ交換</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.excretion.pad_change')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□パッド交換</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.excretion.cleaning')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□洗浄・清拭</span>
              </label>
            </div>
            <div className="mt-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">□排便</span>
                <input
                  type="number"
                  {...register('service_details.excretion.bowel_movement_count', { valueAsNumber: true })}
                  min="0"
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-sm text-gray-700">回</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">□排尿</span>
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
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">食事介助</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.meal.full_assistance')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■全介助</span>
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
                    <span className="ml-1 text-sm text-gray-700">□完食</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      {...register('service_details.meal.completion_status')}
                      value="残量あり"
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-1 text-sm text-gray-700">□残量（</span>
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
                <span className="text-sm text-gray-700">□水分補給（</span>
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
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">身体清拭・入浴</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">□清拭</span>
                <select
                  {...register('service_details.body_care.body_wipe')}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="">選択</option>
                  <option value="全身">□全身</option>
                  <option value="部分">□部分</option>
                </select>
                <span className="text-sm text-gray-700">）</span>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_care.full_body_bath')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□全身入浴</span>
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">■部分浴</span>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.body_care.partial_bath_hand')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-1 text-sm text-gray-700">□手</span>
                </label>
                <span className="text-sm text-gray-700">・</span>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.body_care.partial_bath_foot')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-1 text-sm text-gray-700">□足</span>
                </label>
                <span className="text-sm text-gray-700">）</span>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_care.hair_wash')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□洗髪</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_care.face_wash')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■洗面</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_care.grooming')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□整容</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_care.oral_care')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■口腔ケア</span>
              </label>
            </div>
          </div>

          {/* 身体整容 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">身体整容</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">■爪切り</span>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.body_grooming.nail_care_hand')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-1 text-sm text-gray-700">□手</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.body_grooming.nail_care_foot')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-1 text-sm text-gray-700">□足</span>
                </label>
                <span className="text-sm text-gray-700">）</span>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.body_grooming.clothing_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□更衣介助</span>
              </label>
            </div>
          </div>

          {/* 移乗・移動 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">移乗・移動</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.transfer_movement.transfer_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■移乗介助</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.transfer_movement.movement_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■移動介助</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.transfer_movement.outing_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■外出介助</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.transfer_movement.position_change')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■体位変換</span>
              </label>
            </div>
          </div>

          {/* 起床・就寝 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">起床・就寝</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.sleep_wake.wake_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■起床介助</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.sleep_wake.sleep_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□就寝介助</span>
              </label>
            </div>
          </div>

          {/* 服薬・医療行為 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">服薬・医療行為</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.medication.medication_assistance')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■服薬介助</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.medication.ointment_eye_drops')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■軟膏・湿布・目薬</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.medication.sputum_suction')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□痰吸引</span>
              </label>
            </div>
          </div>

          {/* 自立支援 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">自立支援</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.self_support.cooking_together')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■共に行う調理</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.self_support.safety_monitoring')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■安全の見守り</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.self_support.housework_together')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">■共に行う家事</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.self_support.motivation_support')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□意欲・関心の引き出し</span>
              </label>
            </div>
          </div>

          {/* 生活援助 */}
          <div className="bg-white rounded-lg shadow p-6">
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
                  <span className="ml-2 text-sm text-gray-700">□居宅</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cleaning.toilet_cleaning')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□トイレ</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cleaning.table_cleaning')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□卓上の掃除</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cleaning.garbage_disposal')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□ゴミ出し</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cleaning.preparation_cleanup')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□準備・後片付け</span>
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
                  <span className="ml-2 text-sm text-gray-700">■洗濯乾燥</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.laundry.folding_storage')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□取り入れ・収納</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.laundry.ironing')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■アイロン掛け</span>
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
                  <span className="ml-2 text-sm text-gray-700">□シーツ交換</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.bedding.cover_change')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□カバー交換</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.bedding.bed_making')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□ベッドメイク</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.bedding.futon_airing')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■布団干し</span>
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
                  <span className="ml-2 text-sm text-gray-700">□衣類の整理</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.clothing.repair')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■衣類の補修</span>
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
                  <span className="ml-2 text-sm text-gray-700">□一般的な調理</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cooking.serving')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□配下膳</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.cooking.cleanup')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">□後片付け</span>
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
                  <span className="ml-2 text-sm text-gray-700">■日常品等の買い物</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('service_details.life_support.shopping.medicine_pickup')}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">■薬の受取り</span>
                </label>
              </div>
            </div>
          </div>

          {/* 退出確認 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">退出確認</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.exit_check.fire_check')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□火元</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.exit_check.electricity_check')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□電気</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.exit_check.water_check')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□水道</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('service_details.exit_check.door_lock_check')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">□戸締まり</span>
              </label>
            </div>
          </div>

          {/* 特記事項・預り金 */}
          <div className="bg-white rounded-lg shadow p-6">
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

          {/* 保存ボタン */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => {
                setSelectedSchedule(null);
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
              {saving ? '保存中...' : '記録を保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
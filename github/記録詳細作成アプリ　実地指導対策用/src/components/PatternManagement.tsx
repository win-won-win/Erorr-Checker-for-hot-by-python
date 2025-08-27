import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Download, Upload, BarChart3, Users, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { patternService } from '../utils/patternService';
import { ServicePattern, PatternDetails } from '../types/pattern';

interface PatternFormData {
  pattern_name: string;
  description: string;
  pattern_details: {
    pre_check: {
      health_check: boolean;
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
      };
      garbage_disposal: boolean;
      preparation_cleanup: boolean;
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

interface PatternUsageStats {
  total_usage: number;
  active_usage: number;
  users: string[];
  days: number[];
}

export function PatternManagement() {
  const [patterns, setPatterns] = useState<ServicePattern[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ServicePattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [patternStats, setPatternStats] = useState<{ [key: string]: PatternUsageStats }>({});
  const [showStats, setShowStats] = useState<{ [key: string]: boolean }>({});

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PatternFormData>({
    defaultValues: {
      pattern_name: '',
      description: '',
      pattern_details: {
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
      },
    },
  });

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const patternList = await patternService.listPatterns();
      setPatterns(patternList);
      
      // 各パターンの使用統計を取得
      const stats: { [key: string]: PatternUsageStats } = {};
      for (const pattern of patternList) {
        const usage = await patternService.getPatternUsageStats(pattern.id);
        stats[pattern.id] = usage;
      }
      setPatternStats(stats);
    } catch (error) {
      console.error('パターン読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PatternFormData) => {
    setLoading(true);
    try {
      if (editingPattern) {
        await patternService.updatePattern(editingPattern.id, {
          pattern_name: data.pattern_name,
          description: data.description,
          pattern_details: data.pattern_details
        });
        alert('パターンを更新しました');
      } else {
        await patternService.createPattern({
          pattern_name: data.pattern_name,
          description: data.description,
          pattern_details: data.pattern_details
        });
        alert('パターンを作成しました');
      }

      reset();
      setShowForm(false);
      setEditingPattern(null);
      await loadPatterns(); // パターン一覧を再読み込み
    } catch (error) {
      console.error('パターン保存エラー:', error);
      alert('パターンの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pattern: ServicePattern) => {
    setEditingPattern(pattern);
    setValue('pattern_name', pattern.pattern_name);
    setValue('description', pattern.description);
    setValue('pattern_details', pattern.pattern_details);
    setShowForm(true);
  };

  const handleCopy = async (pattern: ServicePattern) => {
    try {
      await patternService.createPattern({
        pattern_name: `${pattern.pattern_name} (コピー)`,
        description: pattern.description,
        pattern_details: pattern.pattern_details
      });
      alert('パターンをコピーしました');
      await loadPatterns();
    } catch (error) {
      console.error('パターンコピーエラー:', error);
      alert('パターンのコピーに失敗しました');
    }
  };

  const handleDelete = async (patternId: string) => {
    if (confirm('このパターンを削除しますか？関連する週間スケジュールも削除されます。')) {
      try {
        await patternService.deletePattern(patternId);
        alert('パターンを削除しました');
        await loadPatterns();
      } catch (error) {
        console.error('パターン削除エラー:', error);
        alert('パターンの削除に失敗しました');
      }
    }
  };

  const toggleStats = (patternId: string) => {
    setShowStats(prev => ({
      ...prev,
      [patternId]: !prev[patternId]
    }));
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[dayOfWeek] || '';
  };

  const exportPatterns = () => {
    const dataStr = JSON.stringify(patterns, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service_patterns.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPatterns = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedPatterns = JSON.parse(e.target?.result as string);
        setPatterns(prev => [...prev, ...importedPatterns]);
        alert(`${importedPatterns.length}個のパターンをインポートしました`);
      } catch (error) {
        alert('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">パターン管理</h2>
        <div className="flex space-x-2">
          <label className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>インポート</span>
            <input
              type="file"
              accept=".json"
              onChange={importPatterns}
              className="hidden"
            />
          </label>
          <button
            onClick={exportPatterns}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>エクスポート</span>
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingPattern(null);
              reset();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>新規パターン</span>
          </button>
        </div>
      </div>

      {/* パターン一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patterns.map((pattern) => {
          const stats = patternStats[pattern.id];
          const isStatsVisible = showStats[pattern.id];
          
          return (
            <div key={pattern.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">{pattern.pattern_name}</h3>
                <div className="flex space-x-1">
                  <button
                    onClick={() => toggleStats(pattern.id)}
                    className="p-1 text-blue-600 hover:text-blue-900"
                    title="使用統計"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(pattern)}
                    className="p-1 text-indigo-600 hover:text-indigo-900"
                    title="編集"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleCopy(pattern)}
                    className="p-1 text-green-600 hover:text-green-900"
                    title="コピー"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pattern.id)}
                    className="p-1 text-red-600 hover:text-red-900"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{pattern.description}</p>
              
              {/* 使用統計情報 */}
              {stats && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">使用状況</span>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Users className="h-3 w-3" />
                      <span>{stats.users.length}名</span>
                      <Calendar className="h-3 w-3" />
                      <span>{stats.active_usage}回/週</span>
                    </div>
                  </div>
                  
                  {isStatsVisible && (
                    <div className="space-y-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">利用者:</span> {stats.users.join(', ') || 'なし'}
                      </div>
                      <div>
                        <span className="font-medium">使用曜日:</span> {stats.days.map(day => getDayName(day)).join(', ') || 'なし'}
                      </div>
                      <div>
                        <span className="font-medium">総使用回数:</span> {stats.total_usage}回
                      </div>
                      <div>
                        <span className="font-medium">有効使用回数:</span> {stats.active_usage}回
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2 text-xs text-gray-500">
                <div>作成日: {new Date(pattern.created_at).toLocaleDateString('ja-JP')}</div>
                <div>更新日: {new Date(pattern.updated_at).toLocaleDateString('ja-JP')}</div>
              </div>
            </div>
          );
        })}
        </div>

        {/* パターン作成・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPattern ? 'パターン編集' : '新規パターン作成'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
              {/* 基本情報 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パターン名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('pattern_name', { required: 'パターン名を入力してください' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.pattern_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.pattern_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <input
                    type="text"
                    {...register('description')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 事前チェック */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">事前チェック</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.pre_check.health_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">健康チェック</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.pre_check.environment_setup')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">環境整備</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.pre_check.consultation_record')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">相談援助・記録等</span>
                  </label>
                </div>
              </div>

              {/* 排泄介助 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">排泄介助</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.excretion.toilet_assistance')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">トイレ介助</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.excretion.portable_toilet')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">ポータブルトイレ</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.excretion.diaper_change')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">おむつ交換</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.excretion.pad_change')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">パッド交換</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.excretion.cleaning')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">洗浄・清拭</span>
                  </label>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">排便回数:</span>
                    <input
                      type="number"
                      {...register('pattern_details.excretion.bowel_movement_count', { valueAsNumber: true })}
                      min="0"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">回</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">排尿回数:</span>
                    <input
                      type="number"
                      {...register('pattern_details.excretion.urination_count', { valueAsNumber: true })}
                      min="0"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">回</span>
                  </div>
                </div>
              </div>

              {/* 食事介助 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">食事介助</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('pattern_details.meal.full_assistance')}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">全介助</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">完食状況:</span>
                      <select
                        {...register('pattern_details.meal.completion_status')}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">選択</option>
                        <option value="完食">完食</option>
                        <option value="残量あり">残量あり</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">水分補給:</span>
                    <input
                      type="number"
                      {...register('pattern_details.meal.water_intake', { valueAsNumber: true })}
                      min="0"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm text-gray-700">cc</span>
                  </div>
                </div>
              </div>

              {/* 退出確認 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-900 mb-3">退出確認</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.exit_check.fire_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">火元チェック</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.exit_check.electricity_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">電気チェック</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.exit_check.water_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">水道チェック</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('pattern_details.exit_check.door_lock_check')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">戸締まりチェック</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPattern(null);
                    reset();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? '保存中...' : (editingPattern ? '更新' : '作成')}
                </button>
              </div>
            </form>
          </div>
        </div>
        )}
    </div>
  );
}
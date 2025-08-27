import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, Plus, Edit, Trash2, Clock, User } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

interface User {
  id: string;
  name: string;
  user_code: string;
}

interface Staff {
  id: string;
  name: string;
  staff_code: string;
}

interface ScheduleFormData {
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  service_type: string;
  service_content: string;
}

export function ScheduleManagement() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ScheduleFormData>();

  useEffect(() => {
    loadScheduleData();
    loadUsersAndStaff();
  }, [currentWeek]);

  const loadScheduleData = async () => {
    try {
      if (!isSupabaseConfigured()) {
        loadSampleData();
        return;
      }

      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('csv_service_records')
        .select(`
          *,
          service_patterns(pattern_name)
        `)
        .gte('service_date', startDate)
        .lte('service_date', endDate)
        .order('service_date')
        .order('start_time');

      if (error) {
        console.error('予定データ取得エラー:', error);
        loadSampleData();
        return;
      }

      // 予定と記録を区別するロジックを追加
      const processedSchedules = (data || []).map(record => {
        // csv_service_recordsテーブルの場合の判定ロジック
        const isSchedule = !record.is_pattern_assigned || record.pattern_id === null;
        
        return {
          ...record,
          pattern_name: record.service_patterns?.pattern_name || null,
          is_schedule: isSchedule,
          record_status: isSchedule ? 'schedule' : 'completed_record'
        };
      });

      setSchedules(processedSchedules);
    } catch (error) {
      console.error('予定データ取得エラー:', error);
      loadSampleData();
    }
  };

  const loadUsersAndStaff = async () => {
    // 現在user_staff_mastersテーブルが存在しないため、サンプルデータを使用
    const sampleUsers: User[] = [
      { id: '1', name: '田中 花子', user_code: '2500142318' },
      { id: '2', name: '山田 次郎', user_code: '2204435116' },
      { id: '3', name: '佐藤 美香', user_code: '2208296785' },
      { id: '4', name: '鈴木 太郎', user_code: '2301234567' },
    ];

    const sampleStaff: Staff[] = [
      { id: '1', name: '渡邉 由可里', staff_code: '1700057072' },
      { id: '2', name: '笠間 京子', staff_code: '1800058073' },
      { id: '3', name: '佐藤 太郎', staff_code: '1900059074' },
      { id: '4', name: '鈴木 美香', staff_code: '2000060075' },
    ];

    setUsers(sampleUsers);
    setStaff(sampleStaff);
  };

  const loadSampleData = () => {
    const today = new Date();
    const sampleSchedules: Schedule[] = [
      {
        id: '1',
        user_name: '田中 花子',
        staff_name: '渡邉 由可里',
        service_date: format(today, 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        duration_minutes: 60,
        service_content: '排泄介助・食事介助',
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
        staff_name: '笠間 京子',
        service_date: format(today, 'yyyy-MM-dd'),
        start_time: '14:00',
        end_time: '15:00',
        duration_minutes: 60,
        service_content: '清掃・洗濯',
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
        id: '3',
        user_name: '佐藤 美香',
        staff_name: '渡邉 由可里',
        service_date: format(addDays(today, 1), 'yyyy-MM-dd'),
        start_time: '10:30',
        end_time: '11:30',
        duration_minutes: 60,
        service_content: '入浴介助',
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
    ];

    setSchedules(sampleSchedules);
  };

  const onSubmit = async (data: ScheduleFormData) => {
    setLoading(true);
    try {
      const newSchedule: Schedule = {
        id: editingSchedule ? editingSchedule.id : Date.now().toString(),
        user_name: data.user_name,
        staff_name: data.staff_name,
        service_date: data.service_date,
        start_time: data.start_time,
        end_time: data.end_time,
        duration_minutes: 60, // デフォルト値
        service_content: data.service_content,
        special_notes: '',
        deposit_amount: 0,
        deposit_breakdown: '',
        deposit_change: 0,
        service_details: null,
        pattern_id: null,
        csv_record_id: null,
        service_type: data.service_type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_schedule: true,
        record_status: 'schedule'
      };

      if (editingSchedule) {
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? newSchedule : s));
      } else {
        setSchedules(prev => [...prev, newSchedule]);
      }

      reset();
      setShowForm(false);
      setEditingSchedule(null);
      alert(editingSchedule ? '予定を更新しました' : '予定を作成しました');
    } catch (error) {
      console.error('予定保存エラー:', error);
      alert('予定の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setValue('user_name', schedule.user_name);
    setValue('staff_name', schedule.staff_name);
    setValue('service_date', schedule.service_date);
    setValue('start_time', schedule.start_time);
    setValue('end_time', schedule.end_time);
    setValue('service_type', schedule.service_type || '');
    setValue('service_content', schedule.service_content);
    setShowForm(true);
  };

  const handleDelete = (scheduleId: string) => {
    if (confirm('この予定を削除しますか？')) {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      alert('予定を削除しました');
    }
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getSchedulesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.filter(s => s.service_date === dateStr);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">予定管理</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingSchedule(null);
            reset();
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>新規予定</span>
        </button>
      </div>

      {/* 週間カレンダー */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              {format(weekStart, 'yyyy年MM月dd日', { locale: ja })} - {format(weekEnd, 'MM月dd日', { locale: ja })}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                前週
              </button>
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                今週
              </button>
              <button
                onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                次週
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {weekDays.map((day) => {
            const daySchedules = getSchedulesForDate(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <div key={day.toISOString()} className="bg-white min-h-32">
                <div className={`p-2 text-center border-b ${isToday ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}>
                  <div className="text-sm">{format(day, 'E', { locale: ja })}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                </div>
                <div className="p-2 space-y-1">
                  {daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-1 rounded text-xs cursor-pointer ${
                        schedule.is_schedule
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                      onClick={() => handleEdit(schedule)}
                    >
                      <div className="font-medium">{schedule.start_time}-{schedule.end_time}</div>
                      <div className="truncate">{schedule.user_name}</div>
                      <div className="truncate">{schedule.staff_name}</div>
                      <div className="text-xs">
                        {schedule.is_schedule ? '予定' : '記録'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 予定一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">予定一覧</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {schedules.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              予定がありません
            </div>
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {schedule.user_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(schedule.service_date), 'yyyy年MM月dd日(E)', { locale: ja })}
                        {' '}{schedule.start_time}-{schedule.end_time}
                      </p>
                      <p className="text-sm text-gray-500">
                        担当: {schedule.staff_name} | {schedule.service_type}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        schedule.is_schedule
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {schedule.is_schedule ? '予定' : '記録'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-1 text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-1 text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 予定作成・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingSchedule ? '予定編集' : '新規予定作成'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  利用者 <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('user_name', { required: '利用者を選択してください' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">選択してください</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name} ({user.user_code})
                    </option>
                  ))}
                </select>
                {errors.user_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.user_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当職員 <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('staff_name', { required: '担当職員を選択してください' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">選択してください</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.staff_code})
                    </option>
                  ))}
                </select>
                {errors.staff_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.staff_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サービス日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register('service_date', { required: 'サービス日を選択してください' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.service_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.service_date.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    {...register('start_time', { required: '開始時間を入力してください' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    {...register('end_time', { required: '終了時間を入力してください' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サービス種類 <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('service_type', { required: 'サービス種類を選択してください' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">選択してください</option>
                  <option value="身体介護">身体介護</option>
                  <option value="生活援助">生活援助</option>
                  <option value="通院介助">通院介助</option>
                  <option value="その他">その他</option>
                </select>
                {errors.service_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.service_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サービス内容
                </label>
                <input
                  type="text"
                  {...register('service_content')}
                  placeholder="例: 排泄介助・食事介助"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSchedule(null);
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
                  {loading ? '保存中...' : (editingSchedule ? '更新' : '作成')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
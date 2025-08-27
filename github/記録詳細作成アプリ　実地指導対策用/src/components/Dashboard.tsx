import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Users, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface DashboardStats {
  todaySchedules: number;
  todayRecords: number;
  totalUsers: number;
  totalStaff: number;
  unprintedRecords: number;
}

interface TodaySchedule {
  id: string;
  user_name: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  service_type: string;
  has_record: boolean;
}

interface UnprintedRecord {
  id: string;
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  service_type: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySchedules: 0,
    todayRecords: 0,
    totalUsers: 0,
    totalStaff: 0,
    unprintedRecords: 0
  });
  const [todaySchedules, setTodaySchedules] = useState<TodaySchedule[]>([]);
  const [unprintedRecords, setUnprintedRecords] = useState<UnprintedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!isSupabaseConfigured()) {
        // サンプルデータを表示
        setStats({
          todaySchedules: 3,
          todayRecords: 1,
          totalUsers: 15,
          totalStaff: 8,
          unprintedRecords: 2
        });
        setTodaySchedules([
          {
            id: '1',
            user_name: '田中 花子',
            staff_name: '佐藤 太郎',
            start_time: '09:00',
            end_time: '10:00',
            service_type: '身体介護',
            has_record: true
          },
          {
            id: '2',
            user_name: '山田 次郎',
            staff_name: '鈴木 美香',
            start_time: '14:00',
            end_time: '15:00',
            service_type: '生活援助',
            has_record: false
          }
        ]);
        setUnprintedRecords([
          {
            id: '3',
            user_name: '佐藤 一郎',
            staff_name: '田中 花子',
            service_date: '2024-08-26',
            start_time: '10:00',
            end_time: '11:00',
            service_type: '身体介護'
          },
          {
            id: '4',
            user_name: '鈴木 三郎',
            staff_name: '山田 太郎',
            service_date: '2024-08-25',
            start_time: '15:00',
            end_time: '16:00',
            service_type: '生活援助'
          }
        ]);
        setLoading(false);
        return;
      }

      // 実際のデータベースからデータを取得
      const today = new Date().toISOString().split('T')[0];
      
      // 統計データの取得
      const [
        { count: todayRecordsCount },
        { count: totalUsersCount },
        { count: totalStaffCount },
        { count: unprintedCount }
      ] = await Promise.all([
        supabase.from('csv_service_records').select('*', { count: 'exact', head: true }).eq('service_date', today),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        supabase.from('service_records').select('*', { count: 'exact', head: true }).is('print_datetime', null)
      ]);

      setStats({
        todaySchedules: todayRecordsCount || 0,
        todayRecords: todayRecordsCount || 0,
        totalUsers: totalUsersCount || 0,
        totalStaff: totalStaffCount || 0,
        unprintedRecords: unprintedCount || 0
      });

      // 本日のサービス記録データの取得
      const { data: records } = await supabase
        .from('csv_service_records')
        .select(`
          id,
          user_name,
          staff_name,
          start_time,
          end_time,
          service_content
        `)
        .eq('service_date', today)
        .order('start_time');

      const todayScheduleData = records?.map(record => ({
        id: record.id,
        user_name: record.user_name,
        staff_name: record.staff_name,
        start_time: record.start_time,
        end_time: record.end_time,
        service_type: record.service_content,
        has_record: true
      })) || [];

      setTodaySchedules(todayScheduleData);

      // 未印刷記録の取得
      const { data: unprintedData } = await supabase
        .from('service_records')
        .select(`
          id,
          user_name,
          staff_name,
          service_date,
          start_time,
          end_time,
          service_type
        `)
        .is('print_datetime', null)
        .order('service_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(10);

      const unprintedRecordsData = unprintedData?.map(record => ({
        id: record.id,
        user_name: record.user_name,
        staff_name: record.staff_name,
        service_date: record.service_date,
        start_time: record.start_time,
        end_time: record.end_time,
        service_type: record.service_type
      })) || [];

      setUnprintedRecords(unprintedRecordsData);
    } catch (error) {
      console.error('ダッシュボードデータ取得エラー:', error);
      // サンプルデータを表示
      setStats({
        todaySchedules: 3,
        todayRecords: 1,
        totalUsers: 15,
        totalStaff: 8,
        unprintedRecords: 2
      });
      setTodaySchedules([
        {
          id: '1',
          user_name: '田中 花子',
          staff_name: '佐藤 太郎',
          start_time: '09:00',
          end_time: '10:00',
          service_type: '身体介護',
          has_record: true
        },
        {
          id: '2',
          user_name: '山田 次郎',
          staff_name: '鈴木 美香',
          start_time: '14:00',
          end_time: '15:00',
          service_type: '生活援助',
          has_record: false
        }
      ]);
      setTodaySchedules([]);
      setUnprintedRecords([]);
    } finally {
      setLoading(false);
    }
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
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">本日の予定</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todaySchedules}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">本日の記録</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayRecords}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">利用者数</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">職員数</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalStaff}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 未印刷記録の統計カード */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">未印刷記録</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.unprintedRecords}</p>
          </div>
        </div>
      </div>

      {/* 未印刷記録一覧 */}
      {unprintedRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
              未印刷記録 (最新10件)
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {unprintedRecords.map((record) => (
              <div key={record.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {record.user_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        担当: {record.staff_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(record.service_date), 'MM/dd(E)', { locale: ja })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {record.start_time} - {record.end_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {record.service_type}
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      未印刷
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 本日の予定一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            本日の予定 ({format(new Date(), 'yyyy年MM月dd日(E)', { locale: ja })})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {todaySchedules.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              本日の予定はありません
            </div>
          ) : (
            todaySchedules.map((schedule) => (
              <div key={schedule.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${
                        schedule.has_record ? 'bg-green-400' : 'bg-yellow-400'
                      }`}></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {schedule.user_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        担当: {schedule.staff_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {schedule.start_time} - {schedule.end_time}
                    </p>
                    <p className="text-sm text-gray-500">
                      {schedule.service_type}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      schedule.has_record
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {schedule.has_record ? '記録済み' : '未記録'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
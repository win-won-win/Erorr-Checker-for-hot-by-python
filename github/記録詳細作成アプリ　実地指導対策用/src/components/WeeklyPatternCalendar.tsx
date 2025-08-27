import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Settings, Plus, Edit, Copy, Trash2, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { patternService } from '../utils/patternService';
import { ServicePattern, UserTimePattern } from '../types/pattern';

interface User {
  id: string;
  name: string;
}

interface WeeklyScheduleData {
  [key: string]: UserTimePattern[]; // key: "userId_dayOfWeek"
}

export function WeeklyPatternCalendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleData>({});
  const [users, setUsers] = useState<User[]>([]);
  const [patterns, setPatterns] = useState<ServicePattern[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPattern, setEditingPattern] = useState<UserTimePattern | null>(null);
  const [loading, setLoading] = useState(true);

  // 新規パターン追加用の状態
  const [newPattern, setNewPattern] = useState({
    user_id: '',
    pattern_id: '',
    start_time: '09:00',
    end_time: '10:00',
    day_of_week: 1,
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        // パターンサービスからデータを取得
        await loadDataFromPatternService();
        return;
      }

      // 実際のデータベースからデータを取得
      const [usersResult, patternsResult, scheduleResult] = await Promise.all([
        supabase.from('users').select('id, name').order('name'),
        supabase.from('service_patterns').select('*').order('pattern_name'),
        supabase.from('user_time_patterns').select(`
          *,
          users!inner(name),
          service_patterns!inner(pattern_name, pattern_details)
        `).eq('is_active', true)
      ]);

      if (usersResult.data) setUsers(usersResult.data);
      if (patternsResult.data) setPatterns(patternsResult.data);
      
      if (scheduleResult.data) {
        const scheduleData: WeeklyScheduleData = {};
        scheduleResult.data.forEach((item: any) => {
          const key = `${item.user_id}_${item.day_of_week}`;
          if (!scheduleData[key]) scheduleData[key] = [];
          scheduleData[key].push({
            id: item.id,
            user_id: item.user_id,
            user_name: item.users.name,
            pattern_id: item.pattern_id,
            pattern_name: item.service_patterns.pattern_name,
            start_time: item.start_time,
            end_time: item.end_time,
            day_of_week: item.day_of_week,
            is_active: item.is_active,
            pattern_details: item.service_patterns.pattern_details,
            created_at: item.created_at,
            updated_at: item.updated_at
          });
        });
        setWeeklySchedule(scheduleData);
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      await loadDataFromPatternService();
    } finally {
      setLoading(false);
    }
  };

  const loadDataFromPatternService = async () => {
    try {
      // パターンサービスからデータを取得
      const [patternList, scheduleData] = await Promise.all([
        patternService.listPatterns(),
        patternService.getWeeklyScheduleData()
      ]);

      setPatterns(patternList);
      setWeeklySchedule(scheduleData);

      // サンプル利用者データ
      const sampleUsers: User[] = [
        { id: '1', name: '田中 花子' },
        { id: '2', name: '山田 次郎' },
        { id: '3', name: '佐藤 美香' },
        { id: '4', name: '鈴木 太郎' }
      ];
      setUsers(sampleUsers);
    } catch (error) {
      console.error('パターンサービスからのデータ読み込みエラー:', error);
      loadSampleData();
    }
  };

  const loadSampleData = () => {
    // パターンサービスからデータを取得するため、この関数は使用しない
    setLoading(false);
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getScheduleForUserAndDay = (userId: string, dayOfWeek: number): UserTimePattern[] => {
    const key = `${userId}_${dayOfWeek}`;
    return weeklySchedule[key] || [];
  };

  const getFilteredUsers = () => {
    if (!selectedUser) return users;
    return users.filter(user => user.id === selectedUser);
  };

  const handleAddPattern = async () => {
    try {
      const selectedPattern = patterns.find(p => p.id === newPattern.pattern_id);
      const selectedUserData = users.find(u => u.id === newPattern.user_id);
      
      if (!selectedPattern || !selectedUserData) {
        alert('パターンまたは利用者が選択されていません');
        return;
      }

      if (editingPattern) {
        // 編集モード
        await patternService.updateUserTimePattern(editingPattern.id, {
          user_id: newPattern.user_id,
          user_name: selectedUserData.name,
          pattern_id: newPattern.pattern_id,
          start_time: newPattern.start_time,
          end_time: newPattern.end_time,
          day_of_week: newPattern.day_of_week,
          is_active: newPattern.is_active
        });
        alert('パターンを更新しました');
      } else {
        // 新規作成モード
        await patternService.createUserTimePattern({
          user_id: newPattern.user_id,
          user_name: selectedUserData.name,
          pattern_id: newPattern.pattern_id,
          pattern_name: selectedPattern.pattern_name,
          start_time: newPattern.start_time,
          end_time: newPattern.end_time,
          day_of_week: newPattern.day_of_week,
          is_active: newPattern.is_active,
          pattern_details: selectedPattern.pattern_details
        });
        alert('パターンを追加しました');
      }

      // フォームをリセット
      setNewPattern({
        user_id: '',
        pattern_id: '',
        start_time: '09:00',
        end_time: '10:00',
        day_of_week: 1,
        is_active: true
      });
      setShowAddModal(false);
      setEditingPattern(null);
      
      // データを再読み込み
      await loadData();
    } catch (error) {
      console.error('パターン操作エラー:', error);
      alert('パターンの操作に失敗しました');
    }
  };

  const handleEditPattern = (pattern: UserTimePattern) => {
    setEditingPattern(pattern);
    setNewPattern({
      user_id: pattern.user_id,
      pattern_id: pattern.pattern_id,
      start_time: pattern.start_time,
      end_time: pattern.end_time,
      day_of_week: pattern.day_of_week,
      is_active: pattern.is_active
    });
    setShowAddModal(true);
  };

  const handleCopyPattern = (pattern: UserTimePattern) => {
    setEditingPattern(null); // コピーモードなので編集パターンはクリア
    setNewPattern({
      user_id: pattern.user_id,
      pattern_id: pattern.pattern_id,
      start_time: pattern.start_time,
      end_time: pattern.end_time,
      day_of_week: pattern.day_of_week,
      is_active: pattern.is_active
    });
    setShowAddModal(true);
  };

  const handleDeletePattern = async (patternId: string) => {
    if (confirm('このパターンを削除しますか？')) {
      try {
        await patternService.deleteUserTimePattern(patternId);
        alert('パターンを削除しました');
        await loadData(); // データを再読み込み
      } catch (error) {
        console.error('パターン削除エラー:', error);
        alert('パターンの削除に失敗しました');
      }
    }
  };

  const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Calendar className="h-6 w-6 mr-2" />
          週間パターンカレンダー
        </h2>
        <div className="flex items-center space-x-4">
          {/* 利用者フィルター */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">全利用者</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>パターン追加</span>
          </button>
        </div>
      </div>

      {/* 週間ナビゲーション */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            {format(weekStart, 'yyyy年MM月dd日', { locale: ja })} - {format(weekEnd, 'MM月dd日', { locale: ja })}
          </h3>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 週間カレンダー */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-8 gap-px bg-gray-200">
          {/* ヘッダー行 */}
          <div className="bg-gray-50 p-3 text-center font-medium text-gray-700">
            利用者
          </div>
          {weekDays.map((day, index) => (
            <div key={day.toISOString()} className="bg-gray-50 p-3 text-center">
              <div className="font-medium text-gray-700">
                {dayNames[index]}
              </div>
              <div className="text-sm text-gray-500">
                {format(day, 'MM/dd')}
              </div>
            </div>
          ))}

          {/* 利用者行 */}
          {getFilteredUsers().map((user) => (
            <React.Fragment key={user.id}>
              <div className="bg-white p-3 border-r border-gray-200 font-medium text-gray-900 flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-400" />
                {user.name}
              </div>
              {weekDays.map((day, dayIndex) => {
                const dayOfWeek = dayIndex + 1; // 月曜日=1, 火曜日=2, ...
                const dayPatterns = getScheduleForUserAndDay(user.id, dayOfWeek);
                
                return (
                  <div key={`${user.id}_${dayIndex}`} className="bg-white p-2 min-h-24 border-r border-gray-200">
                    <div className="space-y-1">
                      {dayPatterns.map((pattern) => (
                        <div
                          key={pattern.id}
                          className="bg-indigo-100 text-indigo-800 p-2 rounded text-xs cursor-pointer hover:bg-indigo-200 group relative"
                        >
                          <div className="font-medium flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {pattern.start_time}-{pattern.end_time}
                          </div>
                          <div className="truncate">{pattern.pattern_name}</div>
                          
                          {/* アクションボタン */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex space-x-1">
                            <button
                              onClick={() => handleEditPattern(pattern)}
                              className="p-1 bg-white rounded shadow hover:bg-gray-50"
                              title="編集"
                            >
                              <Edit className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleCopyPattern(pattern)}
                              className="p-1 bg-white rounded shadow hover:bg-gray-50"
                              title="コピー"
                            >
                              <Copy className="h-3 w-3 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleDeletePattern(pattern.id)}
                              className="p-1 bg-white rounded shadow hover:bg-gray-50"
                              title="削除"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* パターン追加・編集モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPattern ? 'パターン編集' : 'パターン追加'}
              </h3>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  利用者 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newPattern.user_id}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">選択してください</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パターン <span className="text-red-500">*</span>
                </label>
                <select
                  value={newPattern.pattern_id}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, pattern_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">選択してください</option>
                  {patterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.pattern_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  曜日 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newPattern.day_of_week}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value={1}>月曜日</option>
                  <option value={2}>火曜日</option>
                  <option value={3}>水曜日</option>
                  <option value={4}>木曜日</option>
                  <option value={5}>金曜日</option>
                  <option value={6}>土曜日</option>
                  <option value={0}>日曜日</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newPattern.start_time}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newPattern.end_time}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newPattern.is_active}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">有効</span>
                </label>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPattern(null);
                  setNewPattern({
                    user_id: '',
                    pattern_id: '',
                    start_time: '09:00',
                    end_time: '10:00',
                    day_of_week: 1,
                    is_active: true
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddPattern}
                className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingPattern ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
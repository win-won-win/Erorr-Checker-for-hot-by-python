import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Save, Edit, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserHealthBaseline {
  id: string;
  name: string;
  normalized_name: string;
  temperature_min: number;
  temperature_max: number;
  blood_pressure_systolic_min: number;
  blood_pressure_systolic_max: number;
  blood_pressure_diastolic_min: number;
  blood_pressure_diastolic_max: number;
  pulse_min: number;
  pulse_max: number;
  created_at: string;
  updated_at: string;
}

interface HealthBaselineFormData {
  name: string;
  temperature_min: number;
  temperature_max: number;
  blood_pressure_systolic_min: number;
  blood_pressure_systolic_max: number;
  blood_pressure_diastolic_min: number;
  blood_pressure_diastolic_max: number;
  pulse_min: number;
  pulse_max: number;
}

export default function UserHealthBaselines() {
  const [users, setUsers] = useState<UserHealthBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserHealthBaseline | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<HealthBaselineFormData>({
    defaultValues: {
      name: '',
      temperature_min: 36.0,
      temperature_max: 37.5,
      blood_pressure_systolic_min: 100,
      blood_pressure_systolic_max: 140,
      blood_pressure_diastolic_min: 60,
      blood_pressure_diastolic_max: 90,
      pulse_min: 60,
      pulse_max: 100,
    }
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users_master')
        .select('*')
        .order('name');

      if (error) {
        console.error('利用者マスタ取得エラー:', error);
        alert('利用者データの取得に失敗しました');
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('利用者マスタ取得エラー:', error);
      alert('利用者データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserHealthBaseline) => {
    setEditingUser(user);
    setValue('name', user.name);
    setValue('temperature_min', user.temperature_min);
    setValue('temperature_max', user.temperature_max);
    setValue('blood_pressure_systolic_min', user.blood_pressure_systolic_min);
    setValue('blood_pressure_systolic_max', user.blood_pressure_systolic_max);
    setValue('blood_pressure_diastolic_min', user.blood_pressure_diastolic_min);
    setValue('blood_pressure_diastolic_max', user.blood_pressure_diastolic_max);
    setValue('pulse_min', user.pulse_min);
    setValue('pulse_max', user.pulse_max);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    reset();
    setShowForm(true);
  };

  const onSubmit = async (data: HealthBaselineFormData) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      
      if (editingUser) {
        // 更新
        const { error } = await supabase
          .from('users_master')
          .update({
            name: data.name,
            temperature_min: data.temperature_min,
            temperature_max: data.temperature_max,
            blood_pressure_systolic_min: data.blood_pressure_systolic_min,
            blood_pressure_systolic_max: data.blood_pressure_systolic_max,
            blood_pressure_diastolic_min: data.blood_pressure_diastolic_min,
            blood_pressure_diastolic_max: data.blood_pressure_diastolic_max,
            pulse_min: data.pulse_min,
            pulse_max: data.pulse_max,
            updated_at: now,
          })
          .eq('id', editingUser.id);

        if (error) {
          console.error('利用者更新エラー:', error);
          alert('利用者の更新に失敗しました');
          return;
        }

        alert('利用者の基準値を更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('users_master')
          .insert({
            name: data.name,
            normalized_name: data.name, // 簡易的な正規化
            temperature_min: data.temperature_min,
            temperature_max: data.temperature_max,
            blood_pressure_systolic_min: data.blood_pressure_systolic_min,
            blood_pressure_systolic_max: data.blood_pressure_systolic_max,
            blood_pressure_diastolic_min: data.blood_pressure_diastolic_min,
            blood_pressure_diastolic_max: data.blood_pressure_diastolic_max,
            pulse_min: data.pulse_min,
            pulse_max: data.pulse_max,
            created_at: now,
            updated_at: now,
          });

        if (error) {
          console.error('利用者作成エラー:', error);
          alert('利用者の作成に失敗しました');
          return;
        }

        alert('新しい利用者を作成しました');
      }

      setShowForm(false);
      setEditingUser(null);
      reset();
      await loadUsers();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUser(null);
    reset();
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">利用者健康基準値管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            利用者ごとの健康チェック項目の基準値を設定・管理します
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>新規追加</span>
        </button>
      </div>

      {/* 検索 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">利用者名検索</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="利用者名で検索"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 利用者一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            利用者一覧 ({filteredUsers.length}件)
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">データを読み込み中...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>利用者が見つかりません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    利用者名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    体温範囲 (°C)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    血圧範囲 (mmHg)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    脈拍範囲 (bpm)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.temperature_min}°C - {user.temperature_max}°C
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.blood_pressure_systolic_min}-{user.blood_pressure_diastolic_min} / {user.blood_pressure_systolic_max}-{user.blood_pressure_diastolic_max}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.pulse_min} - {user.pulse_max}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center space-x-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span>編集</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* フォームモーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? '基準値編集' : '新規利用者追加'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 利用者名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  利用者名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('name', { required: '利用者名は必須です' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* 体温範囲 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    体温最小値 (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="35.0"
                    max="40.0"
                    {...register('temperature_min', { 
                      required: '体温最小値は必須です',
                      min: { value: 35.0, message: '35.0°C以上で入力してください' },
                      max: { value: 40.0, message: '40.0°C以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.temperature_min && (
                    <p className="mt-1 text-sm text-red-600">{errors.temperature_min.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    体温最大値 (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="35.0"
                    max="40.0"
                    {...register('temperature_max', { 
                      required: '体温最大値は必須です',
                      min: { value: 35.0, message: '35.0°C以上で入力してください' },
                      max: { value: 40.0, message: '40.0°C以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.temperature_max && (
                    <p className="mt-1 text-sm text-red-600">{errors.temperature_max.message}</p>
                  )}
                </div>
              </div>

              {/* 血圧範囲 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    収縮期血圧最小値 (mmHg)
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="200"
                    {...register('blood_pressure_systolic_min', { 
                      required: '収縮期血圧最小値は必須です',
                      min: { value: 80, message: '80mmHg以上で入力してください' },
                      max: { value: 200, message: '200mmHg以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.blood_pressure_systolic_min && (
                    <p className="mt-1 text-sm text-red-600">{errors.blood_pressure_systolic_min.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    収縮期血圧最大値 (mmHg)
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="200"
                    {...register('blood_pressure_systolic_max', { 
                      required: '収縮期血圧最大値は必須です',
                      min: { value: 80, message: '80mmHg以上で入力してください' },
                      max: { value: 200, message: '200mmHg以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.blood_pressure_systolic_max && (
                    <p className="mt-1 text-sm text-red-600">{errors.blood_pressure_systolic_max.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    拡張期血圧最小値 (mmHg)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="120"
                    {...register('blood_pressure_diastolic_min', { 
                      required: '拡張期血圧最小値は必須です',
                      min: { value: 40, message: '40mmHg以上で入力してください' },
                      max: { value: 120, message: '120mmHg以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.blood_pressure_diastolic_min && (
                    <p className="mt-1 text-sm text-red-600">{errors.blood_pressure_diastolic_min.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    拡張期血圧最大値 (mmHg)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="120"
                    {...register('blood_pressure_diastolic_max', { 
                      required: '拡張期血圧最大値は必須です',
                      min: { value: 40, message: '40mmHg以上で入力してください' },
                      max: { value: 120, message: '120mmHg以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.blood_pressure_diastolic_max && (
                    <p className="mt-1 text-sm text-red-600">{errors.blood_pressure_diastolic_max.message}</p>
                  )}
                </div>
              </div>

              {/* 脈拍範囲 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    脈拍最小値 (bpm)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="150"
                    {...register('pulse_min', { 
                      required: '脈拍最小値は必須です',
                      min: { value: 40, message: '40bpm以上で入力してください' },
                      max: { value: 150, message: '150bpm以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.pulse_min && (
                    <p className="mt-1 text-sm text-red-600">{errors.pulse_min.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    脈拍最大値 (bpm)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="150"
                    {...register('pulse_max', { 
                      required: '脈拍最大値は必須です',
                      min: { value: 40, message: '40bpm以上で入力してください' },
                      max: { value: 150, message: '150bpm以下で入力してください' }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.pulse_max && (
                    <p className="mt-1 text-sm text-red-600">{errors.pulse_max.message}</p>
                  )}
                </div>
              </div>

              {/* ボタン */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? '保存中...' : '保存'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
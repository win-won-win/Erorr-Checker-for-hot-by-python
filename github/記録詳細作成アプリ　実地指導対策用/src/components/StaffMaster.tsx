import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Save, Edit, Plus, X, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StaffMaster {
  id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
}

interface StaffFormData {
  name: string;
}

export default function StaffMaster() {
  const [staff, setStaff] = useState<StaffMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMaster | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<StaffFormData>({
    defaultValues: {
      name: '',
    }
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_master')
        .select('*')
        .order('name');

      if (error) {
        console.error('従業員マスタ取得エラー:', error);
        alert('従業員データの取得に失敗しました');
        return;
      }

      setStaff(data || []);
    } catch (error) {
      console.error('従業員マスタ取得エラー:', error);
      alert('従業員データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (staffMember: StaffMaster) => {
    setEditingStaff(staffMember);
    setValue('name', staffMember.name);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingStaff(null);
    reset();
    setShowForm(true);
  };

  const onSubmit = async (data: StaffFormData) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      
      if (editingStaff) {
        // 更新
        const { error } = await supabase
          .from('staff_master')
          .update({
            name: data.name,
            normalized_name: data.name, // 簡易的な正規化
            updated_at: now,
          })
          .eq('id', editingStaff.id);

        if (error) {
          console.error('従業員更新エラー:', error);
          alert('従業員の更新に失敗しました');
          return;
        }

        alert('従業員情報を更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('staff_master')
          .insert({
            name: data.name,
            normalized_name: data.name, // 簡易的な正規化
            created_at: now,
            updated_at: now,
          });

        if (error) {
          console.error('従業員作成エラー:', error);
          alert('従業員の作成に失敗しました');
          return;
        }

        alert('新しい従業員を作成しました');
      }

      setShowForm(false);
      setEditingStaff(null);
      reset();
      await loadStaff();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStaff(null);
    reset();
  };

  const handleDelete = async (staffMember: StaffMaster) => {
    if (!confirm(`${staffMember.name}を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('staff_master')
        .delete()
        .eq('id', staffMember.id);

      if (error) {
        console.error('従業員削除エラー:', error);
        alert('従業員の削除に失敗しました');
        return;
      }

      alert('従業員を削除しました');
      await loadStaff();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const filteredStaff = staff.filter(staffMember =>
    staffMember.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">従業員マスタ管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            従業員情報を管理します。CSVインポート時に自動登録された従業員も含まれます。
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
          <label className="block text-sm font-medium text-gray-700 mb-1">従業員名検索</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="従業員名で検索"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 従業員一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>従業員一覧 ({filteredStaff.length}件)</span>
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">データを読み込み中...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>従業員が見つかりません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    従業員名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登録日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    更新日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.map((staffMember) => (
                  <tr key={staffMember.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{staffMember.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(staffMember.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(staffMember.updated_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(staffMember)}
                        className="text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span>編集</span>
                      </button>
                      <button
                        onClick={() => handleDelete(staffMember)}
                        className="text-red-600 hover:text-red-900 inline-flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>削除</span>
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingStaff ? '従業員編集' : '新規従業員追加'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 従業員名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  従業員名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('name', { required: '従業員名は必須です' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
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
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { getEmployees } from '../data/employees';
import { ShiftEntry, Employee } from '../types';
import { saveShiftToNotion } from '../services/notionService';
import { User, Clock, Save, Loader } from 'lucide-react';

const ShiftEntryForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch (error) {
        setError('従業員データの取得に失敗しました');
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployeeData();
  }, []);
  
  const [formData, setFormData] = useState<Partial<ShiftEntry>>({
    従業員ID: '',
    従業員名: '',
    シフト種別: 'day',
    開始時間: new Date(),
    終了時間: new Date(),
  });

  // Format date for input fields
  const formatDateForInput = (date: Date): string => {
    const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
    console.log(`フォーマット: ${date.toISOString()} -> ${formattedDate}`);
    return formattedDate;
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEmployee = employees.find(emp => emp.id === e.target.value);
    setFormData({
      ...formData,
      従業員ID: e.target.value,
      従業員名: selectedEmployee?.従業員名 || '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === '開始時間' || name === '終了時間') {
      // 日付文字列をログに出力
      console.log(`入力された${name}: ${value}`);
      
      try {
        // 入力値を解析して日付オブジェクトを作成
        // yyyy-MM-ddTHH:mm 形式の入力を想定
        const [datePart, timePart] = value.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        // 月は0から始まるため、-1する
        const dateObj = new Date(year, month - 1, day, hours, minutes);
        
        // 変換後の日付をログに出力
        console.log(`解析された${name}: ${year}年${month}月${day}日 ${hours}:${minutes}`);
        console.log(`変換後の${name}: ${dateObj.toISOString()}`);
        
        setFormData({
          ...formData,
          [name]: dateObj,
        });
      } catch (error) {
        console.error(`日付解析エラー: ${error}`);
        // エラーが発生した場合は現在の日時を使用
        const now = new Date();
        console.log(`エラーのため現在時刻を使用: ${now.toISOString()}`);
        setFormData({
          ...formData,
          [name]: now,
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);
    
    try {
      if (!formData.従業員ID || !formData.従業員名 || !formData.開始時間 || !formData.終了時間) {
        throw new Error('全ての項目を入力してください');
      }
      
      // Validate end time is after start time
      if (formData.終了時間! <= formData.開始時間!) {
        throw new Error('終了時間は開始時間より後である必要があります');
      }
      
      // 開始時間と終了時間をログに出力
      console.log(`シフト登録 - 開始時間: ${formData.開始時間!.toISOString()}`);
      console.log(`シフト登録 - 終了時間: ${formData.終了時間!.toISOString()}`);
      
      // 勤務時間の計算
      const diffMs = formData.終了時間!.getTime() - formData.開始時間!.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      console.log(`勤務時間計算: ${diffHours} 時間`);
      
      // 終了時間が開始時間より前の場合はエラー
      if (diffHours <= 0) {
        throw new Error('終了時間は開始時間より後である必要があります');
      }
      
      // Create shift entry
      const shiftEntry: ShiftEntry = {
        従業員ID: formData.従業員ID!,
        従業員名: formData.従業員名!,
        シフト種別: formData.シフト種別 as 'day' | 'night',
        開始時間: formData.開始時間!,
        終了時間: formData.終了時間!,
      };
      
      // Save to Notion
      await saveShiftToNotion(shiftEntry);
      
      // Show success and reset form
      setSuccess(true);
      // Reset only employee selection and shift type, keep dates for convenience
      setFormData(prev => ({
        ...prev,
        従業員ID: '',
        従業員名: '',
        シフト種別: 'day',
      }));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto transition-all duration-300">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
        <Clock className="mr-2 text-blue-600" />
        勤務データ登録
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Selection */}
        <div className="space-y-2">
          <label htmlFor="従業員ID" className="block text-sm font-medium text-gray-700 flex items-center">
            <User className="mr-1 h-4 w-4" />
            スタッフ名
          </label>
          <select
            id="従業員ID"
            name="従業員ID"
            value={formData.従業員ID}
            onChange={handleEmployeeChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">スタッフを選択</option>
            {loadingEmployees ? (
              <option value="">読み込み中...</option>
            ) : employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.従業員名}
              </option>
            ))}
          </select>
        </div>
        
        {/* Shift Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">勤務種別</label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="シフト種別"
                value="day"
                checked={formData.シフト種別 === 'day'}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2">日勤</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="シフト種別"
                value="night"
                checked={formData.シフト種別 === 'night'}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2">夜勤</span>
            </label>
          </div>
        </div>
        
        {/* Start Time */}
        <div className="space-y-2">
          <label htmlFor="開始時間" className="block text-sm font-medium text-gray-700">
            開始時間
          </label>
          <input
            type="datetime-local"
            id="開始時間"
            name="開始時間"
            value={formData.開始時間 ? formatDateForInput(formData.開始時間) : ''}
            onChange={handleInputChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        {/* End Time */}
        <div className="space-y-2">
          <label htmlFor="終了時間" className="block text-sm font-medium text-gray-700">
            終了時間
          </label>
          <input
            type="datetime-local"
            id="終了時間"
            name="終了時間"
            value={formData.終了時間 ? formatDateForInput(formData.終了時間) : ''}
            onChange={handleInputChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
              ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}
              transition-colors duration-200
            `}
          >
            {loading ? (
              <>
                <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                勤務データを保存
              </>
            )}
          </button>
        </div>
        
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mt-4 rounded-md transition-opacity duration-300">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  勤務データが正常に保存されました
                </p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ShiftEntryForm;
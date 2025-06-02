import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi, shiftsApi } from '../api/client';

// 従業員の型定義
interface Employee {
  id: string;
  name: string;
}

// 勤務種別の型定義
type DutyType = 'day' | 'night';

const AttendanceForm = () => {
  const navigate = useNavigate();
  
  // 状態管理
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [dutyType, setDutyType] = useState<DutyType>('day');
  const [workDate, setWorkDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // 従業員データの取得
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);
        const data = await employeesApi.getAll();
        setEmployees(data);
      } catch (err: any) {
        console.error('従業員データの取得に失敗しました:', err);
        setError(err.message || '従業員データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEmployees();
  }, []);
  
  // 勤務種別変更時の処理
  useEffect(() => {
    // 勤務種別に応じてデフォルト時間を設定
    if (dutyType === 'day') {
      setStartTime('08:00');
      setEndTime('18:00');
    } else {
      setStartTime('17:00');
      setEndTime('32:00'); // 翌日8時を32:00として表現
    }
  }, [dutyType]);
  
  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!selectedEmployee) {
      setError('従業員を選択してください');
      return;
    }
    
    // 開始時間と終了時間を数値に変換して比較
    const startHour = parseInt(startTime.split(':')[0]);
    const startMinute = parseInt(startTime.split(':')[1]);
    const endHour = parseInt(endTime.split(':')[0]);
    const endMinute = parseInt(endTime.split(':')[1]);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    if (endTotalMinutes <= startTotalMinutes) {
      setError('終了時間は開始時間より後である必要があります');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // APIリクエストのペイロード
      const payload = {
        employee_id: selectedEmployee,
        duty_type: dutyType as 'day' | 'night',
        work_date: workDate,
        start_ts: `${workDate}T${startTime}:00+09:00`,
        end_ts: `${workDate}T${endTime}:00+09:00`,
      };
      
      // APIリクエストを送信
      await shiftsApi.create(payload);
      
      // 成功時の処理
      setSuccess(true);
      
      // フォームをリセット
      setSelectedEmployee('');
      setDutyType('day');
      setWorkDate(new Date().toISOString().split('T')[0]);
      setStartTime('08:00');
      setEndTime('18:00');
      
      // 3秒後に成功メッセージを非表示
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || '勤怠データの保存に失敗しました');
      console.error('エラー:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="form-container">
      <h2 className="text-2xl font-bold mb-6">勤怠登録</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          登録しました
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-8">従業員データを読み込み中...</div>
      ) : (
        <form onSubmit={handleSubmit} className="form-grid">
          {/* 従業員選択 */}
          <div className="form-field col-span-2">
            <label htmlFor="employee" className="required">スタッフ名</label>
            <select
              id="employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">選択してください</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        
        {/* 勤務種別 */}
        <div className="form-field">
          <label htmlFor="dutyType" className="required">勤務種別</label>
          <select
            id="dutyType"
            value={dutyType}
            onChange={(e) => setDutyType(e.target.value as DutyType)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="day">日勤</option>
            <option value="night">夜勤</option>
          </select>
        </div>
        
        {/* 勤務日 */}
        <div className="form-field">
          <label htmlFor="workDate" className="required">勤務日</label>
          <input
            type="date"
            id="workDate"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        {/* 開始時間 */}
        <div className="form-field">
          <label htmlFor="startTime" className="required">開始時間</label>
          <input
            type="time"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        
        {/* 終了時間 */}
        <div className="form-field">
          <label htmlFor="endTime" className="required">終了時間</label>
          <input
            type="time"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          {dutyType === 'night' && (
            <p className="text-sm text-gray-500 mt-1">
              翌日の時間は24時間以上で入力してください（例: 翌8時 = 32:00）
            </p>
          )}
        </div>
        
          {/* 送信ボタン */}
          <div className="form-field col-span-2 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AttendanceForm;
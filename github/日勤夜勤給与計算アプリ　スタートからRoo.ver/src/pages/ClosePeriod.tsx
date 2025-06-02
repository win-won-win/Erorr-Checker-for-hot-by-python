import { useState, useEffect } from 'react';
import { closePeriodApi } from '../api/client';

// 締め情報の型定義
interface ClosingInfo {
  year_month: string;
  closed_by: string;
  closed_at: string;
}

const ClosePeriod = () => {
  // 状態管理
  const [yearMonth, setYearMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM形式
  );
  const [closingHistory, setClosingHistory] = useState<ClosingInfo[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 年月の選択肢を生成（当月以前の12ヶ月）
  const getYearMonthOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7); // YYYY-MM形式
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      
      options.push({ value, label });
    }
    
    return options;
  };
  
  // 締め履歴の取得
  useEffect(() => {
    const fetchClosingHistory = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await closePeriodApi.getAll();
        setClosingHistory(data);
      } catch (err: any) {
        console.error('締め履歴の取得に失敗しました:', err);
        setError(err.message || '締め履歴の取得に失敗しました');
        setClosingHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClosingHistory();
  }, []);
  
  // 選択した年月が既に締め済みかどうかを確認
  const isAlreadyClosed = (ym: string) => {
    return closingHistory.some(item => item.year_month === ym);
  };
  
  // 確認モーダルを開く
  const openConfirmModal = () => {
    // 未来の月は締めできない
    const today = new Date();
    const selectedDate = new Date(`${yearMonth}-01`);
    
    if (selectedDate > today) {
      setError('未来の月は締め処理できません');
      return;
    }
    
    // 既に締め済みの月はエラー
    if (isAlreadyClosed(yearMonth)) {
      setError('選択した月は既に締め処理済みです');
      return;
    }
    
    setError(null);
    setIsConfirmModalOpen(true);
  };
  
  // 締め処理の実行
  const executeClosing = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await closePeriodApi.close(yearMonth);
      
      // 締め履歴を更新
      setClosingHistory([data, ...closingHistory]);
      setSuccess(`${yearMonth.split('-')[0]}年${parseInt(yearMonth.split('-')[1])}月の締め処理が完了しました`);
      
      // 3秒後に成功メッセージを非表示
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('締め処理に失敗しました:', err);
      setError(err.message || '締め処理に失敗しました');
    } finally {
      setIsLoading(false);
      setIsConfirmModalOpen(false);
    }
  };
  
  // 締め解除処理（管理者のみ）
  const handleReopenPeriod = async (ym: string) => {
    if (window.confirm(`${ym.split('-')[0]}年${parseInt(ym.split('-')[1])}月の締めを解除しますか？`)) {
      setIsLoading(true);
      setError(null);
      
      try {
        await closePeriodApi.reopen(ym);
        
        // 締め履歴を更新
        const updatedHistory = closingHistory.filter(item => item.year_month !== ym);
        setClosingHistory(updatedHistory);
        setSuccess(`${ym.split('-')[0]}年${parseInt(ym.split('-')[1])}月の締め解除が完了しました`);
        
        // 3秒後に成功メッセージを非表示
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } catch (err: any) {
        console.error('締め解除に失敗しました:', err);
        setError(err.message || '締め解除に失敗しました');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">締め処理</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <div className="form-container mb-8">
        <h3 className="text-xl font-bold mb-4">新規締め処理</h3>
        
        <div className="flex items-end space-x-4">
          <div className="form-field">
            <label htmlFor="yearMonth">対象年月</label>
            <select
              id="yearMonth"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="p-2 border rounded"
            >
              {getYearMonthOptions().map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={isAlreadyClosed(option.value)}
                >
                  {option.label} {isAlreadyClosed(option.value) ? '(締め済み)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={openConfirmModal}
            className="btn btn-primary"
            disabled={isLoading || isAlreadyClosed(yearMonth)}
          >
            締め処理を実行
          </button>
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold mb-4">締め履歴</h3>
        
        {isLoading && closingHistory.length === 0 ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : closingHistory.length === 0 ? (
          <div className="text-center py-8">締め履歴がありません</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>対象年月</th>
                <th>締め処理日時</th>
                <th>処理者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {closingHistory.map((item) => (
                <tr key={item.year_month}>
                  <td>
                    {item.year_month.split('-')[0]}年{parseInt(item.year_month.split('-')[1])}月
                  </td>
                  <td>
                    {new Date(item.closed_at).toLocaleString('ja-JP')}
                  </td>
                  <td>{item.closed_by}</td>
                  <td>
                    <button
                      onClick={() => handleReopenPeriod(item.year_month)}
                      className="btn btn-danger"
                      disabled={isLoading}
                    >
                      締め解除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* 確認モーダル */}
      {isConfirmModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">締め処理の確認</h3>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="modal-close"
              >
                &times;
              </button>
            </div>
            
            <div className="py-4">
              <p className="mb-4">
                {yearMonth.split('-')[0]}年{parseInt(yearMonth.split('-')[1])}月の締め処理を実行します。
              </p>
              <p className="mb-4 font-bold text-red-600">
                締め処理後は、対象月の勤怠データの追加・編集・削除ができなくなります。
              </p>
              <p>
                よろしいですか？
              </p>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button
                onClick={executeClosing}
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? '処理中...' : '締め処理を実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClosePeriod;
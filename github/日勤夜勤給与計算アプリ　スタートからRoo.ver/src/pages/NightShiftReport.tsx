import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { reportsApi } from '../api/client';

// 夜勤レポートの型定義
interface NightShiftReportItem {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  total_days: number;
  total_amount: number;
  allowance_pct: number;
}

// 詳細データの型定義
interface NightShiftDetail {
  work_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  base_wage: number;
  night_shift_allowance: number;
  overtime_allowance: number;
  night_time_allowance: number;
  improvement_allowance: number;
  total_amount: number;
}

const NightShiftReport = () => {
  // 状態管理
  const [yearMonth, setYearMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM形式
  );
  const [reportData, setReportData] = useState<NightShiftReportItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<NightShiftReportItem | null>(null);
  const [detailData, setDetailData] = useState<NightShiftDetail[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 印刷用のref
  const printRef = useRef<HTMLDivElement>(null);
  
  // 年月の選択肢を生成（直近36ヶ月）
  const getYearMonthOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 36; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7); // YYYY-MM形式
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      
      options.push({ value, label });
    }
    
    return options;
  };
  
  // レポートデータの取得
  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await reportsApi.getNightReport(yearMonth);
        setReportData(data);
      } catch (err: any) {
        console.error('レポートデータの取得に失敗しました:', err);
        setError(err.message || 'レポートデータの取得に失敗しました');
        setReportData([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReportData();
  }, [yearMonth]);
  
  // 詳細データの取得
  const fetchDetailData = async (employeeId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await reportsApi.getNightDetail(yearMonth, employeeId);
      setDetailData(data);
    } catch (err: any) {
      console.error('詳細データの取得に失敗しました:', err);
      setError(err.message || '詳細データの取得に失敗しました');
      setDetailData([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 従業員行のクリック処理
  const handleRowClick = (employee: NightShiftReportItem) => {
    setSelectedEmployee(employee);
    fetchDetailData(employee.employee_id);
    setIsModalOpen(true);
  };
  
  // モーダルを閉じる
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null);
    setDetailData([]);
  };
  
  // 印刷処理
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `夜勤集計_${yearMonth}`,
    onBeforeGetContent: () => {
      return new Promise<void>((resolve) => {
        resolve();
      });
    },
  });
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">夜勤集計</h2>
        <div className="flex items-center space-x-4">
          <select
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="p-2 border rounded"
            disabled={isLoading}
          >
            {getYearMonthOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            className="btn btn-primary no-print"
            disabled={isLoading || reportData.length === 0}
          >
            印刷
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 no-print">
          {error}
        </div>
      )}
      
      <div ref={printRef}>
        <h3 className="text-xl font-bold mb-4">
          {yearMonth.split('-')[0]}年{parseInt(yearMonth.split('-')[1])}月 夜勤集計
        </h3>
        
        {isLoading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-8">データがありません</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>従業員名</th>
                <th>合計勤務時間</th>
                <th>合計勤務日数</th>
                <th>処遇改善加算%</th>
                <th>合計支給額</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item) => (
                <tr
                  key={item.employee_id}
                  onClick={() => handleRowClick(item)}
                  className="cursor-pointer hover:bg-gray-100"
                >
                  <td>{item.employee_name}</td>
                  <td>{item.total_hours}時間</td>
                  <td>{item.total_days}日</td>
                  <td>{item.allowance_pct}%</td>
                  <td>{item.total_amount.toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td>合計</td>
                <td>
                  {reportData.reduce((sum, item) => sum + item.total_hours, 0)}時間
                </td>
                <td>
                  {reportData.reduce((sum, item) => sum + item.total_days, 0)}日
                </td>
                <td>-</td>
                <td>
                  {reportData
                    .reduce((sum, item) => sum + item.total_amount, 0)
                    .toLocaleString()}円
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      
      {/* 詳細モーダル */}
      {isModalOpen && selectedEmployee && (
        <div className="modal-backdrop no-print">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedEmployee.employee_name}の勤務詳細
              </h3>
              <button onClick={closeModal} className="modal-close">&times;</button>
            </div>
            
            <table className="data-table mt-4">
              <thead>
                <tr>
                  <th>勤務日</th>
                  <th>開始時間</th>
                  <th>終了時間</th>
                  <th>勤務時間</th>
                  <th>基本賃金</th>
                  <th>夜勤手当</th>
                  <th>残業手当</th>
                  <th>深夜手当</th>
                  <th>処遇改善加算</th>
                  <th>合計</th>
                </tr>
              </thead>
              <tbody>
                {detailData.map((detail, index) => (
                  <tr key={index}>
                    <td>{new Date(detail.work_date).toLocaleDateString('ja-JP')}</td>
                    <td>{detail.start_time}</td>
                    <td>{detail.end_time}</td>
                    <td>{detail.hours}時間</td>
                    <td>{detail.base_wage.toLocaleString()}円</td>
                    <td>{detail.night_shift_allowance.toLocaleString()}円</td>
                    <td>{detail.overtime_allowance.toLocaleString()}円</td>
                    <td>{detail.night_time_allowance.toLocaleString()}円</td>
                    <td>{detail.improvement_allowance.toLocaleString()}円</td>
                    <td>{detail.total_amount.toLocaleString()}円</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={4}>合計</td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.base_wage, 0)
                      .toLocaleString()}円
                  </td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.night_shift_allowance, 0)
                      .toLocaleString()}円
                  </td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.overtime_allowance, 0)
                      .toLocaleString()}円
                  </td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.night_time_allowance, 0)
                      .toLocaleString()}円
                  </td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.improvement_allowance, 0)
                      .toLocaleString()}円
                  </td>
                  <td>
                    {detailData
                      .reduce((sum, detail) => sum + detail.total_amount, 0)
                      .toLocaleString()}円
                  </td>
                </tr>
              </tfoot>
            </table>
            
            <div className="modal-footer">
              <button onClick={closeModal} className="btn btn-secondary">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NightShiftReport;
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalculationResult } from '../types';
import { fetchShiftsForMonth } from '../services/notionService';
import { calculateNightShiftPay } from '../utils/calculations';
import MonthSelector from './MonthSelector';
import { Moon, DollarSign, ChevronDown, ChevronUp, Loader } from 'lucide-react';

const NightShiftCalculation: React.FC = () => {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [month, setMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, '0'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculations, setCalculations] = useState<CalculationResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Load data when year or month changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const shifts = await fetchShiftsForMonth(year, month);
        const nightShiftResults = calculateNightShiftPay(shifts);
        setCalculations(nightShiftResults);
      } catch (err) {
        console.error('Error fetching shift data:', err);
        setError('データの取得中にエラーが発生しました。再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, month]);

  // Format currency amount
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Toggle row expansion
  const toggleRowExpansion = (従業員名: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [従業員名]: !prev[従業員名]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Moon className="mr-2 text-blue-600" />
        夜勤手当計算
      </h1>
      
      <MonthSelector
        year={year}
        month={month}
        onYearChange={setYear}
        onMonthChange={setMonth}
      />
      
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader className="animate-spin h-8 w-8 text-blue-600" />
          <span className="ml-2 text-gray-600">データ取得中...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : calculations.length === 0 ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                選択した月のデータはありません。別の月を選択するか、新しい勤務データを登録してください。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-3">
              <h2 className="text-xl font-semibold flex items-center">
                <DollarSign className="mr-2" size={20} />
                {year}年{parseInt(month)}月 夜勤手当計算結果
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      スタッフ名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      合計勤務時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      合計勤務日数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      合計支給額
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      詳細
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((result, index) => (
                    <React.Fragment key={index}>
                      <tr className={`hover:bg-blue-50 transition-colors duration-200 ${expandedRows[result.従業員名] ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.従業員名}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.合計時間.toFixed(1)} 時間
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.合計日数} 日
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(result.合計給与)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => toggleRowExpansion(result.従業員名)}
                            className="text-blue-600 hover:text-blue-800 focus:outline-none"
                          >
                            {expandedRows[result.従業員名] ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {expandedRows[result.従業員名] && (
                        <tr className="bg-blue-50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="text-sm text-gray-700">
                              <h3 className="font-semibold mb-2 text-blue-800">手当詳細</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p><span className="font-medium">基本給（時給）:</span> {formatCurrency(result.詳細?.時給基本給 || 0)}</p>
                                  <p><span className="font-medium">基本給（合計）:</span> {formatCurrency(result.詳細?.基本給合計 || 0)}</p>
                                  <p><span className="font-medium">夜勤手当:</span> {formatCurrency(result.詳細?.夜勤手当 || 0)}</p>
                                </div>
                                <div>
                                  <p><span className="font-medium">残業手当:</span> {formatCurrency(result.詳細?.残業手当 || 0)}</p>
                                  <p><span className="font-medium">深夜手当:</span> {formatCurrency(result.詳細?.深夜手当 || 0)}</p>
                                  <p><span className="font-medium">処遇改善加算:</span> {formatCurrency(result.詳細?.改善手当 || 0)}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md shadow-sm">
            <p className="text-sm text-blue-800 font-semibold mb-2">計算方法:</p>
            <ul className="list-disc list-inside text-sm text-blue-800 space-y-1 pl-2">
              <li>基本時給: {formatCurrency(1200)}/時間</li>
              <li>夜勤手当: 出勤日数 × {formatCurrency(3000)}</li>
              <li>残業手当: 8時間超過分 × 時給 × 1.25倍</li>
              <li>深夜手当: 22時〜5時の勤務時間 × 時給 × 1.25倍</li>
              <li>処遇改善加算: 基本給 × 個人別処遇改善加算率</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default NightShiftCalculation;
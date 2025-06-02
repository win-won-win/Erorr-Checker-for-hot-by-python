import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalculationResult } from '../types';
import { fetchShiftsForMonth } from '../services/notionService';
import { calculateDayShiftPay } from '../utils/calculations';
import MonthSelector from './MonthSelector';
import { Clock, DollarSign, Loader } from 'lucide-react';

const DayShiftCalculation: React.FC = () => {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [month, setMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, '0'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculations, setCalculations] = useState<CalculationResult[]>([]);

  // Load data when year or month changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const shifts = await fetchShiftsForMonth(year, month);
        const dayShiftResults = calculateDayShiftPay(shifts);
        setCalculations(dayShiftResults);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Clock className="mr-2 text-blue-600" />
        日勤手当計算
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
                {year}年{parseInt(month)}月 日勤手当計算結果
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-md shadow-sm">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">計算方法: </span>
              日勤の時給は{formatCurrency(1300)}/時間で計算しています。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayShiftCalculation;
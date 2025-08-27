import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Edit, Trash2, Download, Calendar, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { PrintPreview } from './PrintPreview';
import { BulkPrintPreview } from './BulkPrintPreview';
import { supabase } from '../lib/supabase';

interface ServiceRecord {
  id: string;
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  service_content: string;
  special_notes: string;
  deposit_amount: number;
  deposit_breakdown: string;
  deposit_change: number;
  service_details: any;
  pattern_id: string | null;
  csv_record_id: string | null;
  service_type: string | null;
  created_at: string;
  updated_at: string;
}

interface FilterOptions {
  dateFrom: string;
  dateTo: string;
  userName: string;
  staffName: string;
}

export function RecordList() {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ServiceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [printRecord, setPrintRecord] = useState<ServiceRecord | null>(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [showBulkPrintButton, setShowBulkPrintButton] = useState(false);
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    dateFrom: '',
    dateTo: '',
    userName: '',
    staffName: ''
  });

  useEffect(() => {
    loadServiceRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, searchTerm, filters]);

  const loadServiceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('service_records')
        .select('*')
        .order('service_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) {
        console.error('記録取得エラー:', error);
        return;
      }

      setRecords(data || []);
    } catch (error) {
      console.error('記録取得エラー:', error);
    }
  };

  const applyFilters = () => {
    let filtered = records;

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.user_name.includes(searchTerm) ||
        record.staff_name.includes(searchTerm) ||
        record.service_content.includes(searchTerm) ||
        record.special_notes.includes(searchTerm)
      );
    }

    // 日付フィルター
    if (filters.dateFrom) {
      filtered = filtered.filter(record => record.service_date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(record => record.service_date <= filters.dateTo);
    }

    // その他のフィルター
    if (filters.userName) {
      filtered = filtered.filter(record => record.user_name.includes(filters.userName));
    }
    if (filters.staffName) {
      filtered = filtered.filter(record => record.staff_name.includes(filters.staffName));
    }

    setFilteredRecords(filtered);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      userName: '',
      staffName: ''
    });
    setSearchTerm('');
  };

  const handleDelete = (recordId: string) => {
    if (confirm('この記録を削除しますか？')) {
      setRecords(prev => prev.filter(r => r.id !== recordId));
      alert('記録を削除しました');
    }
  };

  const exportRecords = () => {
    // CSV形式でエクスポート
    const headers = [
      'サービス日',
      '利用者名',
      '担当職員',
      'サービス種類',
      'サービス内容',
      '開始時間',
      '終了時間',
      '記録作成日時',
      '特記事項',
      '預り金'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(record => [
        record.service_date,
        record.user_name,
        record.staff_name,
        record.service_content,
        record.start_time,
        record.end_time,
        record.created_at,
        `"${record.special_notes.replace(/"/g, '""')}"`,
        record.deposit_amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `service_records_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkPrint = () => {
    if (filteredRecords.length === 0) {
      alert('印刷する記録がありません');
      return;
    }
    setShowBulkPrint(true);
  };

  const handleTitleClick = () => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);
    
    if (newCount === 5) {
      setShowBulkPrintButton(true);
      alert('裏機能が有効になりました！一括印刷ボタンが表示されます。');
    }
    
    // 10秒後にカウントをリセット
    setTimeout(() => {
      setTitleClickCount(0);
    }, 10000);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2
          className="text-2xl font-bold text-gray-900 cursor-pointer select-none"
          onClick={handleTitleClick}
          title={showBulkPrintButton ? "裏機能有効" : `${titleClickCount}/5 クリック`}
        >
          記録一覧
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>フィルター</span>
          </button>
          {showBulkPrintButton && (
            <button
              onClick={handleBulkPrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              disabled={filteredRecords.length === 0}
            >
              <FileText className="h-4 w-4" />
              <span>一括印刷 ({filteredRecords.length}件)</span>
            </button>
          )}
          <button
            onClick={exportRecords}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>エクスポート</span>
          </button>
        </div>
      </div>

      {/* 検索バー */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="利用者名、職員名、サービス内容で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            {filteredRecords.length} 件中 {filteredRecords.length} 件表示
          </div>
        </div>
      </div>

      {/* フィルター */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">利用者名</label>
              <input
                type="text"
                value={filters.userName}
                onChange={(e) => handleFilterChange('userName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">担当職員</label>
              <input
                type="text"
                value={filters.staffName}
                onChange={(e) => handleFilterChange('staffName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              フィルターをクリア
            </button>
          </div>
        </div>
      )}

      {/* 記録一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  サービス日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  利用者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  担当職員
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  サービス内容
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  記録作成日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  預り金
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    記録がありません
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(record.service_date), 'MM/dd(E)', { locale: ja })}
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.start_time}-{record.end_time}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {record.user_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {record.staff_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                          サービス記録
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.service_content}
                      </div>
                      {record.special_notes && (
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                          {record.special_notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(record.created_at), 'MM/dd HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.deposit_amount > 0 ? `¥${record.deposit_amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="詳細表示"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPrintRecord(record)}
                          className="text-green-600 hover:text-green-900"
                          title="印刷プレビュー"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => alert('編集機能は開発中です')}
                          className="text-gray-600 hover:text-gray-900"
                          title="編集"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-900"
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 記録詳細モーダル */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">記録詳細</h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">利用者名</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRecord.user_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">担当職員</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRecord.staff_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">サービス日</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedRecord.service_date), 'yyyy年MM月dd日(E)', { locale: ja })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">サービス時間</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedRecord.start_time} - {selectedRecord.end_time}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">サービス種類</label>
                  <p className="mt-1 text-sm text-gray-900">サービス記録</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">記録作成日時</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedRecord.created_at), 'yyyy/MM/dd HH:mm:ss')}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">サービス内容</label>
                <p className="mt-1 text-sm text-gray-900">{selectedRecord.service_content}</p>
              </div>
              
              {selectedRecord.special_notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">特記事項</label>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedRecord.special_notes}
                  </p>
                </div>
              )}
              
              {selectedRecord.deposit_amount > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">預り金</label>
                  <p className="mt-1 text-sm text-gray-900">
                    ¥{selectedRecord.deposit_amount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 印刷プレビューモーダル */}
      {printRecord && (
        <PrintPreview
          record={{
            ...printRecord,
            service_type: printRecord.service_type || 'サービス記録',
            record_created_at: printRecord.created_at
          }}
          onClose={() => setPrintRecord(null)}
        />
      )}

      {/* 一括印刷プレビューモーダル */}
      {showBulkPrint && (
        <BulkPrintPreview
          records={filteredRecords.map(record => ({
            ...record,
            service_type: record.service_type || 'サービス記録',
            record_created_at: record.created_at
          }))}
          onClose={() => setShowBulkPrint(false)}
        />
      )}
    </div>
  );
}
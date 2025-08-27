import React, { useState, useEffect } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Settings, CheckCircle, AlertCircle, Clock, User, Edit, Plus,
  Upload, Download, Filter, Search, FileText, BarChart3, Link, Unlink, Trash2, Eye, X, AlertTriangle, Printer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { patternService } from '../utils/patternService';
import { ServicePattern, UserTimePattern } from '../types/pattern';
import { DailyDataManagement } from './DailyDataManagement';
import { WeeklyPatternCalendar } from './WeeklyPatternCalendar';
import { normalizeName } from '../utils/nameNormalizer';
import { PrintPreview } from './PrintPreview';
import { BulkPrintPreview } from './BulkPrintPreview';

interface CSVServiceRecord {
  id: string;
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  service_content: string;
  pattern_id: string | null;
  pattern_name?: string | null;
  record_created_at: string | null;
  print_datetime: string | null;
  is_pattern_assigned: boolean;
  user_code?: string;
}

// service_recordsテーブル用のインターフェース
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
  // 予定/記録の判定用
  is_schedule: boolean;
  record_status: 'schedule' | 'completed_record';
}

interface DayData {
  date: string;
  records: CSVServiceRecord[];
  totalRecords: number;
  assignedRecords: number;
  unassignedRecords: number;
  status: 'complete' | 'partial' | 'none';
}

interface MonthlyStats {
  totalRecords: number;
  assignedRecords: number;
  unassignedRecords: number;
  completeDays: number;
  partialDays: number;
  emptyDays: number;
}

interface FilterOptions {
  status: 'all' | 'assigned' | 'unassigned';
  user: string;
  staff: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// 記録一覧用のフィルターオプション
interface RecordListFilterOptions {
  dateFrom: string;
  dateTo: string;
  userName: string;
  staffName: string;
}

export function MonthlyDataManagement() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState<{ [key: string]: DayData }>({});
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalRecords: 0,
    assignedRecords: 0,
    unassignedRecords: 0,
    completeDays: 0,
    partialDays: 0,
    emptyDays: 0
  });
  const [patterns, setPatterns] = useState<ServicePattern[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<CSVServiceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<CSVServiceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<CSVServiceRecord[]>([]);
  
  // 記録一覧機能用の状態
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [filteredServiceRecords, setFilteredServiceRecords] = useState<ServiceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [printRecord, setPrintRecord] = useState<ServiceRecord | null>(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [showBulkPrintButton, setShowBulkPrintButton] = useState(false);
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [recordListFilters, setRecordListFilters] = useState<RecordListFilterOptions>({
    dateFrom: '',
    dateTo: '',
    userName: '',
    staffName: ''
  });
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'schedule' | 'record'>('record'); // デフォルトで記録のみ表示
  
  // 日別データ管理の状態
  const [showDailyDataManagement, setShowDailyDataManagement] = useState(false);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>('');
  
  // CSV取り込み関連の状態
  const [csvImportProgress, setCsvImportProgress] = useState(0);
  const [csvImportStatus, setCsvImportStatus] = useState<string>('');
  const [csvImportInProgress, setCsvImportInProgress] = useState(false);
  
  // モーダル状態
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showRecordCreateModal, setShowRecordCreateModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // フィルター状態
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    user: '',
    staff: '',
    dateRange: {
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    }
  });
  
  // 表示モード（裏機能で最初に記録一覧を表示）
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'record-list'>('record-list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyData();
    loadPatterns();
    loadServiceRecords();
  }, [currentMonth]);

  useEffect(() => {
    applyFilters();
  }, [allRecords, filters]);

  useEffect(() => {
    applyRecordListFilters();
  }, [serviceRecords, searchTerm, recordListFilters, recordTypeFilter]);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        loadSampleData();
        return;
      }

      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: records } = await supabase
        .from('csv_service_records')
        .select(`
          *,
          service_patterns(pattern_name)
        `)
        .gte('service_date', monthStart)
        .lte('service_date', monthEnd)
        .order('service_date')
        .order('start_time');

      if (records) {
        const processedRecords = records.map(record => ({
          ...record,
          pattern_name: record.service_patterns?.pattern_name || null,
          is_pattern_assigned: !!record.pattern_id
        }));
        setAllRecords(processedRecords);
        processMonthlyData(processedRecords);
      }
    } catch (error) {
      console.error('月別データ読み込みエラー:', error);
      loadSampleData();
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const today = new Date();
    const sampleRecords: CSVServiceRecord[] = [
      {
        id: '1',
        user_name: '田中 花子',
        user_code: 'U001',
        staff_name: '渡邉 由可里',
        service_date: format(today, 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        duration_minutes: 60,
        service_content: '排泄介助・食事介助',
        pattern_id: null,
        pattern_name: null,
        record_created_at: new Date().toISOString(),
        print_datetime: null,
        is_pattern_assigned: false
      },
      {
        id: '2',
        user_name: '山田 次郎',
        user_code: 'U002',
        staff_name: '笠間 京子',
        service_date: format(today, 'yyyy-MM-dd'),
        start_time: '14:00',
        end_time: '15:00',
        duration_minutes: 60,
        service_content: '清掃・洗濯',
        pattern_id: null,
        pattern_name: null,
        record_created_at: new Date().toISOString(),
        print_datetime: null,
        is_pattern_assigned: false
      },
      {
        id: '3',
        user_name: '佐藤 美香',
        user_code: 'U003',
        staff_name: '田中 太郎',
        service_date: format(addMonths(today, 0), 'yyyy-MM-dd'),
        start_time: '10:30',
        end_time: '11:30',
        duration_minutes: 60,
        service_content: '入浴介助',
        pattern_id: null,
        pattern_name: null,
        record_created_at: new Date().toISOString(),
        print_datetime: null,
        is_pattern_assigned: false
      }
    ];

    setAllRecords(sampleRecords);
    processMonthlyData(sampleRecords);
    setLoading(false);
  };

  const processMonthlyData = (records: CSVServiceRecord[]) => {
    const dayDataMap: { [key: string]: DayData } = {};
    const stats: MonthlyStats = {
      totalRecords: 0,
      assignedRecords: 0,
      unassignedRecords: 0,
      completeDays: 0,
      partialDays: 0,
      emptyDays: 0
    };

    // 月の全日付を初期化
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    allDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      dayDataMap[dateStr] = {
        date: dateStr,
        records: [],
        totalRecords: 0,
        assignedRecords: 0,
        unassignedRecords: 0,
        status: 'none'
      };
    });

    // レコードを日付別に分類
    records.forEach(record => {
      const dateStr = record.service_date;
      if (!dayDataMap[dateStr]) {
        dayDataMap[dateStr] = {
          date: dateStr,
          records: [],
          totalRecords: 0,
          assignedRecords: 0,
          unassignedRecords: 0,
          status: 'none'
        };
      }

      dayDataMap[dateStr].records.push(record);
      dayDataMap[dateStr].totalRecords++;

      if (record.is_pattern_assigned) {
        dayDataMap[dateStr].assignedRecords++;
        stats.assignedRecords++;
      } else {
        dayDataMap[dateStr].unassignedRecords++;
        stats.unassignedRecords++;
      }

      stats.totalRecords++;
    });

    // 各日の状態を計算
    Object.values(dayDataMap).forEach(dayData => {
      if (dayData.totalRecords === 0) {
        dayData.status = 'none';
        stats.emptyDays++;
      } else if (dayData.assignedRecords === dayData.totalRecords) {
        dayData.status = 'complete';
        stats.completeDays++;
      } else {
        dayData.status = 'partial';
        stats.partialDays++;
      }
    });

    setMonthlyData(dayDataMap);
    setMonthlyStats(stats);
  };

  const loadPatterns = async () => {
    try {
      const patternList = await patternService.listPatterns();
      setPatterns(patternList);
    } catch (error) {
      console.error('パターン読み込みエラー:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allRecords];

    // ステータスフィルター
    if (filters.status === 'assigned') {
      filtered = filtered.filter(record => record.is_pattern_assigned);
    } else if (filters.status === 'unassigned') {
      filtered = filtered.filter(record => !record.is_pattern_assigned);
    }

    // 利用者フィルター
    if (filters.user) {
      filtered = filtered.filter(record =>
        record.user_name.toLowerCase().includes(filters.user.toLowerCase())
      );
    }

    // 担当職員フィルター
    if (filters.staff) {
      filtered = filtered.filter(record =>
        record.staff_name.toLowerCase().includes(filters.staff.toLowerCase())
      );
    }

    // 日付範囲フィルター
    if (filters.dateRange.start && filters.dateRange.end) {
      filtered = filtered.filter(record =>
        record.service_date >= filters.dateRange.start &&
        record.service_date <= filters.dateRange.end
      );
    }

    setFilteredRecords(filtered);
  };

  // 記録一覧機能用の関数
  const loadServiceRecords = async () => {
    try {
      // currentMonthに基づいて該当月の開始日と終了日を計算（日本時間で正確に）
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // 日本時間での日付文字列を作成（タイムゾーンの影響を受けない）
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      console.log(`Loading records for ${year}年${month + 1}月: ${startDate} to ${endDate}`);

      const { data, error } = await supabase
        .from('service_records')
        .select('*')
        .gte('service_date', startDate)
        .lte('service_date', endDate)
        .order('service_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) {
        console.error('記録取得エラー:', error);
        return;
      }

      // 予定と記録を区別するロジックを追加
      const processedRecords = (data || []).map(record => {
        // 判定ロジック：
        // 1. pattern_idがnullかつcsv_record_idがnull → 手動作成された記録
        // 2. pattern_idがあるかcsv_record_idがある → パターンまたはCSVから作成された記録
        // 3. service_typeが'schedule'の場合は予定として扱う
        const isSchedule = record.service_type === 'schedule' ||
                          (record.pattern_id === null && record.csv_record_id !== null);
        
        const recordStatus = isSchedule ? 'schedule' : 'completed_record';

        return {
          ...record,
          is_schedule: isSchedule,
          record_status: recordStatus
        };
      });

      console.log(`Found ${processedRecords.length} records for ${year}年${month + 1}月`);
      console.log('Records breakdown:', {
        schedules: processedRecords.filter(r => r.is_schedule).length,
        completed: processedRecords.filter(r => !r.is_schedule).length
      });
      
      setServiceRecords(processedRecords);
    } catch (error) {
      console.error('記録取得エラー:', error);
    }
  };

  const applyRecordListFilters = () => {
    let filtered = serviceRecords;

    // 記録種別フィルター（デフォルトで記録のみ表示）
    if (recordTypeFilter === 'schedule') {
      filtered = filtered.filter(record => record.is_schedule);
    } else if (recordTypeFilter === 'record') {
      filtered = filtered.filter(record => !record.is_schedule);
    }
    // 'all'の場合はフィルタリングしない

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
    if (recordListFilters.dateFrom) {
      filtered = filtered.filter(record => record.service_date >= recordListFilters.dateFrom);
    }
    if (recordListFilters.dateTo) {
      filtered = filtered.filter(record => record.service_date <= recordListFilters.dateTo);
    }

    // その他のフィルター
    if (recordListFilters.userName) {
      filtered = filtered.filter(record => record.user_name.includes(recordListFilters.userName));
    }
    if (recordListFilters.staffName) {
      filtered = filtered.filter(record => record.staff_name.includes(recordListFilters.staffName));
    }

    setFilteredServiceRecords(filtered);
  };

  const handleRecordListFilterChange = (key: keyof RecordListFilterOptions, value: string) => {
    setRecordListFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearRecordListFilters = () => {
    setRecordListFilters({
      dateFrom: '',
      dateTo: '',
      userName: '',
      staffName: ''
    });
    setSearchTerm('');
    setRecordTypeFilter('record'); // デフォルトに戻す
  };

  const handleDeleteServiceRecord = (recordId: string) => {
    if (confirm('この記録を削除しますか？')) {
      setServiceRecords(prev => prev.filter(r => r.id !== recordId));
      alert('記録を削除しました');
    }
  };

  const exportServiceRecords = () => {
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
      ...filteredServiceRecords.map(record => [
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
    if (filteredServiceRecords.length === 0) {
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

  const handleDayClick = (dateStr: string) => {
    const dayData = monthlyData[dateStr];
    if (dayData && dayData.records.length > 0) {
      setSelectedDay(dateStr);
      setSelectedRecords(dayData.records);
      setShowPatternModal(true);
    }
  };

  const handleDayDetailView = (dateStr: string) => {
    setSelectedDailyDate(dateStr);
    setShowDailyDataManagement(true);
  };

  const handleBackToMonthly = () => {
    setShowDailyDataManagement(false);
    setSelectedDailyDate('');
    // 月別データを再読み込みして変更を反映
    loadMonthlyData();
  };

  const handleDailyDateChange = (date: string) => {
    setSelectedDailyDate(date);
  };

  // 利用者と従業員の自動マスタ登録
  const registerUsersAndStaff = async (validData: any[]) => {
    try {
      // 利用者名と従業員名を抽出（空文字列や空白のみも除外）
      const userNames = [...new Set(validData
        .map(data => data.userName)
        .filter(name => name && typeof name === 'string' && name.trim() !== ''))];
      
      const staffNames = [...new Set(validData
        .map(data => data.staffName)
        .filter(name => name && typeof name === 'string' && name.trim() !== ''))];

      console.log('抽出された利用者名:', userNames);
      console.log('抽出された従業員名:', staffNames);

      // 既存の利用者を取得
      const { data: existingUsers } = await supabase
        .from('users_master')
        .select('name, normalized_name');

      const existingUserNames = new Set(existingUsers?.map(u => u.name) || []);

      // 既存の従業員を取得
      const { data: existingStaff } = await supabase
        .from('staff_master')
        .select('name, normalized_name');

      const existingStaffNames = new Set(existingStaff?.map(s => s.name) || []);

      // 新しい利用者を登録
      const newUsers = userNames.filter(name => !existingUserNames.has(name));
      if (newUsers.length > 0) {
        const usersToInsert = newUsers.map(name => {
          const normalized = normalizeName(name);
          return {
            name,
            normalized_name: normalized.normalized,
            temperature_min: 36.0,
            temperature_max: 37.5,
            blood_pressure_systolic_min: 100,
            blood_pressure_systolic_max: 140,
            blood_pressure_diastolic_min: 60,
            blood_pressure_diastolic_max: 90,
            pulse_min: 60,
            pulse_max: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });

        const { error: userError } = await supabase
          .from('users_master')
          .insert(usersToInsert);

        if (userError) {
          // 重複エラーの場合は警告として処理
          if (userError.code === '23505') {
            console.warn('利用者マスタ: 一部の利用者は既に登録済みです');
          } else {
            console.error('利用者マスタ登録エラー:', userError);
            // 重複以外のエラーの場合は処理を続行するが警告を表示
          }
        } else {
          console.log(`${newUsers.length}名の新しい利用者を登録しました:`, newUsers);
        }
      }

      // 新しい従業員を登録
      const newStaff = staffNames.filter(name => !existingStaffNames.has(name));
      if (newStaff.length > 0) {
        const staffToInsert = newStaff.map(name => {
          const normalized = normalizeName(name);
          return {
            name,
            normalized_name: normalized.normalized,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });

        const { error: staffError } = await supabase
          .from('staff_master')
          .insert(staffToInsert);

        if (staffError) {
          // 重複エラーの場合は警告として処理
          if (staffError.code === '23505') {
            console.warn('従業員マスタ: 一部の従業員は既に登録済みです');
          } else {
            console.error('従業員マスタ登録エラー:', staffError);
            // 重複以外のエラーの場合は処理を続行するが警告を表示
          }
        } else {
          console.log(`${newStaff.length}名の新しい従業員を登録しました:`, newStaff);
        }
      }

      return {
        newUsersCount: newUsers.length,
        newStaffCount: newStaff.length
      };
    } catch (error) {
      console.error('マスタ登録エラー:', error);
      return {
        newUsersCount: 0,
        newStaffCount: 0
      };
    }
  };

  const handleCSVImport = async (file: File) => {
    let validationErrors: string[] = [];
    let parsedDataCount = 0;
    let validDataCount = 0;

    try {
      setLoading(true);
      setCsvImportInProgress(true);
      setCsvImportStatus('CSV取り込みを開始しています...');
      setCsvImportProgress(0);

      // ファイル形式チェック
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('CSVファイルを選択してください（.csv形式のみ対応）');
      }

      // ファイルサイズチェック（50MB制限）
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxFileSize) {
        throw new Error(`ファイルサイズが上限（${Math.round(maxFileSize / 1024 / 1024)}MB）を超えています`);
      }

      setCsvImportProgress(5);
      setCsvImportStatus(`ファイルを読み込み中... (${Math.round(file.size / 1024)}KB)`);

      // CSVファイルを解析
      const { parseSimplifiedCSV, validateSimplifiedCSVData } = await import('../utils/csvParser');
      
      let parsedData;
      try {
        parsedData = await parseSimplifiedCSV(file);
        parsedDataCount = parsedData.length;
      } catch (parseError) {
        throw new Error(`CSVファイルの解析に失敗しました: ${parseError instanceof Error ? parseError.message : '不明なエラー'}`);
      }

      setCsvImportProgress(20);
      setCsvImportStatus(`${parsedDataCount}行のデータを解析しました。検証中...`);

      if (parsedDataCount === 0) {
        throw new Error('CSVファイルにデータが含まれていません。ヘッダー行と最低1行のデータが必要です。');
      }

      // データ検証
      const { valid: validData, errors: validationErrorsResult } = validateSimplifiedCSVData(parsedData);
      validationErrors = validationErrorsResult;
      validDataCount = validData.length;
      
      setCsvImportProgress(35);
      
      if (validationErrors.length > 0) {
        console.warn('データ検証エラー:', validationErrors);
        setCsvImportStatus(`データ検証で${validationErrors.length}件のエラーが見つかりました。有効なデータで処理を続行します...`);
        
        // 重複データエラーは警告として扱い、処理を続行
        const criticalErrors = validationErrors.filter(error =>
          !error.includes('重複データです') &&
          !error.includes('担当職員が空です') &&
          !error.includes('利用者コードが空です')
        );
        
        // 重大なエラーが多い場合のみ処理を中断
        if (validDataCount === 0) {
          const errorSummary = validationErrors.slice(0, 10).join('\n');
          const additionalErrors = validationErrors.length > 10 ? `\n...他${validationErrors.length - 10}件のエラー` : '';
          throw new Error(`すべてのデータに検証エラーがあります:\n\n${errorSummary}${additionalErrors}`);
        }
        
        if (validationErrors.length > validDataCount) {
          const shouldContinue = confirm(
            `データ検証で${validationErrors.length}件のエラーが見つかりました。\n` +
            `有効なデータ: ${validDataCount}件\n` +
            `エラーのあるデータ: ${validationErrors.length}件\n\n` +
            `有効なデータのみで処理を続行しますか？\n\n` +
            `エラーの例:\n${validationErrors.slice(0, 3).join('\n')}`
          );
          
          if (!shouldContinue) {
            throw new Error('ユーザーによってキャンセルされました');
          }
        }
      }

      setCsvImportProgress(50);
      setCsvImportStatus(`${validDataCount}件の有効なデータを処理中...`);

      // データをCSVServiceRecord形式に変換
      const newRecords: CSVServiceRecord[] = validData.map((data, index) => ({
        id: `csv-${Date.now()}-${index}`,
        user_name: data.userName,
        user_code: data.userCode || '',
        staff_name: data.staffName || '未設定',
        service_date: data.serviceDate,
        start_time: data.startTime,
        end_time: data.endTime,
        duration_minutes: data.durationMinutes,
        service_content: data.serviceContent || '',
        pattern_id: null,
        pattern_name: null,
        record_created_at: new Date().toISOString(),
        print_datetime: null,
        is_pattern_assigned: false
      }));

      setCsvImportProgress(55);
      setCsvImportStatus('利用者・従業員マスタを更新中...');

      // 利用者と従業員の自動マスタ登録
      if (isSupabaseConfigured()) {
        const masterResult = await registerUsersAndStaff(validData);
        if (masterResult.newUsersCount > 0 || masterResult.newStaffCount > 0) {
          setCsvImportStatus(`新規登録: 利用者${masterResult.newUsersCount}名、従業員${masterResult.newStaffCount}名`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒表示
        }
      }

      setCsvImportProgress(60);
      setCsvImportStatus('データベースに保存中...');

      // Supabaseが設定されている場合はデータベースに保存
      if (isSupabaseConfigured()) {
        const batchSize = 50; // バッチサイズを小さくして安定性を向上
        let savedCount = 0;
        let failedBatches = 0;
        
        for (let i = 0; i < newRecords.length; i += batchSize) {
          const batch = newRecords.slice(i, i + batchSize);
          
          try {
            const { error } = await supabase
              .from('service_records')
              .insert(batch.map(record => ({
                user_name: record.user_name,
                staff_name: record.staff_name,
                service_date: record.service_date,
                start_time: record.start_time,
                end_time: record.end_time,
                duration_minutes: record.duration_minutes,
                service_content: record.service_content,
                service_type: 'home_visit_care', // デフォルトのサービス種別
                special_notes: record.user_code ? `利用者コード: ${record.user_code}` : '',
                deposit_amount: 0,
                deposit_breakdown: '',
                deposit_change: 0,
                service_details: null,
                pattern_id: null,
                csv_record_id: null
              })));

            if (error) {
              console.error(`バッチ ${Math.floor(i / batchSize) + 1} 保存エラー:`, error);
              failedBatches++;
              
              // 重複エラーの場合は警告として処理
              if (error.code === '23505') { // PostgreSQL unique violation
                console.warn(`バッチ ${Math.floor(i / batchSize) + 1}: 重複データがスキップされました`);
              } else {
                throw new Error(`データベースへの保存に失敗しました (バッチ ${Math.floor(i / batchSize) + 1}): ${error.message}`);
              }
            } else {
              savedCount += batch.length;
            }
          } catch (batchError) {
            console.error(`バッチ処理エラー:`, batchError);
            failedBatches++;
          }

          const progress = 60 + Math.round((i + batch.length) / newRecords.length * 25);
          setCsvImportProgress(progress);
          setCsvImportStatus(`データベースに保存中... (${Math.min(savedCount + failedBatches * batchSize, newRecords.length)}/${newRecords.length})`);
          
          // バッチ間の短い待機（データベース負荷軽減）
          if (i + batchSize < newRecords.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        if (failedBatches > 0) {
          console.warn(`${failedBatches}個のバッチで保存に失敗しました`);
        }
      }

      setCsvImportProgress(90);
      setCsvImportStatus('データを更新中...');

      // Supabaseが設定されている場合はデータベースから再読み込み
      if (isSupabaseConfigured()) {
        await loadMonthlyData(); // データベースから最新データを再読み込み
        await loadServiceRecords(); // 記録一覧も再読み込み
      } else {
        // メモリ内のデータを更新（Supabaseが設定されていない場合のみ）
        const updatedRecords = [...allRecords, ...newRecords];
        setAllRecords(updatedRecords);
        processMonthlyData(updatedRecords);
      }

      setCsvImportProgress(100);
      setCsvImportStatus('CSV取り込みが完了しました');

      // 詳細な結果表示
      const resultParts = [
        `✅ CSV取り込みが完了しました`,
        ``,
        `📊 処理結果:`,
        `・読み込み行数: ${parsedDataCount}行`,
        `・成功: ${validDataCount}件`,
        validationErrors.length > 0 ? `・エラー: ${validationErrors.length}件` : '',
        `・保存先: ${isSupabaseConfigured() ? 'データベース' : 'メモリ'}`,
      ].filter(Boolean);

      if (validationErrors.length > 0 && validationErrors.length <= 10) {
        resultParts.push('', '⚠️ エラー詳細:', ...validationErrors.map(err => `・${err}`));
      } else if (validationErrors.length > 10) {
        resultParts.push('', '⚠️ エラー詳細 (最初の10件):', ...validationErrors.slice(0, 10).map(err => `・${err}`));
        resultParts.push(`・...他${validationErrors.length - 10}件のエラー`);
      }

      alert(resultParts.join('\n'));

      // 状態をリセット
      setTimeout(() => {
        setCsvImportInProgress(false);
        setCsvImportProgress(0);
        setCsvImportStatus('');
        setShowCSVImportModal(false);
      }, 2000);

    } catch (error) {
      console.error('CSV取り込みエラー:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setCsvImportStatus(`❌ エラー: ${errorMessage}`);
      
      // エラーの詳細情報を含むメッセージ
      const errorDetails = [
        `CSV取り込みに失敗しました:`,
        ``,
        `❌ エラー: ${errorMessage}`,
        ``,
        `📊 処理状況:`,
        parsedDataCount > 0 ? `・読み込み済み: ${parsedDataCount}行` : '・ファイル読み込み段階で失敗',
        validDataCount > 0 ? `・検証済み: ${validDataCount}件` : '',
        validationErrors.length > 0 ? `・検証エラー: ${validationErrors.length}件` : ''
      ].filter(Boolean);

      alert(errorDetails.join('\n'));
      
      // 状態をリセット
      setTimeout(() => {
        setCsvImportInProgress(false);
        setCsvImportProgress(0);
        setCsvImportStatus('');
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  // 一括削除機能
  const handleBulkDelete = async () => {
    if (!confirm('取り込み済みのデータを一括削除しますか？この操作は元に戻せません。')) {
      return;
    }

    setDeleteInProgress(true);
    try {
      if (isSupabaseConfigured()) {
        // データベースから削除
        const { error } = await supabase
          .from('csv_service_records')
          .delete()
          .neq('id', ''); // 全件削除

        if (error) {
          throw new Error(`データベースからの削除に失敗しました: ${error.message}`);
        }

        // データを再読み込み
        await loadMonthlyData();
      } else {
        // メモリ内のデータをクリア
        setAllRecords([]);
        processMonthlyData([]);
      }

      alert('取り込み済みデータを一括削除しました');
      setShowDeleteConfirmModal(false);
    } catch (error) {
      console.error('一括削除エラー:', error);
      alert(`一括削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handlePatternAssign = async (recordId: string, patternId: string) => {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はメモリ内処理
        const updatedRecords = allRecords.map(record =>
          record.id === recordId
            ? {
                ...record,
                pattern_id: patternId,
                pattern_name: patterns.find(p => p.id === patternId)?.pattern_name || null,
                is_pattern_assigned: true
              }
            : record
        );
        
        setAllRecords(updatedRecords);
        processMonthlyData(updatedRecords);
        alert('パターンを紐付けました');
        return;
      }

      // Supabaseでパターン紐付け処理
      const selectedPattern = patterns.find(p => p.id === patternId);
      const { error } = await supabase
        .from('csv_service_records')
        .update({
          pattern_id: patternId,
          is_pattern_assigned: true
        })
        .eq('id', recordId);

      if (error) {
        throw error;
      }

      // データを再読み込みして変更を反映
      await loadMonthlyData();
      
      alert(`パターン「${selectedPattern?.pattern_name || 'Unknown'}」を紐付けました`);
    } catch (error) {
      console.error('パターン紐付けエラー:', error);
      alert(`パターンの紐付けに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };


  const handleRecordCreate = async (recordData: Partial<CSVServiceRecord>) => {
    try {
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はメモリ内処理
        const newRecord: CSVServiceRecord = {
          id: Date.now().toString(),
          user_name: recordData.user_name || '',
          user_code: recordData.user_code || '',
          staff_name: recordData.staff_name || '',
          service_date: recordData.service_date || format(new Date(), 'yyyy-MM-dd'),
          start_time: recordData.start_time || '09:00',
          end_time: recordData.end_time || '10:00',
          duration_minutes: recordData.duration_minutes || 60,
          service_content: recordData.service_content || '',
          pattern_id: null,
          pattern_name: null,
          record_created_at: new Date().toISOString(),
          print_datetime: null,
          is_pattern_assigned: false
        };

        const updatedRecords = [...allRecords, newRecord];
        setAllRecords(updatedRecords);
        processMonthlyData(updatedRecords);
        alert('記録を作成しました');
        setShowRecordCreateModal(false);
        return;
      }

      // Supabaseに新しい記録を挿入
      const newRecordData = {
        user_name: recordData.user_name || '',
        user_code: recordData.user_code || '',
        staff_name: recordData.staff_name || '',
        service_date: recordData.service_date || format(new Date(), 'yyyy-MM-dd'),
        start_time: recordData.start_time || '09:00',
        end_time: recordData.end_time || '10:00',
        duration_minutes: recordData.duration_minutes || 60,
        service_content: recordData.service_content || '',
        pattern_id: null,
        is_pattern_assigned: false,
        record_created_at: new Date().toISOString(),
        print_datetime: null
      };

      const { error } = await supabase
        .from('csv_service_records')
        .insert([newRecordData]);

      if (error) {
        throw error;
      }

      // データを再読み込みして変更を反映
      await loadMonthlyData();
      
      alert('記録を作成しました');
      setShowRecordCreateModal(false);
    } catch (error) {
      console.error('記録作成エラー:', error);
      alert(`記録の作成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (confirm('この記録を削除しますか？')) {
      try {
        if (!isSupabaseConfigured()) {
          // Supabaseが設定されていない場合はメモリ内処理
          const updatedRecords = allRecords.filter(record => record.id !== recordId);
          setAllRecords(updatedRecords);
          processMonthlyData(updatedRecords);
          alert('記録を削除しました');
          return;
        }

        // Supabaseから記録を削除
        const { error } = await supabase
          .from('csv_service_records')
          .delete()
          .eq('id', recordId);

        if (error) {
          throw error;
        }

        // データを再読み込みして変更を反映
        await loadMonthlyData();
        
        alert('記録を削除しました');
      } catch (error) {
        console.error('記録削除エラー:', error);
        alert(`記録の削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }
    }
  };

  const handleMonthlyDataDelete = async () => {
    if (!confirm(`${format(currentMonth, 'yyyy年MM月', { locale: ja })}のすべてのデータを削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      setDeleteInProgress(true);
      
      if (!isSupabaseConfigured()) {
        // Supabaseが設定されていない場合はメモリ内処理
        const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        
        const updatedRecords = allRecords.filter(record =>
          record.service_date < monthStart || record.service_date > monthEnd
        );
        
        setAllRecords(updatedRecords);
        processMonthlyData(updatedRecords);
        
        alert(`${format(currentMonth, 'yyyy年MM月', { locale: ja })}のデータを削除しました`);
        setShowDeleteConfirmModal(false);
        return;
      }

      // Supabaseから該当月のデータを削除
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { error, count } = await supabase
        .from('csv_service_records')
        .delete({ count: 'exact' })
        .gte('service_date', monthStart)
        .lte('service_date', monthEnd);

      if (error) {
        throw error;
      }

      // データを再読み込みして変更を反映
      await loadMonthlyData();
      
      alert(`${format(currentMonth, 'yyyy年MM月', { locale: ja })}のデータ（${count || 0}件）を削除しました`);
      setShowDeleteConfirmModal(false);
    } catch (error) {
      console.error('月別データ削除エラー:', error);
      alert(`データの削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const exportData = () => {
    // BOM付きUTF-8でCSVを作成（Excel対応）
    const csvContent = [
      ['利用者名', '利用者コード', '担当職員', 'サービス日', '開始時間', '終了時間', '時間(分)', 'サービス内容', 'パターン名', '紐付け状況', '作成日時'],
      ...filteredRecords.map(record => [
        record.user_name,
        record.user_code || '',
        record.staff_name,
        record.service_date,
        record.start_time,
        record.end_time,
        record.duration_minutes.toString(),
        record.service_content,
        record.pattern_name || '',
        record.is_pattern_assigned ? '紐付け済み' : '未紐付け',
        record.record_created_at ? format(new Date(record.record_created_at), 'yyyy-MM-dd HH:mm:ss') : ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // BOM付きUTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `monthly_data_${format(currentMonth, 'yyyy-MM')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    
    // 成功メッセージ
    alert(`${filteredRecords.length}件のデータをエクスポートしました。`);
  };

  const getStatusColor = (status: 'complete' | 'partial' | 'none') => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'none':
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = (status: 'complete' | 'partial' | 'none') => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4" />;
      case 'none':
        return <Clock className="h-4 w-4" />;
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 日別データ管理画面を表示する場合
  if (showDailyDataManagement && selectedDailyDate) {
    return (
      <DailyDataManagement
        selectedDate={selectedDailyDate}
        onDateChange={handleDailyDateChange}
        onBackToMonthly={handleBackToMonthly}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2
          className="text-2xl font-bold text-gray-900 flex items-center cursor-pointer select-none"
          onClick={handleTitleClick}
          title={showBulkPrintButton ? "裏機能有効" : `${titleClickCount}/5 クリック`}
        >
          <Calendar className="h-6 w-6 mr-2" />
          月別データ管理
        </h2>
        <div className="flex items-center space-x-2">
          {/* 表示モード切り替え */}
          <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-1" />
              カレンダー
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-1" />
              リスト
            </button>
            <button
              onClick={() => setViewMode('record-list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'record-list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-1" />
              記録一覧
            </button>
          </div>
          <button
            onClick={() => setShowCSVImportModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>CSV取り込み</span>
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>エクスポート</span>
          </button>
          <button
            onClick={() => setShowFilterModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>フィルター</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirmModal(true)}
            disabled={monthlyStats.totalRecords === 0}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              monthlyStats.totalRecords === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <Trash2 className="h-4 w-4" />
            <span>月別一括削除</span>
          </button>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">{monthlyStats.totalRecords}</div>
          <div className="text-sm text-gray-600">総記録数</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">{monthlyStats.assignedRecords}</div>
          <div className="text-sm text-gray-600">紐付け済み</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-red-600">{monthlyStats.unassignedRecords}</div>
          <div className="text-sm text-gray-600">未紐付け</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-purple-600">
            {monthlyStats.totalRecords > 0 ? Math.round((monthlyStats.assignedRecords / monthlyStats.totalRecords) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">紐付け率</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">{monthlyStats.completeDays}</div>
          <div className="text-sm text-gray-600">完了日</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-yellow-600">{monthlyStats.partialDays}</div>
          <div className="text-sm text-gray-600">部分完了日</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-gray-600">{monthlyStats.emptyDays}</div>
          <div className="text-sm text-gray-600">データなし</div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowRecordCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>個別記録作成</span>
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{viewMode === 'calendar' ? 'リスト表示' : 'カレンダー表示'}</span>
          </button>
        </div>
      </div>

      {/* 月間ナビゲーション */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900">
            {format(currentMonth, 'yyyy年MM月', { locale: ja })}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      {viewMode === 'calendar' ? (
        /* カレンダー表示 */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {/* 曜日ヘッダー */}
            {['月', '火', '水', '木', '金', '土', '日'].map((day) => (
              <div key={day} className="bg-gray-50 p-3 text-center font-medium text-gray-700">
                {day}
              </div>
            ))}

            {/* 日付セル */}
            {allDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayData = monthlyData[dateStr];
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={`bg-white p-3 min-h-24 border cursor-pointer hover:bg-gray-50 ${
                    isToday ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-medium ${
                      isToday ? 'text-indigo-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex items-center space-x-1">
                      {dayData && dayData.totalRecords > 0 && (
                        <>
                          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border ${
                            getStatusColor(dayData.status)
                          }`}>
                            {getStatusIcon(dayData.status)}
                            <span>{dayData.totalRecords}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayDetailView(dateStr);
                            }}
                            className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded"
                            title="日別詳細を表示"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {dayData && dayData.records.length > 0 && (
                    <div className="space-y-1">
                      {dayData.records.slice(0, 2).map((record) => (
                        <div
                          key={record.id}
                          className={`text-xs p-1 rounded ${
                            record.is_pattern_assigned
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <div className="font-medium">{record.start_time}</div>
                          <div className="truncate">{record.user_name}</div>
                        </div>
                      ))}
                      {dayData.records.length > 2 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayData.records.length - 2}件
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* リスト表示 */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              記録一覧 ({filteredRecords.length}件)
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredRecords.map((record) => (
              <div key={record.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="font-medium">{record.user_name}</span>
                        {record.user_code && (
                          <span className="ml-2 text-sm text-gray-500">({record.user_code})</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        <span>{record.service_date} {record.start_time}-{record.end_time}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        担当: {record.staff_name}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {record.service_content}
                    </div>
                    {record.is_pattern_assigned ? (
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Link className="h-3 w-3 mr-1" />
                          {record.pattern_name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Unlink className="h-3 w-3 mr-1" />
                          未紐付け
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedRecords([record]);
                        setShowPatternModal(true);
                      }}
                      className="p-1 text-indigo-600 hover:text-indigo-900"
                      title="パターン紐付け"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-1 text-red-600 hover:text-red-900"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 記録一覧表示 */
        <div className="space-y-6">
          {/* 裏機能説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900">一括記録印刷機能</h3>
                <p className="text-sm text-blue-700 mt-1">
                  この画面では、フィルターされた記録を一括で印刷できます。印刷時間は16-18時の範囲で自動設定され、
                  実際の業務フローを模擬します。個別記録の印刷は実時間で記録されます。
                </p>
              </div>
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
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">表示:</label>
                <select
                  value={recordTypeFilter}
                  onChange={(e) => setRecordTypeFilter(e.target.value as 'all' | 'schedule' | 'record')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="record">記録のみ</option>
                  <option value="schedule">予定のみ</option>
                  <option value="all">すべて</option>
                </select>
              </div>
              <div className="text-sm text-gray-500">
                {filteredServiceRecords.length} 件中 {filteredServiceRecords.length} 件表示
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>フィルター</span>
              </button>
              <button
                onClick={handleBulkPrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                disabled={filteredServiceRecords.length === 0}
                title="フィルターされた記録を一括印刷します（16-18時の時間帯で印刷日時が設定されます）"
              >
                <FileText className="h-4 w-4" />
                <span>一括記録印刷 ({filteredServiceRecords.length}件)</span>
              </button>
              <button
                onClick={exportServiceRecords}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>エクスポート</span>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <FileText className="h-3 w-3 mr-1" />
                裏機能モード
              </span>
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
                    value={recordListFilters.dateFrom}
                    onChange={(e) => handleRecordListFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    value={recordListFilters.dateTo}
                    onChange={(e) => handleRecordListFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">利用者名</label>
                  <input
                    type="text"
                    value={recordListFilters.userName}
                    onChange={(e) => handleRecordListFilterChange('userName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">担当職員</label>
                  <input
                    type="text"
                    value={recordListFilters.staffName}
                    onChange={(e) => handleRecordListFilterChange('staffName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearRecordListFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  フィルターをクリア
                </button>
              </div>
            </div>
          )}

          {/* 記録一覧テーブル */}
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
                  {filteredServiceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        記録がありません
                      </td>
                    </tr>
                  ) : (
                    filteredServiceRecords.map((record) => (
                      <tr key={record.id} className={`hover:bg-gray-50 ${record.is_schedule ? 'bg-blue-50' : 'bg-white'}`}>
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-1 ${
                              record.is_schedule
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {record.is_schedule ? '予定' : '記録'}
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
                              onClick={() => {
                                // ServiceRecordをPrintPreview用の形式に変換
                                const printableRecord = {
                                  ...record,
                                  record_created_at: record.created_at,
                                  service_content: record.service_content || record.service_type || ''
                                };
                                setPrintRecord(printableRecord as any);
                              }}
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
                              onClick={() => handleDeleteServiceRecord(record.id)}
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
        </div>
      )}

      {/* パターン紐付けモーダル */}
      {showPatternModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  パターン紐付け
                </h3>
                <button
                  onClick={() => setShowPatternModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* 一括操作 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">一括パターン割り当て</h4>
                <div className="flex flex-wrap gap-2">
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      onClick={() => {
                        selectedRecords.forEach(record => {
                          if (!record.is_pattern_assigned) {
                            handlePatternAssign(record.id, pattern.id);
                          }
                        });
                      }}
                      className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm hover:bg-indigo-200"
                    >
                      {pattern.pattern_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 個別記録一覧 */}
              <div className="space-y-3">
                {selectedRecords.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="font-medium">{record.user_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-1" />
                            <span>{record.start_time} - {record.end_time}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            担当: {record.staff_name}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {record.service_content}
                        </div>
                        {record.is_pattern_assigned && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {record.pattern_name}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {!record.is_pattern_assigned && (
                        <div className="flex-shrink-0 ml-4">
                          <select
                            onChange={(e) => handlePatternAssign(record.id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">パターンを選択</option>
                            {patterns.map((pattern) => (
                              <option key={pattern.id} value={pattern.id}>
                                {pattern.pattern_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowPatternModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV取り込みモーダル */}
      {showCSVImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  CSV取り込み
                </h3>
                <button
                  onClick={() => setShowCSVImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {csvImportInProgress ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">{csvImportStatus}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${csvImportProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{csvImportProgress}%</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    CSVファイルを選択してアップロードしてください。
                  </div>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCSVImport(file);
                        }
                      }}
                      className="hidden"
                      id="csv-file-input"
                    />
                    <label
                      htmlFor="csv-file-input"
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        クリックしてCSVファイルを選択
                      </span>
                      <span className="text-xs text-gray-500">
                        または、ファイルをここにドラッグ&ドロップ
                      </span>
                    </label>
                  </div>

                  <div className="text-xs text-gray-500">
                    <p className="font-medium mb-1">対応形式:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>CSV形式 (.csv)</li>
                      <li>UTF-8またはShift-JIS文字コード</li>
                      <li>ヘッダー行を含む形式</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowCSVImportModal(false);
                  setCsvImportInProgress(false);
                  setCsvImportProgress(0);
                  setCsvImportStatus('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィルターモーダル */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  フィルター設定
                </h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* ステータスフィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  紐付け状況
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as 'all' | 'assigned' | 'unassigned' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="all">すべて</option>
                  <option value="assigned">紐付け済み</option>
                  <option value="unassigned">未紐付け</option>
                </select>
              </div>

              {/* 利用者フィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  利用者名
                </label>
                <input
                  type="text"
                  value={filters.user}
                  onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
                  placeholder="利用者名で検索..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* 担当職員フィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  担当職員
                </label>
                <input
                  type="text"
                  value={filters.staff}
                  onChange={(e) => setFilters(prev => ({ ...prev, staff: e.target.value }))}
                  placeholder="担当職員名で検索..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* 日付範囲フィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日付範囲
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => {
                  setFilters({
                    status: 'all',
                    user: '',
                    staff: '',
                    dateRange: {
                      start: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
                      end: format(endOfMonth(currentMonth), 'yyyy-MM-dd')
                    }
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                リセット
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                適用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 個別記録作成モーダル */}
      {showRecordCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  個別記録作成
                </h3>
                <button
                  onClick={() => setShowRecordCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const recordData = {
                user_name: formData.get('user_name') as string,
                user_code: formData.get('user_code') as string,
                staff_name: formData.get('staff_name') as string,
                service_date: formData.get('service_date') as string,
                start_time: formData.get('start_time') as string,
                end_time: formData.get('end_time') as string,
                duration_minutes: parseInt(formData.get('duration_minutes') as string) || 60,
                service_content: formData.get('service_content') as string,
              };
              handleRecordCreate(recordData);
            }}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    利用者名 *
                  </label>
                  <input
                    type="text"
                    name="user_name"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="利用者名を入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    利用者コード
                  </label>
                  <input
                    type="text"
                    name="user_code"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="利用者コードを入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当職員 *
                  </label>
                  <input
                    type="text"
                    name="staff_name"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="担当職員名を入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    サービス日 *
                  </label>
                  <input
                    type="date"
                    name="service_date"
                    required
                    defaultValue={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時間 *
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      required
                      defaultValue="09:00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      終了時間 *
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      required
                      defaultValue="10:00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    時間（分）
                  </label>
                  <input
                    type="number"
                    name="duration_minutes"
                    defaultValue={60}
                    min={1}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    サービス内容 *
                  </label>
                  <textarea
                    name="service_content"
                    required
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="提供したサービス内容を入力"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordCreateModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 月別データ一括削除確認モーダル */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  月別データ一括削除
                </h3>
                <button
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={deleteInProgress}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-1">
                        重要な警告
                      </h4>
                      <p className="text-sm text-red-700">
                        この操作により、<strong>{format(currentMonth, 'yyyy年MM月', { locale: ja })}</strong>のすべてのデータが完全に削除されます。
                        この操作は取り消すことができません。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">削除対象データ</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">総記録数:</span>
                      <span className="font-medium ml-2">{monthlyStats.totalRecords}件</span>
                    </div>
                    <div>
                      <span className="text-gray-600">紐付け済み:</span>
                      <span className="font-medium ml-2">{monthlyStats.assignedRecords}件</span>
                    </div>
                    <div>
                      <span className="text-gray-600">未紐付け:</span>
                      <span className="font-medium ml-2">{monthlyStats.unassignedRecords}件</span>
                    </div>
                    <div>
                      <span className="text-gray-600">対象月:</span>
                      <span className="font-medium ml-2">{format(currentMonth, 'yyyy年MM月', { locale: ja })}</span>
                    </div>
                  </div>
                </div>

                {deleteInProgress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-sm text-blue-700">データを削除しています...</span>
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <p className="mb-2">削除を実行する前に、以下を確認してください：</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>必要なデータのバックアップが取得済みであること</li>
                    <li>削除対象の月が正しいこと</li>
                    <li>この操作が業務に影響しないこと</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={deleteInProgress}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleMonthlyDataDelete}
                disabled={deleteInProgress || monthlyStats.totalRecords === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {deleteInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>削除中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>削除実行</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 印刷プレビュー */}
      {printRecord && (
        <PrintPreview
          record={printRecord as any}
          onClose={() => setPrintRecord(null)}
        />
      )}

      {/* 一括印刷プレビュー */}
      {showBulkPrint && (
        <BulkPrintPreview
          records={filteredServiceRecords.map(record => ({
            ...record,
            record_created_at: record.created_at,
            service_content: record.service_content || record.service_type || ''
          })) as any}
          onClose={() => setShowBulkPrint(false)}
        />
      )}

    </div>
  );
}
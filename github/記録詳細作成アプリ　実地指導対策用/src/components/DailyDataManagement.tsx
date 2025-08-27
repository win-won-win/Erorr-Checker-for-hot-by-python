import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, User, Settings, CheckCircle, AlertCircle, XCircle,
  ChevronLeft, ChevronRight, Filter, Search, Link, Unlink, RotateCcw,
  Eye, Edit, Trash2, Plus, Download, Upload, BarChart3, Target,
  Zap, Users, Activity, TrendingUp, AlertTriangle
} from 'lucide-react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';

import {
  TimeSlotRecord,
  TimeSlot,
  DailyDataDetail,
  DailyDataStats,
  PatternLinkingCandidate,
  PatternLinkingResult,
  BulkPatternLinking,
  BulkOperationResult,
  UnlinkedDataAnalysis,
  DailyDataFilter,
  DailyDataManagementConfig
} from '../types/dailyData';

import { ServicePattern } from '../types/pattern';
import { patternService } from '../utils/patternService';
import { patternLinkingService } from '../utils/patternLinkingService';

interface DailyDataManagementProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
  onBackToMonthly?: () => void;
}

export function DailyDataManagement({ 
  selectedDate, 
  onDateChange, 
  onBackToMonthly 
}: DailyDataManagementProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [dailyData, setDailyData] = useState<DailyDataDetail | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyDataStats | null>(null);
  const [patterns, setPatterns] = useState<ServicePattern[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [patternCandidates, setPatternCandidates] = useState<PatternLinkingCandidate[]>([]);
  const [unlinkedAnalysis, setUnlinkedAnalysis] = useState<UnlinkedDataAnalysis | null>(null);
  
  // モーダル状態
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TimeSlotRecord | null>(null);
  
  // フィルター状態
  const [filters, setFilters] = useState<DailyDataFilter>({
    status: 'all',
    users: [],
    staff: [],
    patterns: [],
    time_range: { start_hour: 0, end_hour: 23 },
    confidence_range: { min: 0, max: 1 },
    service_types: []
  });
  
  // 表示設定
  const [viewMode, setViewMode] = useState<'timeline' | 'table' | 'user_grouped'>('timeline');
  const [showConfidenceScores, setShowConfidenceScores] = useState(true);
  const [highlightUnlinked, setHighlightUnlinked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<DailyDataManagementConfig | null>(null);

  useEffect(() => {
    loadDailyData();
    loadPatterns();
    loadConfig();
  }, [currentDate]);

  useEffect(() => {
    if (onDateChange) {
      onDateChange(currentDate);
    }
  }, [currentDate, onDateChange]);

  const loadDailyData = async () => {
    setLoading(true);
    try {
      // サンプルデータを生成（実際の実装ではAPIから取得）
      const sampleData = generateSampleDailyData(currentDate);
      setDailyData(sampleData);
      
      const stats = calculateDailyStats(sampleData);
      setDailyStats(stats);
      
      // 未紐付けデータの分析
      const unlinkedRecords = getAllRecords(sampleData).filter(r => !r.is_pattern_assigned);
      if (unlinkedRecords.length > 0) {
        const analysis = await patternLinkingService.analyzeUnlinkedData(unlinkedRecords);
        setUnlinkedAnalysis(analysis);
      }
    } catch (error) {
      console.error('日別データ読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const patternList = await patternService.listPatterns();
      setPatterns(patternList);
    } catch (error) {
      console.error('パターン読み込みエラー:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const currentConfig = patternLinkingService.getConfig();
      setConfig(currentConfig);
      setShowConfidenceScores(currentConfig.display.show_confidence_scores);
      setHighlightUnlinked(currentConfig.display.highlight_unlinked);
    } catch (error) {
      console.error('設定読み込みエラー:', error);
    }
  };

  const generateSampleDailyData = (date: string): DailyDataDetail => {
    const timeSlots: TimeSlot[] = [];
    
    // 24時間分のタイムスロットを生成
    for (let hour = 0; hour < 24; hour++) {
      const records: TimeSlotRecord[] = [];
      
      // サンプル記録を生成（実際の実装では外部データから取得）
      if (hour >= 8 && hour <= 18) { // 営業時間内のみ
        const sampleRecords = generateSampleRecords(date, hour);
        records.push(...sampleRecords);
      }
      
      const assignedCount = records.filter(r => r.is_pattern_assigned).length;
      const unassignedCount = records.length - assignedCount;
      
      timeSlots.push({
        hour,
        time_label: `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`,
        records,
        total_records: records.length,
        assigned_records: assignedCount,
        unassigned_records: unassignedCount,
        status: records.length === 0 ? 'none' : 
                assignedCount === records.length ? 'complete' : 'partial',
        suggested_patterns: []
      });
    }
    
    const allRecords = getAllRecords({ date, day_of_week: 0, time_slots: timeSlots } as DailyDataDetail);
    const assignedRecords = allRecords.filter(r => r.is_pattern_assigned);
    const users = [...new Set(allRecords.map(r => r.user_name))];
    const staff = [...new Set(allRecords.map(r => r.staff_name))];
    const patternsUsed = [...new Set(assignedRecords.map(r => r.pattern_id).filter(Boolean))];
    
    return {
      date,
      day_of_week: new Date(date).getDay(),
      time_slots: timeSlots,
      total_records: allRecords.length,
      assigned_records: assignedRecords.length,
      unassigned_records: allRecords.length - assignedRecords.length,
      completion_rate: allRecords.length > 0 ? (assignedRecords.length / allRecords.length) * 100 : 0,
      status: allRecords.length === 0 ? 'none' : 
              assignedRecords.length === allRecords.length ? 'complete' : 'partial',
      users,
      staff,
      patterns_used: patternsUsed as string[]
    };
  };

  const generateSampleRecords = (date: string, hour: number): TimeSlotRecord[] => {
    const records: TimeSlotRecord[] = [];
    const users = ['田中 花子', '山田 次郎', '佐藤 美香', '鈴木 一郎'];
    const staff = ['渡邉 由可里', '笠間 京子', '田中 太郎', '山田 花子'];
    const services = ['排泄介助', '食事介助', '入浴介助', '清拭', '服薬介助', '移乗介助', '清掃', '洗濯'];
    
    // 時間帯に応じてランダムに記録を生成
    const recordCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < recordCount; i++) {
      const startTime = `${hour.toString().padStart(2, '0')}:${(Math.floor(Math.random() * 4) * 15).toString().padStart(2, '0')}`;
      const endHour = hour + (Math.random() > 0.7 ? 1 : 0);
      const endTime = `${endHour.toString().padStart(2, '0')}:${(Math.floor(Math.random() * 4) * 15).toString().padStart(2, '0')}`;
      
      records.push({
        id: `${date}-${hour}-${i}`,
        user_name: users[Math.floor(Math.random() * users.length)],
        user_code: `U${(Math.floor(Math.random() * 999) + 1).toString().padStart(3, '0')}`,
        staff_name: staff[Math.floor(Math.random() * staff.length)],
        start_time: startTime,
        end_time: endTime,
        duration_minutes: 60,
        service_content: services[Math.floor(Math.random() * services.length)],
        pattern_id: Math.random() > 0.4 ? `pattern-${Math.floor(Math.random() * 3) + 1}` : null,
        pattern_name: Math.random() > 0.4 ? `パターン${Math.floor(Math.random() * 3) + 1}` : null,
        is_pattern_assigned: Math.random() > 0.4,
        record_created_at: new Date().toISOString(),
        print_datetime: null,
        confidence_score: Math.random() > 0.4 ? Math.random() * 0.4 + 0.6 : undefined,
        auto_assigned: Math.random() > 0.7
      });
    }
    
    return records;
  };

  const getAllRecords = (dailyData: DailyDataDetail): TimeSlotRecord[] => {
    return dailyData.time_slots.flatMap(slot => slot.records);
  };

  const calculateDailyStats = (dailyData: DailyDataDetail): DailyDataStats => {
    const allRecords = getAllRecords(dailyData);
    const patternCounts = new Map<string, { name: string; count: number }>();
    
    allRecords.forEach(record => {
      if (record.pattern_id && record.pattern_name) {
        const current = patternCounts.get(record.pattern_id) || { name: record.pattern_name, count: 0 };
        patternCounts.set(record.pattern_id, { ...current, count: current.count + 1 });
      }
    });
    
    const patternDistribution = Array.from(patternCounts.entries()).map(([pattern_id, data]) => ({
      pattern_id,
      pattern_name: data.name,
      count: data.count,
      percentage: (data.count / allRecords.length) * 100
    }));
    
    // ピーク時間を計算
    const hourCounts = dailyData.time_slots.map(slot => ({ hour: slot.hour, count: slot.total_records }));
    const peakHour = hourCounts.reduce((max, current) => current.count > max.count ? current : max, { hour: 0, count: 0 }).hour;
    
    return {
      date: dailyData.date,
      total_records: dailyData.total_records,
      assigned_records: dailyData.assigned_records,
      unassigned_records: dailyData.unassigned_records,
      completion_rate: dailyData.completion_rate,
      unique_users: dailyData.users.length,
      unique_staff: dailyData.staff.length,
      unique_patterns: dailyData.patterns_used.length,
      peak_hour: peakHour,
      pattern_distribution: patternDistribution
    };
  };

  const handleRecordSelect = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handlePatternAssign = async (recordId: string, patternId: string) => {
    try {
      const result = await patternLinkingService.linkPattern(recordId, patternId, 'manual');
      if (result.success) {
        await loadDailyData(); // データを再読み込み
        alert('パターンを紐付けました');
      } else {
        alert(`紐付けに失敗しました: ${result.error_message}`);
      }
    } catch (error) {
      console.error('パターン紐付けエラー:', error);
      alert('パターンの紐付けに失敗しました');
    }
  };

  const handlePatternUnlink = async (recordId: string) => {
    try {
      const result = await patternLinkingService.unlinkPattern(recordId);
      if (result.success) {
        await loadDailyData(); // データを再読み込み
        alert('パターンの紐付けを解除しました');
      } else {
        alert(`紐付け解除に失敗しました: ${result.error_message}`);
      }
    } catch (error) {
      console.error('パターン紐付け解除エラー:', error);
      alert('パターンの紐付け解除に失敗しました');
    }
  };

  const handleBulkOperation = async (operation: BulkPatternLinking) => {
    try {
      const result = await patternLinkingService.bulkLinkPatterns(operation);
      await loadDailyData(); // データを再読み込み
      alert(`一括操作が完了しました。成功: ${result.successful}件、失敗: ${result.failed}件`);
      setSelectedRecords([]);
      setShowBulkModal(false);
    } catch (error) {
      console.error('一括操作エラー:', error);
      alert('一括操作に失敗しました');
    }
  };

  const handleAutoLink = async () => {
    if (!dailyData) return;
    
    try {
      const allRecords = getAllRecords(dailyData);
      const result = await patternLinkingService.autoLinkPatterns(allRecords);
      await loadDailyData(); // データを再読み込み
      alert(`自動紐付けが完了しました。紐付け済み: ${result.successful}件`);
    } catch (error) {
      console.error('自動紐付けエラー:', error);
      alert('自動紐付けに失敗しました');
    }
  };

  const handleShowPatternCandidates = async (record: TimeSlotRecord) => {
    try {
      const candidates = await patternLinkingService.getPatternCandidates(record);
      setPatternCandidates(candidates);
      setSelectedRecord(record);
      setShowPatternModal(true);
    } catch (error) {
      console.error('パターン候補取得エラー:', error);
      alert('パターン候補の取得に失敗しました');
    }
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
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredTimeSlots = dailyData?.time_slots.filter(slot => {
    if (filters.time_range.start_hour > slot.hour || filters.time_range.end_hour < slot.hour) {
      return false;
    }
    
    if (filters.status === 'assigned' && slot.assigned_records === 0) return false;
    if (filters.status === 'unassigned' && slot.unassigned_records === 0) return false;
    
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!dailyData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">データが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {onBackToMonthly && (
            <button
              onClick={onBackToMonthly}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Calendar className="h-6 w-6 mr-2" />
            日別データ管理
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowStatsModal(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>統計</span>
          </button>
          <button
            onClick={handleAutoLink}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>自動紐付け</span>
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 日付ナビゲーション */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <button
          onClick={() => setCurrentDate(format(subDays(parseISO(currentDate), 1), 'yyyy-MM-dd'))}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {format(parseISO(currentDate), 'yyyy年MM月dd日 (E)', { locale: ja })}
          </h3>
          <div className="flex items-center justify-center space-x-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-1 ${getStatusColor(dailyData.status).replace('text-', 'bg-').replace('border-', '').replace('bg-', 'bg-')}`}></div>
              {dailyData.status === 'complete' ? '完了' : dailyData.status === 'partial' ? '部分完了' : '未完了'}
            </span>
            <span>記録数: {dailyData.total_records}</span>
            <span>紐付け率: {dailyData.completion_rate.toFixed(1)}%</span>
          </div>
        </div>
        
        <button
          onClick={() => setCurrentDate(format(addDays(parseISO(currentDate), 1), 'yyyy-MM-dd'))}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 操作バー */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-2 rounded-lg ${viewMode === 'timeline' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Clock className="h-4 w-4 inline mr-1" />
            時間軸
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-2 rounded-lg ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <BarChart3 className="h-4 w-4 inline mr-1" />
            テーブル
          </button>
          <button
            onClick={() => setViewMode('user_grouped')}
            className={`px-3 py-2 rounded-lg ${viewMode === 'user_grouped' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            利用者別
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedRecords.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2"
            >
              <Target className="h-4 w-4" />
              <span>一括操作 ({selectedRecords.length})</span>
            </button>
          )}
          <button
            onClick={() => setShowFilterModal(true)}
            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>フィルター</span>
          </button>
        </div>
      </div>

      {/* 未紐付けアラート */}
      {unlinkedAnalysis && unlinkedAnalysis.analysis.total_unlinked > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800 font-medium">
              {unlinkedAnalysis.analysis.total_unlinked}件の未紐付けデータがあります
            </span>
          </div>
          <div className="mt-2 text-sm text-yellow-700">
            自動紐付けまたは手動でパターンを紐付けしてください。
          </div>
        </div>
      )}

      {/* メインコンテンツ - タイムライン表示 */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {filteredTimeSlots.map((slot) => (
            <div key={slot.hour} className="bg-white rounded-lg shadow">
              <div className={`p-4 border-l-4 ${
                slot.status === 'complete' ? 'border-green-500' :
                slot.status === 'partial' ? 'border-yellow-500' : 'border-gray-300'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-lg font-semibold text-gray-900">{slot.time_label}</h4>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(slot.status)}`}>
                      {getStatusIcon(slot.status)}
                      <span className="ml-1">
                        {slot.status === 'complete' ? '完了' : 
                         slot.status === 'partial' ? '部分完了' : '記録なし'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    記録数: {slot.total_records} | 紐付け済み: {slot.assigned_records} | 未紐付け: {slot.unassigned_records}
                  </div>
                </div>
                
                {slot.records.length > 0 && (
                  <div className="space-y-2">
                    {slot.records.map((record) => (
                      <div
                        key={record.id}
                        className={`p-3 rounded-lg border ${
                          selectedRecords.includes(record.id) ? 'border-indigo-500 bg-indigo-50' :
                          !record.is_pattern_assigned && highlightUnlinked ? 'border-red-200 bg-red-50' :
                          'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(record.id)}
                              onChange={() => handleRecordSelect(record.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-gray-900">{record.user_name}</span>
                                <span className="text-sm text-gray-500">({record.user_code})</span>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                担当: {record.staff_name} | {record.start_time}-{record.end_time} | {record.service_content}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {record.is_pattern_assigned ? (
                              <div className="flex items-center space-x-2">
                                <div className="text-sm">
                                  <span className="text-green-600 font-medium">{record.pattern_name}</span>
                                  {showConfidenceScores && record.confidence_score && (
                                    <span className={`ml-2 ${getConfidenceColor(record.confidence_score)}`}>
                                      ({(record.confidence_score * 100).toFixed(0)}%)
                                    </span>
                                  )}
                                  {record.auto_assigned && (
                                    <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-1 py-0.5 rounded">自動</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handlePatternUnlink(record.id)}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                                >
                                  <Unlink className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-red-600 font-medium">未紐付け</span>
                                <button
                                  onClick={() => handleShowPatternCandidates(record)}
                                  className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded"
                                >
                                  <Link className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* パターン候補モーダル */}
      {showPatternModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">パターン候補</h3>
              <button
                onClick={() => setShowPatternModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">対象記録</div>
              <div className="font-medium">{selectedRecord.user_name} - {selectedRecord.service_content}</div>
              <div className="text-sm text-gray-500">{selectedRecord.start_time}-{selectedRecord.end_time}</div>
            </div>
            
            <div className="space-y-3">
              {patternCandidates.map((candidate) => (
                <div key={candidate.pattern.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{candidate.pattern.pattern_name}</h4>
                      <p className="text-sm text-gray-600">{candidate.pattern.description}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getConfidenceColor(candidate.confidence)}`}>
                        信頼度: {(candidate.confidence * 100).toFixed(0)}%
                      </div>
                      {candidate.auto_apply_eligible && (
                        <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded mt-1">
                          自動適用可能
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    理由: {candidate.reason}
                  </div>
                  
                  <button
                    onClick={() => {
                      handlePatternAssign(selectedRecord.id, candidate.pattern.id);
                      setShowPatternModal(false);
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    このパターンを適用
                  </button>
                </div>
              ))}
              
              {patternCandidates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  適用可能なパターンが見つかりませんでした
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 統計モーダル */}
      {showStatsModal && dailyStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">日別統計</h3>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-blue-600 text-sm font-medium">総記録数</div>
                <div className="text-2xl font-bold text-blue-900">{dailyStats.total_records}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-green-600 text-sm font-medium">紐付け済み</div>
                <div className="text-2xl font-bold text-green-900">{dailyStats.assigned_records}</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-red-600 text-sm font-medium">未紐付け</div>
                <div className="text-2xl font-bold text-red-900">{dailyStats.unassigned_records}</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-purple-600 text-sm font-medium">完了率</div>
                <div className="text-2xl font-bold text-purple-900">{dailyStats.completion_rate.toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">パターン使用状況</h4>
                <div className="space-y-2">
                  {dailyStats.pattern_distribution.map((pattern) => (
                    <div key={pattern.pattern_id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-900">{pattern.pattern_name}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">{pattern.count}件</span>
                        <span className="text-xs text-gray-500 ml-2">({pattern.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">その他の統計</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">利用者数</span>
                    <span className="text-sm font-medium text-gray-900">{dailyStats.unique_users}人</span>
                  </div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">担当職員数</span>
                    <span className="text-sm font-medium text-gray-900">{dailyStats.unique_staff}人</span>
                  </div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">使用パターン数</span>
                    <span className="text-sm font-medium text-gray-900">{dailyStats.unique_patterns}種類</span>
                  </div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">ピーク時間</span>
                    <span className="text-sm font-medium text-gray-900">{dailyStats.peak_hour}:00-{dailyStats.peak_hour + 1}:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 一括操作モーダル */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">一括操作</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                選択された{selectedRecords.length}件の記録に対して操作を実行します。
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  const operation: BulkPatternLinking = {
                    operation: 'unassign',
                    record_ids: selectedRecords,
                    force_apply: false,
                    backup_original: true
                  };
                  handleBulkOperation(operation);
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                一括紐付け解除
              </button>
              
              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  パターンを選択して一括紐付け
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
                  onChange={(e) => {
                    if (e.target.value) {
                      const operation: BulkPatternLinking = {
                        operation: 'assign',
                        record_ids: selectedRecords,
                        pattern_id: e.target.value,
                        force_apply: false,
                        backup_original: true
                      };
                      handleBulkOperation(operation);
                    }
                  }}
                >
                  <option value="">パターンを選択...</option>
                  {patterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.pattern_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
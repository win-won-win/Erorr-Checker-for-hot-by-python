import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Settings, Brain, Clock, TrendingUp } from 'lucide-react';
import { parseSimplifiedCSV, validateSimplifiedCSVData, SimplifiedServiceData } from '../utils/csvParser';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { timeStringToDate, generateRecordTime } from '../utils/recordTimeGenerator';

interface ServicePattern {
  id: string;
  pattern_name: string;
  pattern_details: any;
  description: string;
}

export function CSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<SimplifiedServiceData[]>([]);
  const [patterns, setPatterns] = useState<ServicePattern[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<{ [key: number]: string }>({});
  const [savedPatternMappings, setSavedPatternMappings] = useState<{ [key: string]: string }>({});
  const [userTimePatterns, setUserTimePatterns] = useState<{ [key: string]: string }>({});
  const [userTimeGroups, setUserTimeGroups] = useState<Array<{
    key: string;
    userName: string;
    timeRange: string;
    count: number;
    suggestedPattern?: string;
    confidence?: number;
  }>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'pattern' | 'result'>('upload');
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [patternStats, setPatternStats] = useState<{
    totalRemembered: number;
    autoApplied: number;
    needsReview: number;
  }>({ totalRemembered: 0, autoApplied: 0, needsReview: 0 });

  useEffect(() => {
    // ローカルストレージからパターンマッピングを読み込み
    const savedMappings = localStorage.getItem('csvImportPatternMappings');
    if (savedMappings) {
      try {
        setSavedPatternMappings(JSON.parse(savedMappings));
      } catch (error) {
        console.error('保存されたパターンマッピングの読み込みエラー:', error);
      }
    }

    // サンプルパターンを設定
    setPatterns([
      {
        id: '1',
        pattern_name: '排泄介助＋食事介助',
        pattern_details: {},
        description: '排泄介助と食事介助を組み合わせた基本的なケアパターン'
      },
      {
        id: '2',
        pattern_name: '入浴介助＋水分補給',
        pattern_details: {},
        description: '入浴介助と水分補給を中心としたケアパターン'
      },
      {
        id: '3',
        pattern_name: '清拭＋服薬介助',
        pattern_details: {},
        description: '清拭と服薬介助を組み合わせたケアパターン'
      }
    ]);
  }, []);

  // 時間の類似度を計算（分単位）
  const calculateTimeSimilarity = (time1: string, time2: string): number => {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;
    const diff = Math.abs(minutes1 - minutes2);
    
    // 30分以内なら高い類似度、それ以降は急激に下がる
    if (diff <= 15) return 1.0;
    if (diff <= 30) return 0.8;
    if (diff <= 60) return 0.5;
    return 0.2;
  };

  // 保存されたパターンから最適なパターンを推測
  const suggestPatternForUserTime = (userName: string, startTime: string, endTime: string): {
    patternId: string;
    confidence: number;
  } | null => {
    const exactKey = `${userName}_${startTime}-${endTime}`;
    
    // 完全一致があればそれを使用
    if (savedPatternMappings[exactKey]) {
      return { patternId: savedPatternMappings[exactKey], confidence: 1.0 };
    }

    // 類似時間のパターンを検索
    let bestMatch: { patternId: string; confidence: number } | null = null;
    
    Object.entries(savedPatternMappings).forEach(([key, patternId]) => {
      const [savedUserName, savedTimeRange] = key.split('_');
      if (savedUserName === userName) {
        const [savedStart, savedEnd] = savedTimeRange.split('-');
        const startSimilarity = calculateTimeSimilarity(startTime, savedStart);
        const endSimilarity = calculateTimeSimilarity(endTime, savedEnd);
        const confidence = (startSimilarity + endSimilarity) / 2;
        
        if (confidence > 0.7 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { patternId, confidence };
        }
      }
    });

    return bestMatch;
  };
  // パターンマッピングをローカルストレージに保存
  const savePatternMappings = (mappings: { [key: string]: string }) => {
    localStorage.setItem('csvImportPatternMappings', JSON.stringify(mappings));
    setSavedPatternMappings(mappings);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    try {
      const parsedData = await parseSimplifiedCSV(selectedFile);
      const { valid, errors } = validateSimplifiedCSVData(parsedData);
      
      if (errors.length > 0) {
        alert(`CSVデータにエラーがあります:\n${errors.join('\n')}`);
        return;
      }

      setCsvData(valid);
      setStep('preview');
    } catch (error) {
      console.error('CSVパースエラー:', error);
      alert('CSVファイルの読み込みに失敗しました');
    }
  };

  const applyRememberedPatterns = (data: SimplifiedServiceData[]) => {
    const newUserTimePatterns: { [key: string]: string } = {};
    const newSelectedPatterns: { [key: number]: string } = {};
    const groups = new Map<string, { userName: string; timeRange: string; count: number; indices: number[] }>();
    let autoAppliedCount = 0;
    let needsReviewCount = 0;
    
    data.forEach((row, index) => {
      const key = `${row.userName}_${row.startTime}-${row.endTime}`;
      const groupKey = `${row.userName}_${row.startTime}-${row.endTime}`;
      
      // グループ化
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          userName: row.userName,
          timeRange: `${row.startTime}-${row.endTime}`,
          count: 0,
          indices: []
        });
      }
      const group = groups.get(groupKey)!;
      group.count++;
      group.indices.push(index);
    });

    // グループごとにパターンを推測・適用
    const groupsArray = Array.from(groups.entries()).map(([key, group]) => {
      const [userName, timeRange] = key.split('_');
      const [startTime, endTime] = timeRange.split('-');
      
      let suggestedPattern: string | undefined;
      let confidence: number | undefined;
      
      if (autoApplyEnabled) {
        const suggestion = suggestPatternForUserTime(userName, startTime, endTime);
        if (suggestion) {
          suggestedPattern = suggestion.patternId;
          confidence = suggestion.confidence;
          
          // 高い信頼度（0.9以上）なら自動適用
          if (confidence >= 0.9) {
            newUserTimePatterns[key] = suggestedPattern;
            group.indices.forEach(idx => {
              newSelectedPatterns[idx] = suggestedPattern;
            });
            autoAppliedCount += group.count;
          } else {
            needsReviewCount += group.count;
          }
        } else {
          needsReviewCount += group.count;
        }
      }
      
      return {
        key,
        userName: group.userName,
        timeRange: group.timeRange,
        count: group.count,
        suggestedPattern,
        confidence
      };
    });

    setUserTimeGroups(groupsArray);
    setUserTimePatterns(newUserTimePatterns);
    setSelectedPatterns(newSelectedPatterns);
    setPatternStats({
      totalRemembered: Object.keys(savedPatternMappings).length,
      autoApplied: autoAppliedCount,
      needsReview: needsReviewCount
    });
  };

  // 推奨パターンを一括適用
  const applyAllSuggestions = () => {
    const newUserTimePatterns = { ...userTimePatterns };
    const newSelectedPatterns = { ...selectedPatterns };
    const newMappings = { ...savedPatternMappings };
    
    userTimeGroups.forEach(group => {
      if (group.suggestedPattern && group.confidence && group.confidence >= 0.7) {
        newUserTimePatterns[group.key] = group.suggestedPattern;
        newMappings[group.key] = group.suggestedPattern;
        
        // 該当する個別選択も更新
        csvData.forEach((row, index) => {
          const key = `${row.userName}_${row.startTime}-${row.endTime}`;
          if (key === group.key) {
            newSelectedPatterns[index] = group.suggestedPattern!;
          }
        });
      }
    });
    
    setUserTimePatterns(newUserTimePatterns);
    setSelectedPatterns(newSelectedPatterns);
    savePatternMappings(newMappings);
    
    // 統計を更新
    const autoApplied = userTimeGroups.reduce((sum, group) => {
      return sum + (group.suggestedPattern && group.confidence && group.confidence >= 0.7 ? group.count : 0);
    }, 0);
    
    setPatternStats(prev => ({
      ...prev,
      autoApplied,
      needsReview: csvData.length - autoApplied
    }));
  };

  const handlePatternSelect = (index: number, patternId: string) => {
    setSelectedPatterns(prev => ({
      ...prev,
      [index]: patternId
    }));
  };

  const handleUserTimePatternSelect = (userTimeKey: string, patternId: string) => {
    setUserTimePatterns(prev => ({
      ...prev,
      [userTimeKey]: patternId
    }));

    // パターンマッピングを保存
    const newMappings = {
      ...savedPatternMappings,
      [userTimeKey]: patternId
    };
    savePatternMappings(newMappings);

    // 該当する個別選択も更新
    const newSelectedPatterns: { [key: number]: string } = { ...selectedPatterns };
    csvData.forEach((row, index) => {
      const key = `${row.userName}_${row.startTime}-${row.endTime}`;
      if (key === userTimeKey) {
        newSelectedPatterns[index] = patternId;
      }
    });
    setSelectedPatterns(newSelectedPatterns);
  };

  const handleBulkPatternSelect = (patternId: string) => {
    const newSelections: { [key: number]: string } = {};
    csvData.forEach((_, index) => {
      newSelections[index] = patternId;
    });
    setSelectedPatterns(newSelections);
  };

  const handleBulkUserTimePatternSelect = (patternId: string) => {
    const newUserTimePatterns: { [key: string]: string } = {};
    const newMappings = { ...savedPatternMappings };
    
    userTimeGroups.forEach(group => {
      newUserTimePatterns[group.key] = patternId;
      newMappings[group.key] = patternId;
    });
    setUserTimePatterns(newUserTimePatterns);
    savePatternMappings(newMappings);

    // 個別選択も更新
    const newSelectedPatterns: { [key: number]: string } = {};
    csvData.forEach((row, index) => {
      const key = `${row.userName}_${row.startTime}-${row.endTime}`;
      if (newUserTimePatterns[key]) {
        newSelectedPatterns[index] = newUserTimePatterns[key];
      }
    });
    setSelectedPatterns(newSelectedPatterns);
  };

  const executeImport = async () => {
    setImporting(true);
    setImportResult(null);
    
    // 進捗表示用の状態
    const [progress, setProgress] = useState(0);

    try {
      if (!isSupabaseConfigured()) {
        // デモモード用の高速処理シミュレーション
        for (let i = 0; i <= 100; i += 10) {
          setProgress(i);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        setImportResult({ 
          success: csvData.length, 
          errors: [] 
        });
        setStep('result');
        setImporting(false);
        alert('デモモード: CSVデータの処理をシミュレートしました。');
        return;
      }

      let successCount = 0;
      const errors: string[] = [];
      const batchSize = 100; // バッチサイズを100件に設定
      const totalBatches = Math.ceil(csvData.length / batchSize);

      // バッチ処理で高速化
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, csvData.length);
        const batch = csvData.slice(startIndex, endIndex);
        
        // 進捗更新
        const progressPercent = Math.round((batchIndex / totalBatches) * 100);
        setProgress(progressPercent);

        // バッチ用のデータ準備
        const batchInsertData = [];
        const batchUserNames = new Set();
        const batchStaffNames = new Set();

        for (const row of batch) {
          batchUserNames.add(row.userName);
          batchStaffNames.add(row.staffName);
          
          // 記録作成時間を生成
          const serviceStart = timeStringToDate(row.serviceDate, row.startTime);
          const serviceEnd = timeStringToDate(row.serviceDate, row.endTime);
          const recordCreatedAt = generateRecordTime(serviceStart, serviceEnd);
          const printDateTime = generatePrintTime(serviceStart);
          
          // 時間の差を分で計算
          const durationMinutes = Math.round((serviceEnd.getTime() - serviceStart.getTime()) / (1000 * 60));
          
          // 一言コメントをランダム選択
          const commentGroup = selectCommentGroup();
          const specialNotes = getRandomComment(commentGroup);

          batchInsertData.push({
            user_name: row.userName,
            staff_name: row.staffName,
            service_date: row.serviceDate,
            start_time: row.startTime,
            end_time: row.endTime,
            duration_minutes: durationMinutes,
            service_content: row.serviceContent,
            special_notes: specialNotes,
            record_created_at: recordCreatedAt.toISOString(),
            print_datetime: printDateTime.toISOString(),
            service_details: {},
            is_manually_created: false,
            csv_import_batch_id: `batch_${Date.now()}_${batchIndex}`
          });
        }

        try {
          // 利用者の一括作成・取得
          const userPromises = Array.from(batchUserNames).map(async (userName) => {
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('name', userName)
              .single();
              
            if (!existingUser) {
              await supabase
                .from('users')
                .insert({ name: userName });
            }
          });

          // 職員の一括作成・取得
          const staffPromises = Array.from(batchStaffNames).map(async (staffName) => {
            const { data: existingStaff } = await supabase
              .from('staff')
              .select('id')
              .eq('name', staffName)
              .single();
              
            if (!existingStaff) {
              await supabase
                .from('staff')
                .insert({ name: staffName });
            }
          });

          // 利用者・職員の作成を並行実行
          await Promise.all([...userPromises, ...staffPromises]);

          // CSV記録の一括挿入（upsert使用）
          const { error: batchError } = await supabase
            .from('csv_service_records')
            .upsert(batchInsertData, {
              onConflict: 'user_name,staff_name,service_date,start_time,end_time',
              ignoreDuplicates: false
            });

          if (batchError) {
            errors.push(`バッチ ${batchIndex + 1}: ${batchError.message}`);
          } else {
            successCount += batch.length;
          }

        } catch (error) {
          errors.push(`バッチ ${batchIndex + 1}: 処理エラー - ${error}`);
        }
        
        // 短い待機時間でUI更新
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 最終進捗更新
      setProgress(100);

      // インポートログの記録
      await supabase
        .from('csv_import_logs')
        .insert({
          filename: file?.name || 'unknown',
          import_count: csvData.length,
          success_count: successCount,
          error_count: errors.length,
        });

      setImportResult({ success: successCount, errors });
      setStep('result');
    } catch (error) {
      console.error('インポートエラー:', error);
      setImportResult({ 
        success: 0, 
        errors: ['データベース接続エラー: Supabaseの設定を確認してください'] 
      });
      setStep('result');
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  // ヘルパー関数
  const selectCommentGroup = () => {
    const random = Math.random() * 100;
    
    if (random <= 60) return '普通系';      // 60%
    if (random <= 80) return '体調がいい系';   // 20%
    if (random <= 95) return 'その他';     // 15%
    return '体調が悪い系';                    // 5%
  };
  
  const getRandomComment = (group: string) => {
    const comments = {
      '普通系': ['体調に変化なし', '普段通りです', '安定しています'],
      '体調がいい系': ['体調良好です', '元気にお過ごしです', '調子が良いです'],
      'その他': ['様子を見守ります', '継続観察中です', '変化があれば報告します'],
      '体調が悪い系': ['体調に注意が必要', '様子を見ています', '経過観察中']
    };
    const groupComments = comments[group] || comments['普通系'];
    return groupComments[Math.floor(Math.random() * groupComments.length)];
  };
  
  const generatePrintTime = (serviceDate: Date): Date => {
    const baseDate = new Date(serviceDate);
    const daysToAdd = Math.floor(Math.random() * 7) + 1;
    const printDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    const hour = Math.floor(Math.random() * 9) + 9;
    const minute = Math.floor(Math.random() * 60);
    
    printDate.setHours(hour, minute, 0, 0);
    return printDate;
  };

  const resetImport = () => {
    setFile(null);
    setCsvData([]);
    setSelectedPatterns({});
    setUserTimePatterns({});
    setUserTimeGroups([]);
    setImportResult(null);
    setStep('upload');
  };

  const clearPatternMemory = () => {
    if (confirm('保存されたパターン設定をすべてクリアしますか？')) {
      localStorage.removeItem('csvImportPatternMappings');
      setSavedPatternMappings({});
      setUserTimePatterns({});
      setSelectedPatterns({});
      alert('パターン設定をクリアしました');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          CSV一括インポート（予定＋記録同時作成）
        </h2>

        {step === 'upload' && (
          <div className="space-y-4">
            {/* 学習機能の説明 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                スマート学習機能
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>利用者・時間パターンを自動学習・記憶</li>
                <li>類似時間帯のパターンを自動推測（±30分以内）</li>
                <li>高信頼度パターンは自動適用（手動確認不要）</li>
                <li>毎月のインポート作業を大幅効率化</li>
              </ul>
              {patternStats.totalRemembered > 0 && (
                <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                  <p className="text-xs text-blue-700">
                    💾 学習済みパターン: {patternStats.totalRemembered}件
                  </p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">機能説明</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>CSVデータから予定とサービス実施記録を同時に作成</li>
                <li>重複する予定・記録は自動で検出・更新</li>
                <li>記録作成時間は確率分布に基づいて自動生成</li>
                <li>利用者・職員情報も自動で作成・更新</li>
              </ul>
            </div>
            
            {/* 自動適用設定 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">自動パターン適用</h4>
                  <p className="text-xs text-gray-600">学習したパターンを自動で適用します</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoApplyEnabled}
                    onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">有効</span>
                </label>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="csv-file" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      CSVファイルを選択してください
                    </span>
                    <input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="sr-only"
                    />
                    <span className="mt-1 block text-sm text-gray-500">
                      サービス提供実績データのCSVファイル（Shift-JIS対応）
                    </span>
                  </label>
                  <div className="mt-2 text-xs text-gray-400">
                    <p>対応形式: 令和07年07月01日 (火) 形式の日付</p>
                    <p>文字コード: Shift-JIS / UTF-8</p>
                    <p>処理内容: 予定作成 → 記録作成 → パターン適用</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-medium text-gray-900">
                データプレビュー ({csvData.length}件)
              </h3>
              <button
                onClick={executeImport}
                disabled={importing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {importing ? 'データベースに保存中...' : 'データベースに保存'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日付
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      利用者名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      担当職員
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      サービス内容
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.serviceDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.startTime} - {row.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.staffName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.serviceContent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">
                  ...他 {csvData.length - 10} 件
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">インポート結果</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">
                    成功: {importResult.success} 件
                  </span>
                </div>
              </div>
              
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-sm font-medium text-red-800">
                      エラー: {importResult.errors.length} 件
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">次のステップ</h4>
              <p className="text-sm text-blue-800">
                CSVデータをデータベースに保存しました。<br/>
                「月別データ管理」タブでパターン紐付けを行ってください。
              </p>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2">エラー詳細</h4>
                <div className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                  {importResult.errors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">次のステップ</h4>
              <p className="text-sm text-blue-700">
                データの保存が完了しました。「月別データ管理」タブでパターンの紐付けを行ってください。
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={resetImport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                新しいCSVを取り込む
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
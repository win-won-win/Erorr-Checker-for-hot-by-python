import Papa from 'papaparse';
import {
  normalizeName as advancedNormalizeName,
  matchNames,
  findBestMatch,
  NameMatchResult
} from './nameNormalizer';
import {
  CSVRowProcessingResult,
  CSVImportError,
  NameResolutionResult,
  BatchProcessingConfig
} from '../types/csvImport';

export interface ActualCSVData {
  日付: string;
  時間: string;
  利用者名: string;
  サービス内容: string;
  担当職員: string;
  担当所員: string; // 実際のCSVカラム名
  サービス種類コード: string;
  サービス内容コード: string;
  利用者コード: string;
  職員コード: string;
  職員EMAIL: string;
  保険単位数: string;
  自費金額: string;
  利用者名カナ: string;
  開始時間: string;
  終了時間: string;
  実施時間: string;
  保険者番号: string;
  施設所在保険者番号: string;
  被保険者番号: string;
  要介護度: string;
  同一建物減算: string;
  障害者受給者番号: string;
  サービス提供責任者: string;
  西暦日付: string;
}

export interface SimplifiedServiceData {
  userName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  serviceDate: string; // YYYY-MM-DD format
  serviceContent: string;
  serviceType: string; // CSVのサービス内容（D列）
  userCode: string;
  staffCode: string;
  userNameKana: string;
}

export interface EnhancedServiceData extends SimplifiedServiceData {
  normalizedUserName: string;
  normalizedStaffName: string;
  userNameResolution?: NameResolutionResult;
  staffNameResolution?: NameResolutionResult;
  processingErrors: CSVImportError[];
  processingWarnings: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface CSVParsingOptions {
  encoding?: 'utf-8' | 'shift-jis' | 'auto';
  delimiter?: ',' | ';' | '\t' | 'auto';
  hasHeader?: boolean;
  skipEmptyLines?: boolean;
  trimWhitespace?: boolean;
  enableNameResolution?: boolean;
  nameResolutionThreshold?: number;
  existingUserNames?: string[];
  existingStaffNames?: string[];
  batchProcessing?: BatchProcessingConfig;
}

export interface CSVParsingResult {
  data: EnhancedServiceData[];
  summary: {
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    skippedRows: number;
    processingTime: number;
  };
  errors: CSVImportError[];
  warnings: string[];
  nameResolutionStats: {
    totalNames: number;
    resolvedNames: number;
    unresolvedNames: number;
    averageConfidence: number;
  };
}

// Shift-JISデコード用のヘルパー関数
function decodeShiftJIS(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('shift-jis');
    return decoder.decode(buffer);
  } catch (error) {
    // Shift-JISデコードに失敗した場合はUTF-8として処理
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

// 基本的な名前の正規化処理（後方互換性のため保持）
export function normalizeName(name: string): string {
  if (!name) return '';
  
  // 高度な正規化を使用
  const result = advancedNormalizeName(name);
  return result.normalized;
}

// 高度な名前正規化処理（新機能）
export function normalizeNameAdvanced(name: string): string {
  const result = advancedNormalizeName(name);
  return result.normalized;
}

// 日付形式の変換（YYYY/MM/DD → YYYY-MM-DD）
function convertDateFormat(dateStr: string, fallbackDate?: string): string {
  if (!dateStr) {
    console.log('日付が空です:', dateStr);
    return '';
  }
  
  // デバッグ用ログ
  console.log('変換前の日付:', dateStr);
  
  // 令和形式の日付を処理（令和07年07月01日 (火) → 2025-07-01）
  const reiwaMatch = dateStr.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const reiwaYear = parseInt(reiwaMatch[1]);
    const gregorianYear = reiwaYear + 2018; // 令和1年 = 2019年
    const month = reiwaMatch[2].padStart(2, '0');
    const day = reiwaMatch[3].padStart(2, '0');
    const result = `${gregorianYear}-${month}-${day}`;
    console.log('令和形式変換:', dateStr, '→', result);
    return result;
  }
  
  // 平成形式の日付を処理（平成31年04月30日 → 2019-04-30）
  const heiseiMatch = dateStr.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const heiseiYear = parseInt(heiseiMatch[1]);
    const gregorianYear = heiseiYear + 1988; // 平成1年 = 1989年
    const month = heiseiMatch[2].padStart(2, '0');
    const day = heiseiMatch[3].padStart(2, '0');
    const result = `${gregorianYear}-${month}-${day}`;
    console.log('平成形式変換:', dateStr, '→', result);
    return result;
  }
  
  // 通常の年月日形式（2025年07月01日 → 2025-07-01）
  const normalMatch = dateStr.match(/(\d{4})年(\d+)月(\d+)日/);
  if (normalMatch) {
    const year = normalMatch[1];
    const month = normalMatch[2].padStart(2, '0');
    const day = normalMatch[3].padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    console.log('通常形式変換:', dateStr, '→', result);
    return result;
  }
  
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      console.log('スラッシュ形式変換:', dateStr, '→', result);
      return result;
    }
  }
  
  console.log('日付変換失敗:', dateStr);
  return dateStr;
}

export function parseSimplifiedCSV(file: File): Promise<SimplifiedServiceData[]> {
  return new Promise((resolve, reject) => {
    // ファイルをArrayBufferとして読み込み、Shift-JISデコードを試行
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const text = decodeShiftJIS(buffer);
        
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              console.log('CSVヘッダー:', results.meta.fields);
              console.log('CSVデータサンプル:', results.data.slice(0, 3));
              
              const parsedData = results.data
                .filter((row: any) => row.利用者名 && row.利用者名.trim() !== '' && (row.日付 || row.西暦日付))
                .map((row: any) => {
                  const csvData = row as ActualCSVData;
                  
                  // 担当職員名を取得（担当所員または担当職員カラムから）
                  const staffName = csvData.担当所員 || csvData.担当職員 || '';
                  
                  console.log('CSVデータ:', {
                    利用者名: csvData.利用者名,
                    担当所員: csvData.担当所員,
                    担当職員: csvData.担当職員,
                    最終的な職員名: staffName
                  });
                  
                  return {
                    userName: normalizeName(csvData.利用者名),
                    staffName: staffName.trim(), // 正規化せずに元の名前をそのまま使用
                    startTime: csvData.開始時間?.trim() || '00:00',
                    endTime: csvData.終了時間?.trim() || '00:30',
                    durationMinutes: parseInt(csvData.実施時間) || 30,
                    serviceDate: convertDateFormat(csvData.西暦日付?.trim() || csvData.日付?.trim() || ''),
                    serviceContent: csvData.サービス内容?.trim() || '',
                    serviceType: csvData.サービス内容?.trim() || '', // D列のサービス内容をserviceTypeとして使用
                    userCode: csvData.利用者コード?.trim() || '',
                    staffCode: csvData.職員コード?.trim() || '',
                    userNameKana: csvData.利用者名カナ?.trim() || ''
                  };
                });
              
              resolve(parsedData);
            } catch (error) {
              reject(error);
            }
          },
          error: (error: any) => {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

export function validateSimplifiedCSVData(data: SimplifiedServiceData[]): { valid: SimplifiedServiceData[], errors: string[] } {
  const valid: SimplifiedServiceData[] = [];
  const errors: string[] = [];
  const duplicateCheck = new Set<string>();

  data.forEach((row, index) => {
    const rowErrors: string[] = [];
    const rowNumber = index + 2; // CSVの行番号（ヘッダー行を考慮）

    // 必須フィールドの検証
    if (!row.userName || row.userName.trim() === '') {
      rowErrors.push('利用者名が必要です');
    }
    
    if (!row.serviceDate || row.serviceDate.trim() === '') {
      rowErrors.push('サービス日が必要です');
    } else {
      // 日付形式の検証（YYYY-MM-DD）
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(row.serviceDate)) {
        rowErrors.push('サービス日の形式が正しくありません（YYYY-MM-DD形式で入力してください）');
      } else {
        // 日付の妥当性チェック
        const date = new Date(row.serviceDate);
        if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== row.serviceDate) {
          rowErrors.push('サービス日が無効な日付です');
        }
      }
    }

    if (!row.startTime || row.startTime.trim() === '') {
      rowErrors.push('開始時間が必要です');
    } else {
      // 時間形式の検証（HH:MM）
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(row.startTime)) {
        rowErrors.push('開始時間の形式が正しくありません（HH:MM形式で入力してください）');
      }
    }

    if (!row.endTime || row.endTime.trim() === '') {
      rowErrors.push('終了時間が必要です');
    } else {
      // 時間形式の検証（HH:MM）
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(row.endTime)) {
        rowErrors.push('終了時間の形式が正しくありません（HH:MM形式で入力してください）');
      }
    }

    // 開始時間と終了時間の論理チェック
    if (row.startTime && row.endTime) {
      const startMinutes = parseTime(row.startTime);
      const endMinutes = parseTime(row.endTime);
      
      if (startMinutes >= endMinutes) {
        rowErrors.push('終了時間は開始時間より後である必要があります');
      } else {
        // 実施時間の整合性チェック
        const calculatedDuration = endMinutes - startMinutes;
        if (row.durationMinutes && Math.abs(row.durationMinutes - calculatedDuration) > 5) {
          rowErrors.push(`実施時間（${row.durationMinutes}分）と開始・終了時間から計算される時間（${calculatedDuration}分）が一致しません`);
        }
      }
    }

    if (!row.durationMinutes || row.durationMinutes <= 0) {
      rowErrors.push('実施時間が必要です（正の数値で入力してください）');
    } else if (row.durationMinutes > 1440) { // 24時間 = 1440分
      rowErrors.push('実施時間が24時間を超えています');
    }

    // 重複データのチェック
    const duplicateKey = `${row.userName}-${row.serviceDate}-${row.startTime}-${row.endTime}`;
    if (duplicateCheck.has(duplicateKey)) {
      rowErrors.push('同じ利用者・日付・時間の重複データです');
    } else {
      duplicateCheck.add(duplicateKey);
    }

    // 職員名・コードが空の場合は警告のみ（エラーではない）
    if (!row.staffName || row.staffName.trim() === '') {
      console.warn(`行 ${rowNumber}: 担当職員が空です`);
    }
    
    if (!row.userCode || row.userCode.trim() === '') {
      console.warn(`行 ${rowNumber}: 利用者コードが空です`);
    }

    // サービス内容が空の場合は警告
    if (!row.serviceContent || row.serviceContent.trim() === '') {
      console.warn(`行 ${rowNumber}: サービス内容が空です`);
    }

    // 利用者名の形式チェック（日本語名前として妥当か）
    if (row.userName && row.userName.length > 50) {
      rowErrors.push('利用者名が長すぎます（50文字以内で入力してください）');
    }

    // 担当職員名の形式チェック
    if (row.staffName && row.staffName.length > 50) {
      rowErrors.push('担当職員名が長すぎます（50文字以内で入力してください）');
    }

    // サービス内容の長さチェック
    if (row.serviceContent && row.serviceContent.length > 200) {
      rowErrors.push('サービス内容が長すぎます（200文字以内で入力してください）');
    }

    if (rowErrors.length > 0) {
      errors.push(`行 ${rowNumber}: ${rowErrors.join(', ')}`);
    } else {
      valid.push(row);
    }
  });

  return { valid, errors };
}

// 拡張されたCSVパース機能
async function parseEnhancedCSV(file: File, options: CSVParsingOptions): Promise<CSVParsingResult> {
  const startTime = Date.now();
  const errors: CSVImportError[] = [];
  const warnings: string[] = [];
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        let text: string;
        
        // エンコーディング処理
        if (options.encoding === 'shift-jis') {
          text = decodeShiftJIS(buffer);
        } else if (options.encoding === 'utf-8') {
          text = new TextDecoder('utf-8').decode(buffer);
        } else {
          // auto detection
          text = decodeShiftJIS(buffer);
        }
        
        Papa.parse(text, {
          header: options.hasHeader !== false,
          skipEmptyLines: options.skipEmptyLines !== false,
          delimiter: options.delimiter === 'auto' ? undefined : options.delimiter,
          complete: async (results) => {
            try {
              const parseResult = await processCSVData(
                results.data,
                options,
                errors,
                warnings
              );
              
              const endTime = Date.now();
              const processingTime = endTime - startTime;
              
              resolve({
                ...parseResult,
                summary: {
                  ...parseResult.summary,
                  processingTime
                },
                errors,
                warnings
              });
            } catch (error) {
              reject(error);
            }
          },
          error: (error: any) => {
            const csvError: CSVImportError = {
              id: `parse_error_${Date.now()}`,
              type: 'parse_error',
              message: `CSVパースエラー: ${error.message}`,
              timestamp: new Date(),
              isRecoverable: false
            };
            errors.push(csvError);
            reject(new Error(csvError.message));
          }
        });
      } catch (error) {
        const csvError: CSVImportError = {
          id: `file_read_error_${Date.now()}`,
          type: 'file_read_error',
          message: `ファイル読み込みエラー: ${(error as Error).message}`,
          timestamp: new Date(),
          isRecoverable: false
        };
        errors.push(csvError);
        reject(new Error(csvError.message));
      }
    };
    
    reader.onerror = () => {
      const csvError: CSVImportError = {
        id: `file_read_error_${Date.now()}`,
        type: 'file_read_error',
        message: 'ファイルの読み込みに失敗しました',
        timestamp: new Date(),
        isRecoverable: false
      };
      errors.push(csvError);
      reject(new Error(csvError.message));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// CSVデータの処理
async function processCSVData(
  rawData: any[],
  options: CSVParsingOptions,
  errors: CSVImportError[],
  warnings: string[]
): Promise<Omit<CSVParsingResult, 'errors' | 'warnings'>> {
  const data: EnhancedServiceData[] = [];
  let totalRows = 0;
  let processedRows = 0;
  let successfulRows = 0;
  let failedRows = 0;
  let skippedRows = 0;
  
  const nameResolutionStats = {
    totalNames: 0,
    resolvedNames: 0,
    unresolvedNames: 0,
    confidenceScores: [] as number[]
  };

  // バッチ処理設定
  const batchSize = options.batchProcessing?.batchSize || 100;
  const batches = [];
  
  // データをバッチに分割
  for (let i = 0; i < rawData.length; i += batchSize) {
    batches.push(rawData.slice(i, i + batchSize));
  }
  
  totalRows = rawData.length;

  // バッチごとに処理
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
      const globalRowIndex = batchIndex * batchSize + rowIndex;
      const row = batch[rowIndex];
      
      try {
        // 基本的なデータ検証
        if (!row.利用者名 || !row.利用者名.trim()) {
          skippedRows++;
          continue;
        }

        // 基本データの変換
        const basicData: SimplifiedServiceData = {
          userName: normalizeName(row.利用者名),
          staffName: normalizeName(row.担当職員 || row.担当所員 || ''),
          startTime: row.開始時間?.trim() || '00:00',
          endTime: row.終了時間?.trim() || '00:30',
          durationMinutes: parseInt(row.実施時間) || 30,
          serviceDate: convertDateFormat(row.西暦日付?.trim() || row.日付?.trim() || ''),
          serviceContent: row.サービス内容?.trim() || '',
          serviceType: row.サービス内容?.trim() || '', // D列のサービス内容をserviceTypeとして使用
          userCode: row.利用者コード?.trim() || '',
          staffCode: row.職員コード?.trim() || row.所員コード?.trim() || '',
          userNameKana: row.利用者名カナ?.trim() || ''
        };

        // 拡張データの初期化
        const enhancedData: EnhancedServiceData = {
          ...basicData,
          normalizedUserName: normalizeNameAdvanced(basicData.userName),
          normalizedStaffName: normalizeNameAdvanced(basicData.staffName),
          processingErrors: [],
          processingWarnings: [],
          confidence: 'medium'
        };

        // 名前解決処理
        if (options.enableNameResolution) {
          await performNameResolution(
            enhancedData,
            options,
            nameResolutionStats,
            globalRowIndex
          );
        }

        // データ品質チェック
        performDataQualityCheck(enhancedData, warnings, globalRowIndex);

        // 信頼度の計算
        calculateConfidence(enhancedData);

        data.push(enhancedData);
        successfulRows++;
        
      } catch (error) {
        const csvError: CSVImportError = {
          id: `row_error_${globalRowIndex}_${Date.now()}`,
          type: 'validation_error',
          message: `行 ${globalRowIndex + 2}: ${(error as Error).message}`,
          rowIndex: globalRowIndex,
          timestamp: new Date(),
          isRecoverable: true
        };
        
        errors.push(csvError);
        failedRows++;
      }
      
      processedRows++;
    }
  }

  // 名前解決統計の計算
  const averageConfidence = nameResolutionStats.confidenceScores.length > 0
    ? nameResolutionStats.confidenceScores.reduce((sum, score) => sum + score, 0) / nameResolutionStats.confidenceScores.length
    : 0;

  return {
    data,
    summary: {
      totalRows,
      processedRows,
      successfulRows,
      failedRows,
      skippedRows,
      processingTime: 0 // 呼び出し元で設定
    },
    nameResolutionStats: {
      totalNames: nameResolutionStats.totalNames,
      resolvedNames: nameResolutionStats.resolvedNames,
      unresolvedNames: nameResolutionStats.unresolvedNames,
      averageConfidence
    }
  };
}

// 名前解決処理
async function performNameResolution(
  data: EnhancedServiceData,
  options: CSVParsingOptions,
  stats: any,
  rowIndex: number
): Promise<void> {
  const threshold = options.nameResolutionThreshold || 0.8;
  
  // ユーザー名の解決
  if (data.userName && options.existingUserNames) {
    stats.totalNames++;
    
    const userMatch = findBestMatch(data.userName, options.existingUserNames, threshold);
    if (userMatch) {
      data.userNameResolution = {
        originalName: data.userName,
        resolvedName: userMatch.name,
        matchResult: userMatch.result,
        isResolved: true,
        confidence: userMatch.result.confidence,
        alternativeCandidates: [],
        requiresManualReview: userMatch.result.confidence === 'low'
      };
      
      data.normalizedUserName = userMatch.name;
      stats.resolvedNames++;
      stats.confidenceScores.push(userMatch.result.score);
    } else {
      data.userNameResolution = {
        originalName: data.userName,
        isResolved: false,
        confidence: 'low',
        alternativeCandidates: options.existingUserNames
          .map(name => ({
            name,
            score: matchNames(data.userName, name).score,
            source: 'database' as const
          }))
          .filter(candidate => candidate.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3),
        requiresManualReview: true
      };
      
      stats.unresolvedNames++;
    }
  }

  // スタッフ名の解決
  if (data.staffName && options.existingStaffNames) {
    stats.totalNames++;
    
    const staffMatch = findBestMatch(data.staffName, options.existingStaffNames, threshold);
    if (staffMatch) {
      data.staffNameResolution = {
        originalName: data.staffName,
        resolvedName: staffMatch.name,
        matchResult: staffMatch.result,
        isResolved: true,
        confidence: staffMatch.result.confidence,
        alternativeCandidates: [],
        requiresManualReview: staffMatch.result.confidence === 'low'
      };
      
      data.normalizedStaffName = staffMatch.name;
      stats.resolvedNames++;
      stats.confidenceScores.push(staffMatch.result.score);
    } else {
      data.staffNameResolution = {
        originalName: data.staffName,
        isResolved: false,
        confidence: 'low',
        alternativeCandidates: options.existingStaffNames
          .map(name => ({
            name,
            score: matchNames(data.staffName, name).score,
            source: 'database' as const
          }))
          .filter(candidate => candidate.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3),
        requiresManualReview: true
      };
      
      stats.unresolvedNames++;
    }
  }
}

// データ品質チェック
function performDataQualityCheck(
  data: EnhancedServiceData,
  warnings: string[],
  rowIndex: number
): void {
  // 必須フィールドのチェック
  if (!data.userName) {
    data.processingErrors.push({
      id: `validation_${rowIndex}_username`,
      type: 'validation_error',
      message: '利用者名が必要です',
      rowIndex,
      columnName: 'userName',
      timestamp: new Date(),
      isRecoverable: false
    });
  }

  if (!data.serviceDate) {
    data.processingErrors.push({
      id: `validation_${rowIndex}_date`,
      type: 'validation_error',
      message: 'サービス日付が必要です',
      rowIndex,
      columnName: 'serviceDate',
      timestamp: new Date(),
      isRecoverable: false
    });
  }

  // 時間の妥当性チェック
  if (data.startTime && data.endTime) {
    const start = parseTime(data.startTime);
    const end = parseTime(data.endTime);
    
    if (start >= end) {
      data.processingWarnings.push('開始時間が終了時間以降になっています');
      warnings.push(`行 ${rowIndex + 2}: 開始時間が終了時間以降になっています`);
    }
  }

  // スタッフ名の警告
  if (!data.staffName) {
    data.processingWarnings.push('担当職員が設定されていません');
    warnings.push(`行 ${rowIndex + 2}: 担当職員が設定されていません`);
  }
}

// 信頼度の計算
function calculateConfidence(data: EnhancedServiceData): void {
  let confidenceScore = 1.0;
  
  // エラーがある場合は信頼度を下げる
  if (data.processingErrors.length > 0) {
    confidenceScore -= 0.5;
  }
  
  // 警告がある場合は信頼度を少し下げる
  if (data.processingWarnings.length > 0) {
    confidenceScore -= 0.2;
  }
  
  // 名前解決の結果を考慮
  if (data.userNameResolution && !data.userNameResolution.isResolved) {
    confidenceScore -= 0.2;
  }
  
  if (data.staffNameResolution && !data.staffNameResolution.isResolved) {
    confidenceScore -= 0.1;
  }
  
  // 信頼度レベルの決定
  if (confidenceScore >= 0.8) {
    data.confidence = 'high';
  } else if (confidenceScore >= 0.5) {
    data.confidence = 'medium';
  } else {
    data.confidence = 'low';
  }
}

// 時間パース用ヘルパー関数
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
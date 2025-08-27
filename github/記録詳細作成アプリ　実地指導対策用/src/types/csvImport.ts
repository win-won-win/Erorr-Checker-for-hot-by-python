/**
 * CSV取り込み関連の型定義
 * ジョブ状態、エラー情報、進捗管理などの型を定義
 */

import { NameMatchResult } from '../utils/nameNormalizer';

/**
 * CSV取り込みジョブの状態
 */
export type CSVImportJobStatus = 
  | 'pending'     // 待機中
  | 'processing'  // 処理中
  | 'completed'   // 完了
  | 'failed'      // 失敗
  | 'cancelled';  // キャンセル

/**
 * CSV取り込みジョブの優先度
 */
export type CSVImportJobPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * エラーの種類
 */
export type CSVImportErrorType = 
  | 'file_read_error'      // ファイル読み込みエラー
  | 'parse_error'          // パースエラー
  | 'validation_error'     // バリデーションエラー
  | 'name_resolution_error' // 名前解決エラー
  | 'database_error'       // データベースエラー
  | 'network_error'        // ネットワークエラー
  | 'timeout_error'        // タイムアウトエラー
  | 'unknown_error';       // 不明なエラー

/**
 * CSV取り込みエラー情報
 */
export interface CSVImportError {
  id: string;
  type: CSVImportErrorType;
  message: string;
  details?: any;
  rowIndex?: number;
  columnName?: string;
  timestamp: Date;
  isRecoverable: boolean;
  suggestedAction?: string;
}

/**
 * 名前解決結果
 */
export interface NameResolutionResult {
  originalName: string;
  resolvedName?: string;
  matchResult?: NameMatchResult;
  isResolved: boolean;
  confidence: 'high' | 'medium' | 'low';
  alternativeCandidates: Array<{
    name: string;
    score: number;
    source: 'database' | 'pattern' | 'manual';
  }>;
  requiresManualReview: boolean;
  autoRegistered?: boolean;
}

/**
 * CSV行の処理結果
 */
export interface CSVRowProcessingResult {
  rowIndex: number;
  originalData: Record<string, any>;
  processedData?: Record<string, any>;
  nameResolutions: NameResolutionResult[];
  errors: CSVImportError[];
  warnings: string[];
  isValid: boolean;
  processingTime: number; // ミリ秒
}

/**
 * バッチ処理の設定
 */
export interface BatchProcessingConfig {
  batchSize: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number; // ミリ秒
  timeoutPerBatch: number; // ミリ秒
  enableParallelProcessing: boolean;
}

/**
 * CSV取り込みジョブの進捗情報
 */
export interface CSVImportProgress {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedEndTime?: Date;
  processingRate: number; // 行/分
  errors: CSVImportError[];
  warnings: string[];
}

/**
 * CSV取り込みジョブの設定
 */
export interface CSVImportJobConfig {
  fileName: string;
  fileSize: number;
  encoding: 'utf-8' | 'shift-jis' | 'auto';
  delimiter: ',' | ';' | '\t' | 'auto';
  hasHeader: boolean;
  skipEmptyLines: boolean;
  trimWhitespace: boolean;
  batchProcessing: BatchProcessingConfig;
  nameResolution: {
    enabled: boolean;
    threshold: number;
    autoResolve: boolean;
    usePatternLearning: boolean;
  };
  validation: {
    strictMode: boolean;
    requiredFields: string[];
    customValidators: Array<{
      field: string;
      validator: string; // 正規表現またはカスタム関数名
    }>;
  };
  output: {
    generateReport: boolean;
    saveToDatabase: boolean;
    createBackup: boolean;
  };
}

/**
 * CSV取り込みジョブ
 */
export interface CSVImportJob {
  id: string;
  status: CSVImportJobStatus;
  priority: CSVImportJobPriority;
  config: CSVImportJobConfig;
  progress: CSVImportProgress;
  result?: CSVImportJobResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  metadata: Record<string, any>;
}

/**
 * CSV取り込みジョブの結果
 */
export interface CSVImportJobResult {
  success: boolean;
  summary: {
    totalRows: number;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    skippedRows: number;
    processingTime: number; // ミリ秒
    averageProcessingRate: number; // 行/分
  };
  nameResolutionSummary: {
    totalNames: number;
    resolvedNames: number;
    unresolvedNames: number;
    manualReviewRequired: number;
    newPatternsLearned: number;
  };
  errors: CSVImportError[];
  warnings: string[];
  reportUrl?: string;
  backupUrl?: string;
  statistics: {
    memoryUsage: number;
    cpuUsage: number;
    databaseOperations: number;
    networkRequests: number;
  };
}

/**
 * 名前解決パターン
 */
export interface NameResolutionPattern {
  id: string;
  originalPattern: string;
  resolvedName: string;
  confidence: number;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
  metadata: {
    source: 'manual' | 'auto_learned' | 'imported';
    category?: string;
    tags?: string[];
  };
}

/**
 * CSV取り込み履歴
 */
export interface CSVImportHistory {
  id: string;
  jobId: string;
  fileName: string;
  status: CSVImportJobStatus;
  summary: CSVImportJobResult['summary'];
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
  fileHash: string; // ファイルの重複チェック用
}

/**
 * データ品質レポート
 */
export interface DataQualityReport {
  jobId: string;
  generatedAt: Date;
  overallScore: number; // 0-100
  metrics: {
    completeness: number; // データの完全性
    accuracy: number;     // データの正確性
    consistency: number;  // データの一貫性
    validity: number;     // データの妥当性
  };
  issues: Array<{
    type: 'missing_data' | 'invalid_format' | 'inconsistent_data' | 'duplicate_data';
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
    examples: string[];
    suggestedFix?: string;
  }>;
  recommendations: string[];
}

/**
 * CSV取り込みサービスの設定
 */
export interface CSVImportServiceConfig {
  maxFileSize: number; // バイト
  maxConcurrentJobs: number;
  defaultBatchSize: number;
  defaultTimeout: number; // ミリ秒
  enableAutoRetry: boolean;
  enablePatternLearning: boolean;
  enableDataQualityCheck: boolean;
  storageConfig: {
    tempDirectory: string;
    backupDirectory: string;
    reportDirectory: string;
    cleanupAfterDays: number;
  };
  databaseConfig: {
    connectionPoolSize: number;
    queryTimeout: number;
    enableTransactions: boolean;
  };
}

/**
 * CSV取り込みイベント
 */
export type CSVImportEvent = 
  | { type: 'job_created'; payload: { jobId: string; config: CSVImportJobConfig } }
  | { type: 'job_started'; payload: { jobId: string; startTime: Date } }
  | { type: 'batch_processed'; payload: { jobId: string; batchNumber: number; results: CSVRowProcessingResult[] } }
  | { type: 'name_resolved'; payload: { jobId: string; resolution: NameResolutionResult } }
  | { type: 'error_occurred'; payload: { jobId: string; error: CSVImportError } }
  | { type: 'job_completed'; payload: { jobId: string; result: CSVImportJobResult } }
  | { type: 'job_failed'; payload: { jobId: string; error: CSVImportError } }
  | { type: 'job_cancelled'; payload: { jobId: string; reason: string } };

/**
 * CSV取り込みイベントハンドラー
 */
export type CSVImportEventHandler = (event: CSVImportEvent) => void | Promise<void>;

/**
 * CSV取り込みサービスのインターface
 */
export interface ICSVImportService {
  // ジョブ管理
  createJob(config: CSVImportJobConfig, file: File): Promise<string>;
  getJob(jobId: string): Promise<CSVImportJob | null>;
  listJobs(filter?: Partial<CSVImportJob>): Promise<CSVImportJob[]>;
  cancelJob(jobId: string): Promise<boolean>;
  
  // ジョブ実行
  startJob(jobId: string): Promise<void>;
  pauseJob(jobId: string): Promise<void>;
  resumeJob(jobId: string): Promise<void>;
  
  // 進捗監視
  getProgress(jobId: string): Promise<CSVImportProgress | null>;
  subscribeToProgress(jobId: string, callback: (progress: CSVImportProgress) => void): () => void;
  
  // 名前解決
  resolveNames(names: string[]): Promise<NameResolutionResult[]>;
  addNamePattern(pattern: NameResolutionPattern): Promise<void>;
  getNamePatterns(): Promise<NameResolutionPattern[]>;
  
  // レポート生成
  generateReport(jobId: string): Promise<DataQualityReport>;
  exportResults(jobId: string, format: 'csv' | 'json' | 'excel'): Promise<string>;
  
  // イベント処理
  addEventListener(handler: CSVImportEventHandler): () => void;
  removeEventListener(handler: CSVImportEventHandler): void;
  
  // 設定管理
  getConfig(): CSVImportServiceConfig;
  updateConfig(config: Partial<CSVImportServiceConfig>): Promise<void>;
}

/**
 * CSV取り込み統計情報
 */
export interface CSVImportStatistics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalRowsProcessed: number;
  averageProcessingTime: number;
  averageSuccessRate: number;
  mostCommonErrors: Array<{
    type: CSVImportErrorType;
    count: number;
    percentage: number;
  }>;
  nameResolutionStats: {
    totalNamesProcessed: number;
    automaticallyResolved: number;
    manuallyResolved: number;
    unresolved: number;
    resolutionRate: number;
  };
  performanceMetrics: {
    averageRowsPerMinute: number;
    peakRowsPerMinute: number;
    averageMemoryUsage: number;
    peakMemoryUsage: number;
  };
}
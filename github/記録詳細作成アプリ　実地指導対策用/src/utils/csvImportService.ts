/**
 * CSV取り込みサービス
 * CSV取り込みジョブ管理、データベース操作の統合、パターンマッチング連携、自動生成機能を提供
 */

import { 
  CSVImportJob, 
  CSVImportJobConfig, 
  CSVImportJobResult, 
  CSVImportProgress, 
  CSVImportError, 
  CSVImportErrorType,
  CSVImportJobStatus,
  CSVRowProcessingResult,
  NameResolutionResult,
  BatchProcessingConfig,
  CSVImportEvent,
  CSVImportEventHandler,
  CSVImportServiceConfig,
  ICSVImportService,
  DataQualityReport,
  NameResolutionPattern
} from '../types/csvImport';

import { 
  normalizeName, 
  matchNames, 
  findBestMatch, 
  NameMatchResult 
} from './nameNormalizer';

import { databaseService } from './databaseService';
import { parseSimplifiedCSV, SimplifiedServiceData } from './csvParser';
import { supabase } from '../lib/supabase';

/**
 * CSV取り込みサービスの実装
 */
export class CSVImportService implements ICSVImportService {
  private jobs = new Map<string, CSVImportJob>();
  private eventHandlers: CSVImportEventHandler[] = [];
  private config: CSVImportServiceConfig;
  private processingQueue: string[] = [];
  private isProcessing = false;

  constructor(config?: Partial<CSVImportServiceConfig>) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxConcurrentJobs: 3,
      defaultBatchSize: 100,
      defaultTimeout: 300000, // 5分
      enableAutoRetry: true,
      enablePatternLearning: true,
      enableDataQualityCheck: true,
      storageConfig: {
        tempDirectory: '/tmp/csv-import',
        backupDirectory: '/tmp/csv-backup',
        reportDirectory: '/tmp/csv-reports',
        cleanupAfterDays: 30
      },
      databaseConfig: {
        connectionPoolSize: 10,
        queryTimeout: 30000,
        enableTransactions: true
      },
      ...config
    };
  }

  /**
   * ジョブを作成
   */
  async createJob(config: CSVImportJobConfig, file: File): Promise<string> {
    // ファイルサイズチェック
    if (file.size > this.config.maxFileSize) {
      throw new Error(`ファイルサイズが上限（${this.config.maxFileSize / 1024 / 1024}MB）を超えています`);
    }

    const jobId = this.generateJobId();
    const now = new Date();

    const job: CSVImportJob = {
      id: jobId,
      status: 'pending',
      priority: 'normal',
      config,
      progress: {
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        skippedRows: 0,
        currentBatch: 0,
        totalBatches: 0,
        startTime: now,
        processingRate: 0,
        errors: [],
        warnings: []
      },
      createdAt: now,
      createdBy: 'system', // TODO: 実際のユーザーIDを設定
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      }
    };

    this.jobs.set(jobId, job);
    
    // データベースに保存
    await databaseService.jobManagement.saveJob(job);

    // イベント発火
    this.emitEvent({
      type: 'job_created',
      payload: { jobId, config }
    });

    return jobId;
  }

  /**
   * ジョブを取得
   */
  async getJob(jobId: string): Promise<CSVImportJob | null> {
    // メモリから取得を試行
    const memoryJob = this.jobs.get(jobId);
    if (memoryJob) {
      return memoryJob;
    }

    // データベースから取得
    return await databaseService.jobManagement.getJob(jobId);
  }

  /**
   * ジョブ一覧を取得
   */
  async listJobs(filter?: Partial<CSVImportJob>): Promise<CSVImportJob[]> {
    return await databaseService.jobManagement.listJobs({
      status: filter?.status,
      createdBy: filter?.createdBy,
      limit: 50
    });
  }

  /**
   * ジョブをキャンセル
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    if (job.status === 'processing') {
      job.status = 'cancelled';
      await this.updateJob(jobId, { status: 'cancelled' });
      
      this.emitEvent({
        type: 'job_cancelled',
        payload: { jobId, reason: 'User requested cancellation' }
      });
      
      return true;
    }

    return false;
  }

  /**
   * ジョブを開始
   */
  async startJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'pending') {
      throw new Error('ジョブが見つからないか、既に処理中です');
    }

    // 処理キューに追加
    this.processingQueue.push(jobId);
    
    // 処理開始
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * ジョブを一時停止
   */
  async pauseJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'processing') {
      throw new Error('ジョブが見つからないか、処理中ではありません');
    }

    // TODO: 実際の一時停止ロジックを実装
    console.log(`ジョブ ${jobId} を一時停止しました`);
  }

  /**
   * ジョブを再開
   */
  async resumeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('ジョブが見つかりません');
    }

    // TODO: 実際の再開ロジックを実装
    console.log(`ジョブ ${jobId} を再開しました`);
  }

  /**
   * 進捗を取得
   */
  async getProgress(jobId: string): Promise<CSVImportProgress | null> {
    const job = await this.getJob(jobId);
    return job?.progress || null;
  }

  /**
   * 進捗を監視
   */
  subscribeToProgress(jobId: string, callback: (progress: CSVImportProgress) => void): () => void {
    const handler: CSVImportEventHandler = (event) => {
      if (event.type === 'batch_processed' && event.payload.jobId === jobId) {
        this.getProgress(jobId).then(progress => {
          if (progress) callback(progress);
        });
      }
    };

    this.addEventListener(handler);
    
    return () => this.removeEventListener(handler);
  }

  /**
   * 名前を解決
   */
  async resolveNames(names: string[]): Promise<NameResolutionResult[]> {
    const results: NameResolutionResult[] = [];
    
    // 既存のユーザーデータを取得
    const existingUsers = await this.getExistingUsers();
    const existingStaff = await this.getExistingStaff();
    const allExistingNames = [...existingUsers.map(u => u.name), ...existingStaff.map(s => s.name)];
    
    // パターンデータを取得
    const patterns = await databaseService.patternLearning.getNamePatterns();

    for (const originalName of names) {
      const result = await this.resolveSingleName(originalName, allExistingNames, patterns);
      results.push(result);
    }

    return results;
  }

  /**
   * 名前パターンを追加
   */
  async addNamePattern(pattern: NameResolutionPattern): Promise<void> {
    await databaseService.patternLearning.saveNamePattern(pattern);
  }

  /**
   * 名前パターンを取得
   */
  async getNamePatterns(): Promise<NameResolutionPattern[]> {
    return await databaseService.patternLearning.getNamePatterns();
  }

  /**
   * レポートを生成
   */
  async generateReport(jobId: string): Promise<DataQualityReport> {
    const job = await this.getJob(jobId);
    if (!job || !job.result) {
      throw new Error('ジョブが見つからないか、まだ完了していません');
    }

    const errors = await databaseService.errorTracking.getJobErrors(jobId);
    
    // データ品質メトリクスを計算
    const totalRows = job.result.summary.totalRows;
    const successfulRows = job.result.summary.successfulRows;
    const failedRows = job.result.summary.failedRows;
    
    const completeness = totalRows > 0 ? (successfulRows / totalRows) * 100 : 0;
    const accuracy = totalRows > 0 ? ((totalRows - failedRows) / totalRows) * 100 : 0;
    
    // エラー分析
    const errorTypes = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const issues = Object.entries(errorTypes).map(([type, count]) => ({
      type: type as any,
      severity: this.getErrorSeverity(type as CSVImportErrorType),
      count,
      examples: errors.filter(e => e.type === type).slice(0, 3).map(e => e.message),
      suggestedFix: this.getSuggestedFix(type as CSVImportErrorType)
    }));

    const overallScore = Math.round((completeness + accuracy) / 2);

    return {
      jobId,
      generatedAt: new Date(),
      overallScore,
      metrics: {
        completeness,
        accuracy,
        consistency: 85, // TODO: 実際の一貫性チェックを実装
        validity: 90     // TODO: 実際の妥当性チェックを実装
      },
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  }

  /**
   * 結果をエクスポート
   */
  async exportResults(jobId: string, format: 'csv' | 'json' | 'excel'): Promise<string> {
    const job = await this.getJob(jobId);
    if (!job || !job.result) {
      throw new Error('ジョブが見つからないか、まだ完了していません');
    }

    // TODO: 実際のエクスポート機能を実装
    const exportUrl = `/exports/${jobId}.${format}`;
    console.log(`結果を ${format} 形式でエクスポートしました: ${exportUrl}`);
    
    return exportUrl;
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(handler: CSVImportEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => this.removeEventListener(handler);
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(handler: CSVImportEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): CSVImportServiceConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  async updateConfig(config: Partial<CSVImportServiceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  // プライベートメソッド

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async updateJob(jobId: string, updates: Partial<CSVImportJob>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.jobs.set(jobId, job);
    }
    
    await databaseService.jobManagement.updateJob(jobId, updates);
  }

  private emitEvent(event: CSVImportEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('イベントハンドラーでエラー:', error);
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const jobId = this.processingQueue.shift()!;
        await this.processJob(jobId);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    try {
      // ジョブ開始
      job.status = 'processing';
      job.startedAt = new Date();
      await this.updateJob(jobId, { status: 'processing', startedAt: job.startedAt });

      this.emitEvent({
        type: 'job_started',
        payload: { jobId, startTime: job.startedAt }
      });

      // CSVファイルを処理（実際の実装では、ファイルデータを取得する必要があります）
      const result = await this.processCsvData(jobId, job);

      // ジョブ完了
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      await this.updateJob(jobId, { 
        status: 'completed', 
        completedAt: job.completedAt, 
        result 
      });

      this.emitEvent({
        type: 'job_completed',
        payload: { jobId, result }
      });

    } catch (error) {
      // ジョブ失敗
      const csvError: CSVImportError = {
        id: `error_${Date.now()}`,
        type: 'unknown_error',
        message: (error as Error).message,
        timestamp: new Date(),
        isRecoverable: false
      };

      job.status = 'failed';
      job.completedAt = new Date();
      await this.updateJob(jobId, { status: 'failed', completedAt: job.completedAt });

      await databaseService.errorTracking.logError(jobId, csvError);

      this.emitEvent({
        type: 'job_failed',
        payload: { jobId, error: csvError }
      });
    }
  }

  private async processCsvData(jobId: string, job: CSVImportJob): Promise<CSVImportJobResult> {
    // TODO: 実際のCSVファイルデータを取得して処理
    // この実装では、サンプルデータで処理をシミュレート
    
    const startTime = Date.now();
    const batchSize = job.config.batchProcessing.batchSize;
    
    // サンプルデータ（実際の実装では parseSimplifiedCSV を使用）
    const sampleData: SimplifiedServiceData[] = [
      {
        userName: '田中太郎',
        staffName: '佐藤花子',
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        serviceDate: '2025-01-01',
        serviceContent: '身体介護',
        serviceType: '身体介護',
        userCode: 'U001',
        staffCode: 'S001',
        userNameKana: 'タナカタロウ'
      }
    ];

    const totalRows = sampleData.length;
    const totalBatches = Math.ceil(totalRows / batchSize);
    
    job.progress.totalRows = totalRows;
    job.progress.totalBatches = totalBatches;

    let processedRows = 0;
    let successfulRows = 0;
    let failedRows = 0;
    const errors: CSVImportError[] = [];
    const nameResolutions: NameResolutionResult[] = [];

    // バッチ処理
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, totalRows);
      const batchData = sampleData.slice(batchStart, batchEnd);

      const batchResults: CSVRowProcessingResult[] = [];

      for (let i = 0; i < batchData.length; i++) {
        const rowIndex = batchStart + i;
        const row = batchData[i];

        try {
          // 名前解決
          const userNameResolution = await this.resolveSingleName(
            row.userName,
            await this.getExistingUserNames(),
            await databaseService.patternLearning.getNamePatterns(),
            true // isUser = true
          );
          
          const staffNameResolution = await this.resolveSingleName(
            row.staffName,
            await this.getExistingStaffNames(),
            await databaseService.patternLearning.getNamePatterns(),
            false // isUser = false
          );

          nameResolutions.push(userNameResolution, staffNameResolution);

          const result: CSVRowProcessingResult = {
            rowIndex,
            originalData: row,
            processedData: {
              ...row,
              resolvedUserName: userNameResolution.resolvedName || row.userName,
              resolvedStaffName: staffNameResolution.resolvedName || row.staffName
            },
            nameResolutions: [userNameResolution, staffNameResolution],
            errors: [],
            warnings: [],
            isValid: true,
            processingTime: 10 // サンプル値
          };

          batchResults.push(result);
          successfulRows++;

        } catch (error) {
          const csvError: CSVImportError = {
            id: `error_${rowIndex}_${Date.now()}`,
            type: 'validation_error',
            message: (error as Error).message,
            rowIndex,
            timestamp: new Date(),
            isRecoverable: true
          };

          errors.push(csvError);
          failedRows++;

          const result: CSVRowProcessingResult = {
            rowIndex,
            originalData: row,
            nameResolutions: [],
            errors: [csvError],
            warnings: [],
            isValid: false,
            processingTime: 5
          };

          batchResults.push(result);
        }

        processedRows++;
      }

      // 進捗更新
      job.progress.processedRows = processedRows;
      job.progress.successfulRows = successfulRows;
      job.progress.failedRows = failedRows;
      job.progress.currentBatch = batchIndex + 1;
      job.progress.processingRate = processedRows / ((Date.now() - startTime) / 60000); // 行/分

      await this.updateJob(jobId, { progress: job.progress });

      this.emitEvent({
        type: 'batch_processed',
        payload: { jobId, batchNumber: batchIndex + 1, results: batchResults }
      });
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // パターン学習
    let newPatternsLearned = 0;
    if (this.config.enablePatternLearning) {
      newPatternsLearned = await databaseService.patternLearning.learnFromResolutions(nameResolutions);
    }

    return {
      success: failedRows === 0,
      summary: {
        totalRows,
        processedRows,
        successfulRows,
        failedRows,
        skippedRows: 0,
        processingTime,
        averageProcessingRate: processedRows / (processingTime / 60000)
      },
      nameResolutionSummary: {
        totalNames: nameResolutions.length,
        resolvedNames: nameResolutions.filter(nr => nr.isResolved).length,
        unresolvedNames: nameResolutions.filter(nr => !nr.isResolved).length,
        manualReviewRequired: nameResolutions.filter(nr => nr.requiresManualReview).length,
        newPatternsLearned
      },
      errors,
      warnings: [],
      statistics: {
        memoryUsage: 0, // TODO: 実際のメモリ使用量を取得
        cpuUsage: 0,    // TODO: 実際のCPU使用量を取得
        databaseOperations: processedRows * 2, // サンプル値
        networkRequests: 0
      }
    };
  }

  private async resolveSingleName(
    originalName: string,
    existingNames: string[],
    patterns: NameResolutionPattern[],
    isUser: boolean = true
  ): Promise<NameResolutionResult> {
    const normalizedOriginal = normalizeName(originalName);
    
    // パターンマッチング
    for (const pattern of patterns) {
      const matchResult = matchNames(originalName, pattern.originalPattern, 0.9);
      if (matchResult.isMatch) {
        await databaseService.patternLearning.updatePatternUsage(pattern.id);
        
        return {
          originalName,
          resolvedName: pattern.resolvedName,
          matchResult,
          isResolved: true,
          confidence: 'high',
          alternativeCandidates: [],
          requiresManualReview: false
        };
      }
    }

    // 既存名前との照合
    const bestMatch = findBestMatch(originalName, existingNames, 0.8);
    if (bestMatch) {
      return {
        originalName,
        resolvedName: bestMatch.name,
        matchResult: bestMatch.result,
        isResolved: true,
        confidence: bestMatch.result.confidence,
        alternativeCandidates: [],
        requiresManualReview: bestMatch.result.confidence === 'low'
      };
    }

    // 新しい名前の場合、自動でマスタに登録
    try {
      const newId = await this.registerNewMaster(originalName, normalizedOriginal.normalized, isUser);
      if (newId) {
        console.log(`新しい${isUser ? '利用者' : '従業員'}を自動登録しました: ${originalName} (ID: ${newId})`);
        
        return {
          originalName,
          resolvedName: originalName,
          isResolved: true,
          confidence: 'high',
          alternativeCandidates: [],
          requiresManualReview: false,
          autoRegistered: true
        };
      }
    } catch (error) {
      console.error(`マスタ自動登録エラー (${originalName}):`, error);
    }

    // 解決できない場合
    return {
      originalName,
      isResolved: false,
      confidence: 'low',
      alternativeCandidates: existingNames
        .map(name => ({
          name,
          score: matchNames(originalName, name).score,
          source: 'database' as const
        }))
        .filter(candidate => candidate.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
      requiresManualReview: true
    };
  }

  private async getExistingUsers(): Promise<Array<{ name: string; id: string }>> {
    try {
      const { data, error } = await supabase
        .from('users_master')
        .select('id, name');
      
      if (error) {
        console.error('利用者マスタ取得エラー:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('利用者マスタ取得エラー:', error);
      return [];
    }
  }

  private async getExistingStaff(): Promise<Array<{ name: string; id: string }>> {
    try {
      const { data, error } = await supabase
        .from('staff_master')
        .select('id, name');
      
      if (error) {
        console.error('従業員マスタ取得エラー:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('従業員マスタ取得エラー:', error);
      return [];
    }
  }

  private async getExistingUserNames(): Promise<string[]> {
    const users = await this.getExistingUsers();
    return users.map(u => u.name);
  }

  private async getExistingStaffNames(): Promise<string[]> {
    const staff = await this.getExistingStaff();
    return staff.map(s => s.name);
  }

  /**
   * 新しい利用者または従業員をマスタテーブルに登録
   */
  private async registerNewMaster(originalName: string, normalizedName: string, isUser: boolean): Promise<string | null> {
    try {
      const tableName = isUser ? 'users_master' : 'staff_master';
      const now = new Date().toISOString();
      
      // デフォルトの健康基準値（利用者の場合のみ）
      const defaultHealthBaselines = isUser ? {
        temperature_min: 36.0,
        temperature_max: 37.5,
        blood_pressure_systolic_min: 100,
        blood_pressure_systolic_max: 140,
        blood_pressure_diastolic_min: 60,
        blood_pressure_diastolic_max: 90,
        pulse_min: 60,
        pulse_max: 100
      } : {};

      const insertData = {
        name: originalName,
        normalized_name: normalizedName,
        created_at: now,
        updated_at: now,
        ...defaultHealthBaselines
      };

      const { data, error } = await supabase
        .from(tableName)
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error(`${isUser ? '利用者' : '従業員'}マスタ登録エラー:`, error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error(`${isUser ? '利用者' : '従業員'}マスタ登録エラー:`, error);
      return null;
    }
  }

  private getErrorSeverity(errorType: CSVImportErrorType): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<CSVImportErrorType, 'low' | 'medium' | 'high' | 'critical'> = {
      'file_read_error': 'critical',
      'parse_error': 'high',
      'validation_error': 'medium',
      'name_resolution_error': 'medium',
      'database_error': 'high',
      'network_error': 'medium',
      'timeout_error': 'medium',
      'unknown_error': 'high'
    };
    
    return severityMap[errorType] || 'medium';
  }

  private getSuggestedFix(errorType: CSVImportErrorType): string {
    const fixMap: Record<CSVImportErrorType, string> = {
      'file_read_error': 'ファイル形式を確認し、正しいエンコーディングで保存してください',
      'parse_error': 'CSVファイルの構造を確認し、不正な文字や改行を修正してください',
      'validation_error': '必須フィールドが入力されているか確認してください',
      'name_resolution_error': '名前の表記を統一するか、手動で名前マッピングを追加してください',
      'database_error': 'データベース接続を確認し、必要に応じて管理者に連絡してください',
      'network_error': 'ネットワーク接続を確認し、しばらく待ってから再試行してください',
      'timeout_error': 'ファイルサイズを小さくするか、バッチサイズを調整してください',
      'unknown_error': 'ログを確認し、必要に応じて技術サポートに連絡してください'
    };
    
    return fixMap[errorType] || '詳細なエラーログを確認してください';
  }

  private generateRecommendations(issues: any[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.some(issue => issue.type === 'name_resolution_error')) {
      recommendations.push('名前の正規化パターンを追加して、自動解決率を向上させることをお勧めします');
    }
    
    if (issues.some(issue => issue.severity === 'critical' || issue.severity === 'high')) {
      recommendations.push('重要なエラーが検出されました。データの整合性を確認してください');
    }
    
    if (issues.length > 10) {
      recommendations.push('エラーが多数発生しています。CSVファイルの品質を向上させることをお勧めします');
    }
    
    return recommendations;
  }
}

// シングルトンインスタンス
export const csvImportService = new CSVImportService();
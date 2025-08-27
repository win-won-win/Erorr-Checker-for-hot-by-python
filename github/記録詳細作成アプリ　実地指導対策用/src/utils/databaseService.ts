/**
 * データベース操作ユーティリティ
 * 名前解決履歴の管理、パターン学習データの更新、集計データの生成、エラー追跡機能を提供
 */

import { supabase, Database } from '../lib/supabase';
import { 
  CSVImportJob, 
  CSVImportHistory, 
  NameResolutionPattern, 
  CSVImportError, 
  CSVImportStatistics,
  NameResolutionResult,
  CSVRowProcessingResult
} from '../types/csvImport';
import { NameMatchResult } from './nameNormalizer';

/**
 * データベーストランザクション管理
 */
export class DatabaseTransaction {
  private operations: Array<() => Promise<any>> = [];
  private rollbackOperations: Array<() => Promise<any>> = [];

  add<T>(operation: () => Promise<T>, rollback?: () => Promise<any>): this {
    this.operations.push(operation);
    if (rollback) {
      this.rollbackOperations.unshift(rollback); // 逆順で実行
    }
    return this;
  }

  async execute(): Promise<any[]> {
    const results: any[] = [];
    let executedCount = 0;

    try {
      for (const operation of this.operations) {
        const result = await operation();
        results.push(result);
        executedCount++;
      }
      return results;
    } catch (error) {
      // ロールバック実行
      for (let i = 0; i < executedCount && i < this.rollbackOperations.length; i++) {
        try {
          await this.rollbackOperations[i]();
        } catch (rollbackError) {
          console.error('ロールバック中にエラーが発生:', rollbackError);
        }
      }
      throw error;
    }
  }
}

/**
 * 名前解決履歴管理サービス
 */
export class NameResolutionHistoryService {
  /**
   * 名前解決履歴を保存
   */
  async saveResolutionHistory(
    jobId: string,
    originalName: string,
    resolvedName: string | null,
    matchResult: NameMatchResult | null,
    confidence: 'high' | 'medium' | 'low'
  ): Promise<void> {
    const { error } = await supabase
      .from('name_resolution_history')
      .insert({
        job_id: jobId,
        original_name: originalName,
        resolved_name: resolvedName,
        match_result: matchResult,
        confidence,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`名前解決履歴の保存に失敗: ${error.message}`);
    }
  }

  /**
   * 名前解決履歴を取得
   */
  async getResolutionHistory(
    originalName?: string,
    limit: number = 100
  ): Promise<any[]> {
    let query = supabase
      .from('name_resolution_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (originalName) {
      query = query.eq('original_name', originalName);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`名前解決履歴の取得に失敗: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 類似した名前解決履歴を検索
   */
  async findSimilarResolutions(
    originalName: string,
    threshold: number = 0.8
  ): Promise<any[]> {
    // PostgreSQLの類似度検索機能を使用
    const { data, error } = await supabase
      .rpc('find_similar_name_resolutions', {
        target_name: originalName,
        similarity_threshold: threshold
      });

    if (error) {
      console.warn('類似名前検索でエラー:', error.message);
      return [];
    }

    return data || [];
  }
}

/**
 * パターン学習データ管理サービス
 */
export class PatternLearningService {
  /**
   * 名前解決パターンを保存
   */
  async saveNamePattern(pattern: Omit<NameResolutionPattern, 'id' | 'createdAt'>): Promise<string> {
    const { data, error } = await supabase
      .from('name_resolution_patterns')
      .insert({
        original_pattern: pattern.originalPattern,
        resolved_name: pattern.resolvedName,
        confidence: pattern.confidence,
        usage_count: pattern.usageCount,
        last_used: pattern.lastUsed.toISOString(),
        created_by: pattern.createdBy,
        is_active: pattern.isActive,
        metadata: pattern.metadata,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`パターンの保存に失敗: ${error.message}`);
    }

    return data.id;
  }

  /**
   * 名前解決パターンを取得
   */
  async getNamePatterns(isActive: boolean = true): Promise<NameResolutionPattern[]> {
    const { data, error } = await supabase
      .from('name_resolution_patterns')
      .select('*')
      .eq('is_active', isActive)
      .order('confidence', { ascending: false });

    if (error) {
      throw new Error(`パターンの取得に失敗: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      originalPattern: item.original_pattern,
      resolvedName: item.resolved_name,
      confidence: item.confidence,
      usageCount: item.usage_count,
      lastUsed: new Date(item.last_used),
      createdAt: new Date(item.created_at),
      createdBy: item.created_by,
      isActive: item.is_active,
      metadata: item.metadata
    }));
  }

  /**
   * パターンの使用回数を更新
   */
  async updatePatternUsage(patternId: string): Promise<void> {
    const { error } = await supabase
      .from('name_resolution_patterns')
      .update({
        usage_count: 1, // 実際の実装では現在の値を取得して+1する
        last_used: new Date().toISOString()
      })
      .eq('id', patternId);

    if (error) {
      throw new Error(`パターン使用回数の更新に失敗: ${error.message}`);
    }
  }

  /**
   * 学習データから新しいパターンを生成
   */
  async learnFromResolutions(resolutions: NameResolutionResult[]): Promise<number> {
    let learnedCount = 0;

    for (const resolution of resolutions) {
      if (resolution.isResolved && resolution.resolvedName && resolution.confidence === 'high') {
        try {
          // 既存のパターンをチェック
          const existingPatterns = await this.findMatchingPatterns(resolution.originalName);
          
          if (existingPatterns.length === 0) {
            // 新しいパターンとして学習
            await this.saveNamePattern({
              originalPattern: resolution.originalName,
              resolvedName: resolution.resolvedName,
              confidence: 0.9, // 高信頼度の解決結果から学習
              usageCount: 1,
              lastUsed: new Date(),
              createdBy: 'auto_learning',
              isActive: true,
              metadata: {
                source: 'auto_learned',
                category: 'name_resolution',
                tags: ['csv_import']
              }
            });
            learnedCount++;
          }
        } catch (error) {
          console.warn(`パターン学習でエラー: ${error}`);
        }
      }
    }

    return learnedCount;
  }

  /**
   * マッチするパターンを検索
   */
  private async findMatchingPatterns(originalName: string): Promise<NameResolutionPattern[]> {
    const { data, error } = await supabase
      .from('name_resolution_patterns')
      .select('*')
      .eq('original_pattern', originalName)
      .eq('is_active', true);

    if (error) {
      console.warn('パターン検索でエラー:', error.message);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      originalPattern: item.original_pattern,
      resolvedName: item.resolved_name,
      confidence: item.confidence,
      usageCount: item.usage_count,
      lastUsed: new Date(item.last_used),
      createdAt: new Date(item.created_at),
      createdBy: item.created_by,
      isActive: item.is_active,
      metadata: item.metadata
    }));
  }
}

/**
 * CSV取り込みジョブ管理サービス
 */
export class CSVImportJobService {
  /**
   * ジョブを保存
   */
  async saveJob(job: CSVImportJob): Promise<void> {
    const { error } = await supabase
      .from('csv_import_jobs')
      .insert({
        id: job.id,
        status: job.status,
        priority: job.priority,
        config: job.config,
        progress: job.progress,
        result: job.result,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString(),
        completed_at: job.completedAt?.toISOString(),
        created_by: job.createdBy,
        metadata: job.metadata
      });

    if (error) {
      throw new Error(`ジョブの保存に失敗: ${error.message}`);
    }
  }

  /**
   * ジョブを取得
   */
  async getJob(jobId: string): Promise<CSVImportJob | null> {
    const { data, error } = await supabase
      .from('csv_import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`ジョブの取得に失敗: ${error.message}`);
    }

    return {
      id: data.id,
      status: data.status,
      priority: data.priority,
      config: data.config,
      progress: data.progress,
      result: data.result,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      createdBy: data.created_by,
      metadata: data.metadata
    };
  }

  /**
   * ジョブを更新
   */
  async updateJob(jobId: string, updates: Partial<CSVImportJob>): Promise<void> {
    const updateData: any = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.progress) updateData.progress = updates.progress;
    if (updates.result) updateData.result = updates.result;
    if (updates.startedAt) updateData.started_at = updates.startedAt.toISOString();
    if (updates.completedAt) updateData.completed_at = updates.completedAt.toISOString();
    if (updates.metadata) updateData.metadata = updates.metadata;

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('csv_import_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      throw new Error(`ジョブの更新に失敗: ${error.message}`);
    }
  }

  /**
   * ジョブ一覧を取得
   */
  async listJobs(
    filter?: {
      status?: string;
      createdBy?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CSVImportJob[]> {
    let query = supabase
      .from('csv_import_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.createdBy) {
      query = query.eq('created_by', filter.createdBy);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    if (filter?.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`ジョブ一覧の取得に失敗: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      status: item.status,
      priority: item.priority,
      config: item.config,
      progress: item.progress,
      result: item.result,
      createdAt: new Date(item.created_at),
      startedAt: item.started_at ? new Date(item.started_at) : undefined,
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      createdBy: item.created_by,
      metadata: item.metadata
    }));
  }
}

/**
 * エラー追跡サービス
 */
export class ErrorTrackingService {
  /**
   * エラーを記録
   */
  async logError(jobId: string, error: CSVImportError): Promise<void> {
    const { error: dbError } = await supabase
      .from('csv_import_errors')
      .insert({
        id: error.id,
        job_id: jobId,
        error_type: error.type,
        message: error.message,
        details: error.details,
        row_index: error.rowIndex,
        column_name: error.columnName,
        timestamp: error.timestamp.toISOString(),
        is_recoverable: error.isRecoverable,
        suggested_action: error.suggestedAction
      });

    if (dbError) {
      console.error('エラーログの保存に失敗:', dbError.message);
    }
  }

  /**
   * ジョブのエラー一覧を取得
   */
  async getJobErrors(jobId: string): Promise<CSVImportError[]> {
    const { data, error } = await supabase
      .from('csv_import_errors')
      .select('*')
      .eq('job_id', jobId)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`エラー一覧の取得に失敗: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      type: item.error_type,
      message: item.message,
      details: item.details,
      rowIndex: item.row_index,
      columnName: item.column_name,
      timestamp: new Date(item.timestamp),
      isRecoverable: item.is_recoverable,
      suggestedAction: item.suggested_action
    }));
  }

  /**
   * エラー統計を取得
   */
  async getErrorStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ type: string; count: number; percentage: number }>> {
    let query = supabase
      .from('csv_import_errors')
      .select('error_type');

    if (startDate) {
      query = query.gte('timestamp', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('timestamp', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`エラー統計の取得に失敗: ${error.message}`);
    }

    const errorCounts = (data || []).reduce((acc, item) => {
      acc[item.error_type] = (acc[item.error_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);

    return Object.entries(errorCounts).map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }
}

/**
 * 統計データ生成サービス
 */
export class StatisticsService {
  /**
   * CSV取り込み統計を生成
   */
  async generateImportStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<CSVImportStatistics> {
    const jobs = await this.getJobsInPeriod(startDate, endDate);
    const errors = await this.getErrorsInPeriod(startDate, endDate);
    const nameResolutions = await this.getNameResolutionsInPeriod(startDate, endDate);

    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(job => job.status === 'completed').length;
    const failedJobs = jobs.filter(job => job.status === 'failed').length;

    const totalRowsProcessed = jobs.reduce((sum, job) => 
      sum + (job.result?.summary.processedRows || 0), 0);

    const totalProcessingTime = jobs.reduce((sum, job) => 
      sum + (job.result?.summary.processingTime || 0), 0);

    const averageProcessingTime = totalJobs > 0 ? totalProcessingTime / totalJobs : 0;
    const averageSuccessRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

    // エラー統計
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalErrors = errors.length;
    const mostCommonErrors = Object.entries(errorCounts)
      .map(([type, count]) => ({
        type: type as any,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 名前解決統計
    const totalNamesProcessed = nameResolutions.length;
    const resolvedNames = nameResolutions.filter(nr => nr.resolved_name).length;
    const resolutionRate = totalNamesProcessed > 0 ? (resolvedNames / totalNamesProcessed) * 100 : 0;

    // パフォーマンス統計
    const processingRates = jobs
      .filter(job => job.result?.summary.averageProcessingRate)
      .map(job => job.result!.summary.averageProcessingRate);

    const averageRowsPerMinute = processingRates.length > 0 
      ? processingRates.reduce((sum, rate) => sum + rate, 0) / processingRates.length 
      : 0;

    const peakRowsPerMinute = processingRates.length > 0 
      ? Math.max(...processingRates) 
      : 0;

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      totalRowsProcessed,
      averageProcessingTime,
      averageSuccessRate,
      mostCommonErrors,
      nameResolutionStats: {
        totalNamesProcessed,
        automaticallyResolved: resolvedNames,
        manuallyResolved: 0, // TODO: 手動解決の追跡を実装
        unresolved: totalNamesProcessed - resolvedNames,
        resolutionRate
      },
      performanceMetrics: {
        averageRowsPerMinute,
        peakRowsPerMinute,
        averageMemoryUsage: 0, // TODO: メモリ使用量の追跡を実装
        peakMemoryUsage: 0
      }
    };
  }

  private async getJobsInPeriod(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = supabase.from('csv_import_jobs').select('*');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`ジョブデータの取得に失敗: ${error.message}`);
    return data || [];
  }

  private async getErrorsInPeriod(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = supabase.from('csv_import_errors').select('*');

    if (startDate) {
      query = query.gte('timestamp', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('timestamp', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`エラーデータの取得に失敗: ${error.message}`);
    return data || [];
  }

  private async getNameResolutionsInPeriod(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = supabase.from('name_resolution_history').select('*');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`名前解決データの取得に失敗: ${error.message}`);
    return data || [];
  }
}

/**
 * 統合データベースサービス
 */
export class DatabaseService {
  public readonly nameResolution = new NameResolutionHistoryService();
  public readonly patternLearning = new PatternLearningService();
  public readonly jobManagement = new CSVImportJobService();
  public readonly errorTracking = new ErrorTrackingService();
  public readonly statistics = new StatisticsService();

  /**
   * トランザクションを作成
   */
  createTransaction(): DatabaseTransaction {
    return new DatabaseTransaction();
  }

  /**
   * データベース接続をテスト
   */
  async testConnection(): Promise<{ success: boolean; error?: Error }> {
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * データベースの健全性をチェック
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: boolean; message?: string }>;
  }> {
    const checks = [];

    // 基本接続テスト
    const connectionTest = await this.testConnection();
    checks.push({
      name: 'database_connection',
      status: connectionTest.success,
      message: connectionTest.error?.message
    });

    // 必要なテーブルの存在確認
    const requiredTables = ['users', 'staff', 'csv_service_records', 'csv_import_logs'];
    for (const table of requiredTables) {
      try {
        await supabase.from(table).select('count').limit(1);
        checks.push({ name: `table_${table}`, status: true });
      } catch (error) {
        checks.push({ 
          name: `table_${table}`, 
          status: false, 
          message: (error as Error).message 
        });
      }
    }

    const healthyChecks = checks.filter(check => check.status).length;
    const totalChecks = checks.length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks > totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, checks };
  }
}

// シングルトンインスタンス
export const databaseService = new DatabaseService();
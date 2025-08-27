/**
 * CSV取り込みロジックと名前正規化機能の統合エクスポート
 */

// 名前正規化機能
export * from './nameNormalizer';

// CSV取り込み関連の型定義
export * from '../types/csvImport';

// データベース操作ユーティリティ
export { databaseService } from './databaseService';

// CSV取り込みサービス
export { csvImportService, CSVImportService } from './csvImportService';

// 拡張されたCSVパーサー（名前の衝突を避けるため個別エクスポート）
export {
  parseSimplifiedCSV,
  validateSimplifiedCSVData,
  normalizeNameAdvanced
} from './csvParser';
export type {
  ActualCSVData,
  SimplifiedServiceData,
  EnhancedServiceData,
  CSVParsingOptions,
  CSVParsingResult
} from './csvParser';

// デモ機能
export * from './demo';

// 既存の機能（後方互換性のため）
export { generateRecordTime } from './recordTimeGenerator';

// サービスのインポート
import { csvImportService } from './csvImportService';
import { databaseService } from './databaseService';

/**
 * 統合CSV取り込みシステムの主要機能
 */
export const csvImportSystem = {
  // サービス
  importService: csvImportService,
  databaseService,
  
  // 主要機能のショートカット
  async createImportJob(config: any, file: File) {
    return csvImportService.createJob(config, file);
  },
  
  async startImportJob(jobId: string) {
    return csvImportService.startJob(jobId);
  },
  
  async getJobProgress(jobId: string) {
    return csvImportService.getProgress(jobId);
  },
  
  async resolveNames(names: string[]) {
    return csvImportService.resolveNames(names);
  },
  
  async generateReport(jobId: string) {
    return csvImportService.generateReport(jobId);
  }
};

/**
 * システム初期化
 */
export async function initializeCSVImportSystem(config?: any) {
  console.log('CSV取り込みシステムを初期化しています...');
  
  try {
    // データベース接続確認
    const dbTest = await databaseService.testConnection();
    if (!dbTest.success) {
      console.warn('データベース接続に問題があります:', dbTest.error?.message);
    }
    
    // サービス設定の更新
    if (config) {
      await csvImportService.updateConfig(config);
    }
    
    console.log('CSV取り込みシステムの初期化が完了しました');
    return true;
    
  } catch (error) {
    console.error('CSV取り込みシステムの初期化に失敗しました:', error);
    return false;
  }
}
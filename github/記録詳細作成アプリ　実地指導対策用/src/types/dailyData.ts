/**
 * 日別データ管理関連の型定義
 * 時間軸データ、パターン紐付け結果の型を定義
 */

import { ServicePattern, PatternDetails, PatternMatchResult } from './pattern';

/**
 * 時間軸での記録データ
 */
export interface TimeSlotRecord {
  id: string;
  user_name: string;
  user_code?: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  service_content: string;
  pattern_id: string | null;
  pattern_name?: string | null;
  pattern_details?: PatternDetails | null;
  is_pattern_assigned: boolean;
  record_created_at: string | null;
  print_datetime: string | null;
  confidence_score?: number; // パターン紐付けの信頼度
  auto_assigned?: boolean; // 自動紐付けかどうか
}

/**
 * 時間軸スロット（1時間単位）
 */
export interface TimeSlot {
  hour: number; // 0-23
  time_label: string; // "09:00-10:00"
  records: TimeSlotRecord[];
  total_records: number;
  assigned_records: number;
  unassigned_records: number;
  status: 'complete' | 'partial' | 'none';
  suggested_patterns: PatternMatchResult[];
}

/**
 * 日別データの詳細情報
 */
export interface DailyDataDetail {
  date: string;
  day_of_week: number; // 0=日曜日, 1=月曜日, ..., 6=土曜日
  time_slots: TimeSlot[];
  total_records: number;
  assigned_records: number;
  unassigned_records: number;
  completion_rate: number; // 紐付け完了率 (0-100)
  status: 'complete' | 'partial' | 'none';
  users: string[]; // その日にサービスを受けた利用者一覧
  staff: string[]; // その日に対応した職員一覧
  patterns_used: string[]; // 使用されたパターンID一覧
}

/**
 * パターン紐付け候補
 */
export interface PatternLinkingCandidate {
  record_id: string;
  pattern: ServicePattern;
  confidence: number; // 0-1の信頼度
  matching_factors: {
    user_match: boolean;
    time_match: boolean;
    day_match: boolean;
    service_match: boolean;
  };
  auto_apply_eligible: boolean; // 自動適用可能かどうか
  reason: string; // 候補として選ばれた理由
}

/**
 * パターン紐付け結果
 */
export interface PatternLinkingResult {
  record_id: string;
  pattern_id: string | null;
  success: boolean;
  confidence: number;
  method: 'auto' | 'manual' | 'suggested';
  applied_at: string;
  previous_pattern_id?: string | null;
  error_message?: string;
}

/**
 * 日別データ管理の統計情報
 */
export interface DailyDataStats {
  date: string;
  total_records: number;
  assigned_records: number;
  unassigned_records: number;
  completion_rate: number;
  unique_users: number;
  unique_staff: number;
  unique_patterns: number;
  peak_hour: number; // 最も記録が多い時間帯
  pattern_distribution: {
    pattern_id: string;
    pattern_name: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * パターン紐付け操作の履歴
 */
export interface PatternLinkingHistory {
  id: string;
  record_id: string;
  pattern_id: string | null;
  previous_pattern_id: string | null;
  operation: 'assign' | 'unassign' | 'reassign';
  method: 'auto' | 'manual' | 'bulk';
  confidence: number;
  user_id?: string; // 操作したユーザー
  timestamp: string;
  notes?: string;
}

/**
 * 未紐付けデータの分析結果
 */
export interface UnlinkedDataAnalysis {
  date: string;
  unlinked_records: TimeSlotRecord[];
  analysis: {
    total_unlinked: number;
    by_time_slot: {
      hour: number;
      count: number;
    }[];
    by_user: {
      user_name: string;
      count: number;
    }[];
    by_service_type: {
      service_type: string;
      count: number;
    }[];
  };
  suggestions: {
    create_new_patterns: boolean;
    similar_patterns: ServicePattern[];
    bulk_assignment_candidates: PatternLinkingCandidate[];
  };
}

/**
 * 日別データ管理の設定
 */
export interface DailyDataManagementConfig {
  time_slot_duration: number; // 時間スロットの長さ（分）
  auto_linking: {
    enabled: boolean;
    confidence_threshold: number; // 自動紐付けの信頼度閾値
    require_confirmation: boolean;
  };
  display: {
    show_confidence_scores: boolean;
    highlight_unlinked: boolean;
    group_by_user: boolean;
    show_pattern_suggestions: boolean;
  };
  notifications: {
    unlinked_data_alert: boolean;
    low_confidence_warning: boolean;
    bulk_operation_confirmation: boolean;
  };
}

/**
 * 日別データ管理のフィルター条件
 */
export interface DailyDataFilter {
  status: 'all' | 'assigned' | 'unassigned';
  users: string[];
  staff: string[];
  patterns: string[];
  time_range: {
    start_hour: number;
    end_hour: number;
  };
  confidence_range: {
    min: number;
    max: number;
  };
  service_types: string[];
}

/**
 * 一括パターン紐付け操作
 */
export interface BulkPatternLinking {
  operation: 'assign' | 'unassign' | 'reassign';
  record_ids: string[];
  pattern_id?: string;
  force_apply: boolean; // 低信頼度でも強制適用
  backup_original: boolean; // 元データをバックアップ
}

/**
 * 一括操作の結果
 */
export interface BulkOperationResult {
  total_processed: number;
  successful: number;
  failed: number;
  results: PatternLinkingResult[];
  errors: {
    record_id: string;
    error_message: string;
  }[];
  summary: {
    patterns_assigned: {
      pattern_id: string;
      pattern_name: string;
      count: number;
    }[];
    completion_rate_change: number;
  };
}

/**
 * 日別データ管理のイベント
 */
export type DailyDataManagementEvent = 
  | { type: 'record_selected'; payload: { record_id: string; record: TimeSlotRecord } }
  | { type: 'pattern_assigned'; payload: { record_id: string; pattern_id: string; confidence: number } }
  | { type: 'pattern_unassigned'; payload: { record_id: string; previous_pattern_id: string } }
  | { type: 'bulk_operation_completed'; payload: { operation: BulkPatternLinking; result: BulkOperationResult } }
  | { type: 'filter_applied'; payload: { filter: DailyDataFilter; result_count: number } }
  | { type: 'unlinked_data_detected'; payload: { analysis: UnlinkedDataAnalysis } }
  | { type: 'auto_linking_completed'; payload: { processed: number; assigned: number } };

/**
 * 日別データ管理のイベントハンドラー
 */
export type DailyDataManagementEventHandler = (event: DailyDataManagementEvent) => void | Promise<void>;

/**
 * 日別データ管理サービスのインターフェース
 */
export interface IDailyDataManagementService {
  // データ取得
  getDailyData(date: string): Promise<DailyDataDetail>;
  getTimeSlotData(date: string, hour: number): Promise<TimeSlot>;
  getDailyStats(date: string): Promise<DailyDataStats>;
  
  // パターン紐付け
  linkPattern(recordId: string, patternId: string, method: 'auto' | 'manual'): Promise<PatternLinkingResult>;
  unlinkPattern(recordId: string): Promise<PatternLinkingResult>;
  bulkLinkPatterns(operation: BulkPatternLinking): Promise<BulkOperationResult>;
  
  // パターン候補
  getPatternCandidates(recordId: string): Promise<PatternLinkingCandidate[]>;
  autoLinkPatterns(date: string, config?: DailyDataManagementConfig): Promise<BulkOperationResult>;
  
  // 分析
  analyzeUnlinkedData(date: string): Promise<UnlinkedDataAnalysis>;
  getPatternLinkingHistory(date: string): Promise<PatternLinkingHistory[]>;
  
  // 設定
  getConfig(): DailyDataManagementConfig;
  updateConfig(config: Partial<DailyDataManagementConfig>): Promise<void>;
  
  // イベント処理
  addEventListener(handler: DailyDataManagementEventHandler): () => void;
  removeEventListener(handler: DailyDataManagementEventHandler): void;
}
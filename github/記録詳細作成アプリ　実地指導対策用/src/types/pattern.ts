/**
 * パターン管理関連の型定義
 * パターン自動作成、マッチング、学習機能の型を定義
 */

/**
 * サービスパターンの基本型
 */
export interface ServicePattern {
  id: string;
  pattern_name: string;
  pattern_details: PatternDetails;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * パターン詳細の型定義
 */
export interface PatternDetails {
  pre_check: {
    health_check: boolean;
    environment_setup: boolean;
    consultation_record: boolean;
  };
  excretion: {
    toilet_assistance: boolean;
    portable_toilet: boolean;
    diaper_change: boolean;
    pad_change: boolean;
    cleaning: boolean;
    bowel_movement_count: number;
    urination_count: number;
  };
  meal: {
    full_assistance: boolean;
    completion_status: string;
    water_intake: number;
  };
  body_care: {
    body_wipe: string;
    full_body_bath: boolean;
    partial_bath_hand: boolean;
    partial_bath_foot: boolean;
    hair_wash: boolean;
    face_wash: boolean;
    grooming: boolean;
    oral_care: boolean;
  };
  body_grooming: {
    nail_care_hand: boolean;
    nail_care_foot: boolean;
    clothing_assistance: boolean;
  };
  transfer_movement: {
    transfer_assistance: boolean;
    movement_assistance: boolean;
    outing_assistance: boolean;
    position_change: boolean;
  };
  sleep_wake: {
    wake_assistance: boolean;
    sleep_assistance: boolean;
  };
  medication: {
    medication_assistance: boolean;
    ointment_eye_drops: boolean;
    sputum_suction: boolean;
  };
  self_support: {
    cooking_together: boolean;
    safety_monitoring: boolean;
    housework_together: boolean;
    motivation_support: boolean;
  };
  life_support: {
    cleaning: {
      room_cleaning: boolean;
      toilet_cleaning: boolean;
      table_cleaning: boolean;
    };
    garbage_disposal: boolean;
    preparation_cleanup: boolean;
    laundry: {
      washing_drying: boolean;
      folding_storage: boolean;
      ironing: boolean;
    };
    bedding: {
      sheet_change: boolean;
      cover_change: boolean;
      bed_making: boolean;
      futon_airing: boolean;
    };
    clothing: {
      organization: boolean;
      repair: boolean;
    };
    cooking: {
      general_cooking: boolean;
      serving: boolean;
      cleanup: boolean;
    };
    shopping: {
      daily_items: boolean;
      medicine_pickup: boolean;
    };
  };
  exit_check: {
    fire_check: boolean;
    electricity_check: boolean;
    water_check: boolean;
    door_lock_check: boolean;
  };
}

/**
 * 利用者×時間×曜日のパターン
 */
export interface UserTimePattern {
  id: string;
  user_id: string;
  user_name: string;
  pattern_id: string;
  pattern_name: string;
  start_time: string;
  end_time: string;
  day_of_week: number; // 0=日曜日, 1=月曜日, ..., 6=土曜日
  is_active: boolean;
  pattern_details: PatternDetails;
  created_at: string;
  updated_at: string;
}

/**
 * パターンマッチングの条件
 */
export interface PatternMatchingCriteria {
  user_id?: string;
  time_range?: {
    start: string;
    end: string;
  };
  day_of_week?: number;
  service_types?: string[];
  required_services?: string[];
}

/**
 * パターンマッチングの結果
 */
export interface PatternMatchResult {
  pattern: ServicePattern;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matching_factors: {
    user_match: boolean;
    time_match: boolean;
    day_match: boolean;
    service_match: boolean;
  };
  weight_scores: {
    user_weight: number;
    time_weight: number;
    day_weight: number;
    service_weight: number;
  };
}

/**
 * パターン学習データ
 */
export interface PatternLearningData {
  id: string;
  pattern_id: string;
  user_id: string;
  application_date: string;
  success: boolean;
  feedback_score: number; // 1-5の評価
  actual_services: string[];
  time_taken: number; // 分
  notes?: string;
  created_at: string;
}

/**
 * パターン適用履歴
 */
export interface PatternApplicationHistory {
  id: string;
  pattern_id: string;
  user_id: string;
  applied_at: string;
  success: boolean;
  confidence_at_application: number;
  actual_outcome: 'success' | 'partial_success' | 'failure';
  feedback?: {
    rating: number;
    comments: string;
  };
  modifications_made?: PatternDetails;
}

/**
 * パターン統計情報
 */
export interface PatternStatistics {
  pattern_id: string;
  pattern_name: string;
  total_applications: number;
  successful_applications: number;
  success_rate: number;
  average_confidence: number;
  average_feedback_score: number;
  most_common_user_ids: string[];
  most_common_time_slots: string[];
  most_common_days: number[];
  last_used: string;
  created_at: string;
  updated_at: string;
}

/**
 * 自動パターン作成の設定
 */
export interface AutoPatternCreationConfig {
  min_occurrences: number; // 最小出現回数
  similarity_threshold: number; // 類似度閾値 (0-1)
  time_window_minutes: number; // 時間窓（分）
  day_grouping: boolean; // 曜日でグループ化するか
  user_grouping: boolean; // 利用者でグループ化するか
  auto_naming: boolean; // 自動命名するか
}

/**
 * パターン推奨結果
 */
export interface PatternRecommendation {
  recommended_patterns: PatternMatchResult[];
  confidence_threshold: number;
  auto_apply_eligible: PatternMatchResult[];
  manual_review_required: PatternMatchResult[];
  no_match_reason?: string;
  suggestions?: {
    create_new_pattern: boolean;
    similar_patterns: ServicePattern[];
    recommended_modifications: Partial<PatternDetails>;
  };
}

/**
 * パターン学習の結果
 */
export interface PatternLearningResult {
  pattern_id: string;
  learning_data_count: number;
  confidence_improvement: number;
  accuracy_metrics: {
    precision: number;
    recall: number;
    f1_score: number;
  };
  updated_weights: {
    user_weight: number;
    time_weight: number;
    day_weight: number;
    service_weight: number;
  };
  recommendations: string[];
}

/**
 * パターン信頼度計算の結果
 */
export interface PatternConfidenceScore {
  pattern_id: string;
  overall_confidence: number; // 0-1
  component_scores: {
    historical_success: number;
    usage_frequency: number;
    user_feedback: number;
    time_consistency: number;
    service_completeness: number;
  };
  factors: {
    positive_factors: string[];
    negative_factors: string[];
    improvement_suggestions: string[];
  };
  last_calculated: string;
}

/**
 * 未紐付けデータの情報
 */
export interface UnlinkedDataInfo {
  user_id: string;
  user_name: string;
  date: string;
  time_slot: string;
  services_provided: string[];
  potential_patterns: PatternMatchResult[];
  requires_attention: boolean;
  suggested_actions: string[];
}

/**
 * パターン適用の設定
 */
export interface PatternApplicationSettings {
  auto_apply_threshold: number; // 自動適用の信頼度閾値
  require_confirmation: boolean; // 確認を必要とするか
  backup_original: boolean; // 元データをバックアップするか
  notification_enabled: boolean; // 通知を有効にするか
  learning_enabled: boolean; // 学習機能を有効にするか
}

/**
 * パターン管理サービスの設定
 */
export interface PatternServiceConfig {
  matching: {
    default_weights: {
      user_weight: number;
      time_weight: number;
      day_weight: number;
      service_weight: number;
    };
    similarity_threshold: number;
    max_results: number;
  };
  learning: {
    enabled: boolean;
    min_data_points: number;
    learning_rate: number;
    batch_size: number;
  };
  auto_creation: AutoPatternCreationConfig;
  application: PatternApplicationSettings;
}

/**
 * パターン管理イベント
 */
export type PatternManagementEvent = 
  | { type: 'pattern_created'; payload: { pattern: ServicePattern; auto_created: boolean } }
  | { type: 'pattern_applied'; payload: { pattern_id: string; user_id: string; confidence: number } }
  | { type: 'pattern_learned'; payload: { pattern_id: string; learning_result: PatternLearningResult } }
  | { type: 'pattern_recommended'; payload: { user_id: string; recommendations: PatternRecommendation } }
  | { type: 'unlinked_data_detected'; payload: { unlinked_data: UnlinkedDataInfo } }
  | { type: 'confidence_updated'; payload: { pattern_id: string; new_confidence: number } };

/**
 * パターン管理イベントハンドラー
 */
export type PatternManagementEventHandler = (event: PatternManagementEvent) => void | Promise<void>;

/**
 * パターン管理サービスのインターフェース
 */
export interface IPatternService {
  // パターン管理
  createPattern(pattern: Omit<ServicePattern, 'id' | 'created_at' | 'updated_at'>): Promise<ServicePattern>;
  updatePattern(id: string, updates: Partial<ServicePattern>): Promise<ServicePattern>;
  deletePattern(id: string): Promise<boolean>;
  getPattern(id: string): Promise<ServicePattern | null>;
  listPatterns(filter?: Partial<ServicePattern>): Promise<ServicePattern[]>;

  // 自動パターン作成
  createPatternsFromData(data: UserTimePattern[], config?: AutoPatternCreationConfig): Promise<ServicePattern[]>;
  detectSimilarPatterns(pattern: ServicePattern, threshold?: number): Promise<ServicePattern[]>;
  suggestPatternMerge(patterns: ServicePattern[]): Promise<ServicePattern>;

  // パターンマッチング
  findMatchingPatterns(criteria: PatternMatchingCriteria): Promise<PatternMatchResult[]>;
  recommendPatterns(user_id: string, date: string, time: string): Promise<PatternRecommendation>;
  calculatePatternScore(pattern: ServicePattern, criteria: PatternMatchingCriteria): Promise<number>;

  // パターン学習
  recordPatternApplication(application: PatternApplicationHistory): Promise<void>;
  updatePatternConfidence(pattern_id: string): Promise<PatternConfidenceScore>;
  learnFromFeedback(pattern_id: string, feedback: PatternLearningData): Promise<PatternLearningResult>;

  // 統計・分析
  getPatternStatistics(pattern_id: string): Promise<PatternStatistics>;
  getUnlinkedData(date_range?: { start: string; end: string }): Promise<UnlinkedDataInfo[]>;
  generatePatternReport(pattern_id: string): Promise<any>;

  // 設定管理
  getConfig(): PatternServiceConfig;
  updateConfig(config: Partial<PatternServiceConfig>): Promise<void>;

  // イベント処理
  addEventListener(handler: PatternManagementEventHandler): () => void;
  removeEventListener(handler: PatternManagementEventHandler): void;
}